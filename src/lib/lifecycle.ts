/**
 * Moteur du cycle de vie d'un processus (mode Exploration) — pur, sans React ni horloge.
 *
 * Modèle du syllabus : 3 états (Prêt, Élu, Bloqué) et 4 transitions.
 * Étendu ici avec « Nouveau » et « Terminé » pour montrer le cycle complet : ces deux états
 * sont distingués visuellement du modèle à trois états.
 *
 *   Nouveau ─admission→ Prêt ─élection→ Élu ─fin→ Terminé
 *                        ↑  ←préemption─┘ │
 *                        └──fin d'attente─ Bloqué ←─attente d'un événement─┘
 *
 * Règles :
 *  - un seul processus est Élu à la fois (CPU monocœur) ;
 *  - seul l'ordonnanceur élit, et seulement dans la file des Prêts (ici : le premier arrivé, FIFO) ;
 *  - un processus Bloqué qui est réveillé repasse TOUJOURS par Prêt ;
 *  - un processus ne peut se bloquer que s'il s'exécute (il faut être sur le CPU pour demander une E/S).
 */
export type PState = 'new' | 'ready' | 'running' | 'blocked' | 'terminated'
export type WaitReason = 'disk' | 'keyboard' | 'network'

export const STATE_LABEL: Record<PState, string> = { new: 'Nouveau', ready: 'Prêt', running: 'Élu', blocked: 'Bloqué', terminated: 'Terminé' }
export const WAIT_LABEL: Record<WaitReason, string> = { disk: 'le disque', keyboard: 'le clavier', network: 'le réseau' }
export const WAIT_EVENT: Record<WaitReason, string> = { disk: 'Les données du disque arrivent', keyboard: 'Une touche est pressée', network: 'Le paquet réseau arrive' }
export const MAX_PROCS = 6

export interface Proc {
  id: number
  name: string
  state: PState
  /** pour un processus Bloqué : ce qu'il attend */
  waiting?: WaitReason
  /** nombre de fois où il a eu le CPU */
  turns: number
}

export interface Sim {
  procs: Proc[]
  /** file des processus Prêts, le premier est le prochain élu */
  ready: number[]
  /** processus Élu (le CPU monocœur n'en porte qu'un) */
  cpu: number | null
  /** zone des processus Bloqués, par ordre d'entrée */
  blocked: number[]
  nextId: number
}

export type Action =
  | { type: 'create' }
  | { type: 'admit'; id: number }
  | { type: 'elect'; id?: number }
  | { type: 'preempt'; id: number }
  | { type: 'block'; id: number; reason: WaitReason }
  | { type: 'wake'; id: number }
  | { type: 'end'; id: number }

/** Résultat d'une action : nouvel état + explication, ou refus argumenté */
export type Outcome =
  | { ok: true; sim: Sim; title: string; why: string; transition?: { from: PState; to: PState; id: number } }
  | { ok: false; why: string }

export const initialSim = (): Sim => ({ procs: [], ready: [], cpu: null, blocked: [], nextId: 1 })

export const find = (s: Sim, id: number) => s.procs.find((p) => p.id === id)

const refuse = (why: string): Outcome => ({ ok: false, why })
const patch = (s: Sim, id: number, p: Partial<Proc>): Proc[] => s.procs.map((x) => (x.id === id ? { ...x, ...p } : x))
const nm = (s: Sim, id: number) => find(s, id)?.name ?? '?'

export function apply(s: Sim, a: Action): Outcome {
  switch (a.type) {
    case 'create': {
      if (s.procs.filter((p) => p.state !== 'terminated').length >= MAX_PROCS) return refuse(`Pour garder la simulation lisible, ${MAX_PROCS} processus au maximum à la fois. Terminez-en un d'abord.`)
      const id = s.nextId
      const proc: Proc = { id, name: `P${id}`, state: 'new', turns: 0 }
      return { ok: true, sim: { ...s, procs: [...s.procs, proc], nextId: id + 1 }, title: `P${id} est créé`, why: `Le système a créé le processus (PCB, mémoire…). Il est Nouveau : il n'est pas encore admis dans la compétition pour le CPU.` }
    }

    case 'admit': {
      const p = find(s, a.id)
      if (!p) return refuse('Choisissez d’abord un processus.')
      if (p.state !== 'new') return refuse(`${p.name} est déjà lancé : l'admission ne concerne que les processus Nouveau.`)
      return { ok: true, sim: { ...s, procs: patch(s, p.id, { state: 'ready' }), ready: [...s.ready, p.id] }, transition: { from: 'new', to: 'ready', id: p.id },
        title: `${p.name} : Nouveau → Prêt`, why: `${p.name} est admis. Il a tout ce qu'il lui faut sauf le processeur : il rejoint la fin de la file des processus Prêts.` }
    }

    case 'elect': {
      const target = a.id !== undefined ? find(s, a.id) : undefined
      if (target) {
        if (target.state === 'blocked') return refuse(`${target.name} est Bloqué : il attend ${WAIT_LABEL[target.waiting ?? 'disk']}. Un processus bloqué ne peut pas recevoir le CPU, même s'il est libre. Il doit d'abord repasser par l'état Prêt (fin de l'attente).`)
        if (target.state === 'new') return refuse(`${target.name} est Nouveau : il doit d'abord être lancé (Prêt) avant de pouvoir être élu.`)
        if (target.state === 'running') return refuse(`${target.name} utilise déjà le CPU.`)
        if (target.state === 'terminated') return refuse(`${target.name} est terminé.`)
      }
      if (s.cpu !== null) return refuse(`Le CPU est occupé par ${nm(s, s.cpu)} : un cœur n'exécute qu'un seul processus à la fois. Retirez-lui le CPU (préemption), bloquez-le ou terminez-le.`)
      if (s.ready.length === 0) return refuse('La file des processus Prêts est vide : l’ordonnanceur n’a personne à élire. Lancez un processus, ou faites repasser un Bloqué par l’état Prêt.')
      if (target && s.ready[0] !== target.id) return refuse(`C'est l'ordonnanceur qui choisit, et il suit l'ordre de la file (premier arrivé, premier servi) : ${nm(s, s.ready[0])} passe avant ${target.name}.`)
      const id = s.ready[0]
      const p = find(s, id)!
      return { ok: true, sim: { ...s, procs: patch(s, id, { state: 'running', turns: p.turns + 1 }), ready: s.ready.slice(1), cpu: id }, transition: { from: 'ready', to: 'running', id },
        title: `${p.name} : Prêt → Élu`, why: `L'ordonnanceur choisit le premier de la file des Prêts, ${p.name}, et lui attribue le CPU. Il s'exécute maintenant.` }
    }

    case 'preempt': {
      const p = find(s, a.id)
      if (!p) return refuse('Choisissez d’abord un processus.')
      if (p.state !== 'running') return refuse(`${p.name} n'a pas le CPU (${STATE_LABEL[p.state]}) : on ne peut retirer le processeur qu'au processus Élu.`)
      return { ok: true, sim: { ...s, procs: patch(s, p.id, { state: 'ready' }), cpu: null, ready: [...s.ready, p.id] }, transition: { from: 'running', to: 'ready', id: p.id },
        title: `${p.name} : Élu → Prêt`, why: `Préemption : le système d'exploitation retire le CPU à ${p.name} (son temps est écoulé). Il n'a rien à attendre, il redevient Prêt à la fin de la file. Le CPU est libre.` }
    }

    case 'block': {
      const p = find(s, a.id)
      if (!p) return refuse('Choisissez d’abord un processus.')
      if (p.state === 'ready') return refuse(`${p.name} est Prêt : il n'exécute aucune instruction, donc il ne peut pas demander d'entrée/sortie. Seul le processus Élu peut se bloquer.`)
      if (p.state === 'blocked') return refuse(`${p.name} est déjà Bloqué.`)
      if (p.state === 'new') return refuse(`${p.name} n'a pas encore commencé : il ne peut pas attendre une donnée.`)
      if (p.state === 'terminated') return refuse(`${p.name} est terminé.`)
      return { ok: true, sim: { ...s, procs: patch(s, p.id, { state: 'blocked', waiting: a.reason }), cpu: null, blocked: [...s.blocked, p.id] }, transition: { from: 'running', to: 'blocked', id: p.id },
        title: `${p.name} : Élu → Bloqué`, why: `${p.name} attend ${WAIT_LABEL[a.reason]} : sans cette donnée il ne peut pas avancer. Il libère le CPU, qui peut servir un autre processus pendant l'attente.` }
    }

    case 'wake': {
      const p = find(s, a.id)
      if (!p) return refuse('Choisissez d’abord un processus.')
      if (p.state !== 'blocked') return refuse(`${p.name} n'attend rien (${STATE_LABEL[p.state]}) : la fin d'attente ne concerne que les processus Bloqués.`)
      const cpuNote = s.cpu === null ? ' Le CPU est pourtant libre, mais seul l’ordonnanceur peut l’attribuer : il faut passer par la file.' : ` Le CPU est occupé par ${nm(s, s.cpu)}, il devra de toute façon attendre son tour.`
      return { ok: true, sim: { ...s, procs: patch(s, p.id, { state: 'ready', waiting: undefined }), blocked: s.blocked.filter((x) => x !== p.id), ready: [...s.ready, p.id] }, transition: { from: 'blocked', to: 'ready', id: p.id },
        title: `${p.name} : Bloqué → Prêt`, why: `${WAIT_EVENT[p.waiting ?? 'disk']} : ${p.name} peut continuer. Il rejoint la file des Prêts, pas le CPU.${cpuNote}` }
    }

    case 'end': {
      const p = find(s, a.id)
      if (!p) return refuse('Choisissez d’abord un processus.')
      if (p.state === 'terminated') return refuse(`${p.name} est déjà terminé.`)
      const next: Sim = { ...s, procs: patch(s, p.id, { state: 'terminated', waiting: undefined }), ready: s.ready.filter((x) => x !== p.id), blocked: s.blocked.filter((x) => x !== p.id), cpu: s.cpu === p.id ? null : s.cpu }
      const where = p.state === 'ready' ? 'la file des Prêts' : p.state === 'blocked' ? 'la zone des Bloqués' : 'la liste des processus'
      const why = p.state === 'running' ? `${p.name} a fini son travail (exit) : le système libère sa mémoire et le CPU.` : `Terminaison forcée de ${p.name} (kill) : le système le retire de ${where} et libère ses ressources.`
      return { ok: true, sim: next, transition: { from: p.state, to: 'terminated', id: p.id }, title: `${p.name} : ${STATE_LABEL[p.state]} → Terminé`, why }
    }
  }
}

/** Prochain geste conseillé selon l'état courant (aide à suivre le cycle sans le mémoriser) */
export function suggest(s: Sim, selected: number | null): string {
  const live = s.procs.filter((p) => p.state !== 'terminated')
  if (live.length === 0) return 'Commencez par créer un processus.'
  const fresh = live.find((p) => p.state === 'new')
  if (fresh) return `${fresh.name} est Nouveau : lancez-le pour le rendre Prêt.`
  if (s.cpu === null && s.ready.length) return `Le CPU est libre et ${nm(s, s.ready[0])} attend : demandez à l'ordonnanceur d'élire.`
  const run = s.cpu !== null ? find(s, s.cpu) : undefined
  if (run && s.blocked.length === 0) return `${run.name} s'exécute : déclenchez une attente (E/S) pour le bloquer, ou retirez-lui le CPU.`
  if (s.blocked.length) {
    const b = find(s, selected !== null && s.blocked.includes(selected) ? selected : s.blocked[0])!
    return `${b.name} attend ${WAIT_LABEL[b.waiting ?? 'disk']} : signalez la fin de l'attente pour le remettre en file.`
  }
  return 'Continuez : préemptez, bloquez, terminez… chaque événement a une conséquence.'
}

/** Transitions que le modèle autorise depuis chaque état (3 états du syllabus + Nouveau / Terminé) */
export const LEGAL: Record<PState, PState[]> = {
  new: ['ready', 'terminated'],
  ready: ['running', 'terminated'],
  running: ['ready', 'blocked', 'terminated'],
  blocked: ['ready', 'terminated'],
  terminated: [],
}

import { ArrowRight, Lock, Signal } from 'lucide-react'
import { ConcurrencyBoard } from '../../components/ConcurrencyBoard'
import type { PhraseAt } from '../../lib/clock'
import { type Machine, defaults } from '../../lib/concurrency'
import { estimateSeconds } from '../../lib/narration'
import type { Scene, SceneAudio, SoundCue } from '../types'
import { AUDIO_URL, type SceneKey, narrationOf } from './narration'
import { type Step, T, compile, cuesOf, fade, playhead, spread } from './scripts'
import { FILE_DURATION, SEGMENTS, SYNC } from './sync.generated'
import { CompareTable, CriticalZone, EventStrip, IrqScene, SeqStrip } from './visuals'

/**
 * Les scènes sont des fonctions pures de `progress`. Les scènes « machine » passent un SCRIPT dans le vrai moteur
 * (src/lib/concurrency.ts) : chaque instruction a pour instant une expression de la narration (+ délai ≥ 0).
 * Quand le MP3 existera, `python3 scripts/calibrate-sync.py --lesson=mutex` recale tout seul.
 */
const audio = (k: SceneKey): SceneAudio | undefined => {
  const seg = SEGMENTS[k]
  return seg ? { src: AUDIO_URL, from: seg.from, to: seg.to, fileDuration: FILE_DURATION ?? undefined } : undefined
}
const dur = (k: SceneKey) => estimateSeconds(narrationOf(k))
const cue = (at: PhraseAt, on: string, off: number, sound: SoundCue['sound'], extra: Partial<SoundCue> = {}): SoundCue[] => {
  const p = at(on, off)
  return p == null ? [] : [{ at: p, sound, ...extra }]
}
const st = (pid: number, t: Step['t']): Step => ({ pid, t })

/** Scène « machine » : tableau + chronologie, pilotés par le script */
function MachineView({ machines, steps, progress, at, hideCost, top }: { machines: Machine[]; steps: Step[]; progress: number; at: PhraseAt; hideCost?: boolean; top?: (m: Machine) => React.ReactNode }) {
  const { m, pulse } = playhead(machines, steps, progress, at)
  return (
    <div className="flex h-full w-full flex-col gap-1">
      {top?.(m)}
      <ConcurrencyBoard m={m} pulse={pulse} hideCost={hideCost} className="min-h-0 w-full flex-1" />
      <EventStrip m={m} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 1 — le problème                                                     */
/* ------------------------------------------------------------------ */
const RACE_STEPS: Step[] = [st(1, T('P1 lit', 0.9)), st(2, T('P2 lit aussi', 0.9)), st(1, T('P1 calcule', 0.9)), st(2, T('P2 cinquante', 0.2)), st(1, T('P1 écrit', 0.9)), st(2, T('puis P2 écrit', 0.9))]
const RACE = compile({ ...defaults('race'), n: 2 }, RACE_STEPS)

const race: Scene = {
  id: 'race', title: 'Le problème des accès concurrents', duration: dur('race'), audio: audio('race'), sync: SYNC.race, narration: narrationOf('race'),
  beats: [
    { on: 'Un compte partagé', text: 'Solde : 100 $. P1 retire 30 $, P2 retire 50 $ → résultat attendu : 20 $' },
    { on: 'Mais retirer', text: 'Retirer = lire, calculer, écrire : trois étapes, pas une seule' },
    { on: 'P1 lit', text: 'P1 et P2 lisent le même solde : 100 $' },
    { on: 'P1 calcule', text: 'Chacun calcule à partir de SA copie : 70 $ et 50 $' },
    { on: 'Solde final', text: 'P2 écrase l’écriture de P1 : 50 $ au lieu de 20 $' },
  ],
  cues: (at) => [...cuesOf(RACE, RACE_STEPS, at), ...cue(at, 'Solde final', 0.2, 'move', { gain: 0.7 })],
  render: ({ progress, at }) => <MachineView machines={RACE} steps={RACE_STEPS} progress={progress} at={at} hideCost />,
}

/* ------------------------------------------------------------------ */
/* 2 — section critique                                                */
/* ------------------------------------------------------------------ */
const critical: Scene = {
  id: 'critical', title: 'Section critique et exclusion mutuelle', duration: dur('critical'), audio: audio('critical'), sync: SYNC.critical, narration: narrationOf('critical'),
  beats: [
    { on: 'Le compte est', text: 'Ressource partagée : utilisée par plusieurs processus' },
    { on: 'Le code qui y accède', text: 'Section critique : le code qui touche à la ressource partagée' },
    { on: "L'exclusion mutuelle", text: 'Exclusion mutuelle : un seul dedans, l’autre attend' },
    { on: 'Quatre propriétés', text: 'Quatre propriétés d’une bonne solution' },
    { on: 'Si la section est libre', text: 'Section libre : P2 peut entrer, personne n’est favorisé' },
    { on: 'Schéma constant', text: 'Entrée → section critique → sortie' },
  ],
  cues: (at) => [
    ...cue(at, 'Le compte est', 0.3, 'appear', { pitch: 0, gain: 0.7 }),
    ...cue(at, "L'exclusion mutuelle", 1.5, 'enter', { gain: 0.8 }),
    ...cue(at, 'Si la section est libre', 1.4, 'done', { gain: 0.6 }),
    ...['Un seul processus à la fois', "Un processus qui n'utilise", 'Si la section est libre', "Et personne n'a"].flatMap((p, i) => cue(at, p, 0.3, 'appear', { pitch: i + 1, gain: 0.5 })),
  ],
  render: ({ progress, at }) => <CriticalZone progress={progress} at={at} />,
}

/* ------------------------------------------------------------------ */
/* 3 — attente active                                                  */
/* ------------------------------------------------------------------ */
const NAIVE_STEPS: Step[] = [st(1, T('On la teste', 0.9)), st(2, T("l'autre s'intercale", 0.3)), st(1, T('tous deux voient', 0.3)), st(2, T('tous deux entrent', 0.1))]
const NAIVE = compile({ ...defaults('spin'), n: 2, atomic: false }, NAIVE_STEPS)
const TAS_STEPS: Step[] = [
  st(1, T('P1 exécute', 1.6)), st(2, T('P2 essaie', 0.5)),
  ...[0, 1, 2, 3, 4, 5].map((i) => st(i % 2 === 0 ? 1 : 2, spread(T('P2 recommence', 0.3), T('Quand P1 libère', 0), i, 6))),
  st(1, T('Quand P1 libère', 1.1)), st(2, T('P2 réussit', 0.1)),
]
const TAS = compile({ ...defaults('spin'), n: 2, atomic: true }, TAS_STEPS)

const spin: Scene = {
  id: 'spin', title: 'L’attente active (busy waiting)', duration: dur('spin'), audio: audio('spin'), sync: SYNC.spin, narration: narrationOf('spin'),
  beats: [
    { on: 'Première idée', text: 'Une variable commune « verrou » : 0 = libre, 1 = occupé' },
    { on: 'Mais tester puis écrire', text: 'Tester puis écrire = 2 instructions : les deux processus entrent !' },
    { on: 'Il faut une opération atomique', text: 'Test and Set : lire ET écrire en une seule instruction indivisible' },
    { on: 'P1 exécute', text: 'P1 obtient le verrou. P2 essaie : verrou occupé' },
    { on: 'P2 recommence', text: 'Spinlock : P2 reteste sans cesse, et reste sur le CPU' },
    { on: 'Le processeur travaille', text: 'Chaque tentative refusée = un tour de CPU gaspillé' },
    { on: 'Quand P1 libère', text: 'P1 libère : le prochain Test and Set de P2 réussit' },
    { on: 'Acceptable', text: 'Acceptable si l’attente est brève, coûteux si elle est longue' },
  ],
  cues: (at) => {
    const sw = at('Il faut une opération atomique')
    return [...cuesOf(NAIVE, NAIVE_STEPS, at).filter((c) => sw == null || (c.at ?? 0) < sw), ...cuesOf(TAS, TAS_STEPS, at)]
  },
  render: ({ progress, at }) => {
    const sw = at('Il faut une opération atomique') ?? 2
    const tas = progress >= sw
    return tas
      ? <MachineView machines={TAS} steps={TAS_STEPS} progress={progress} at={at} />
      : <MachineView machines={NAIVE} steps={NAIVE_STEPS} progress={progress} at={at} hideCost />
  },
}

/* ------------------------------------------------------------------ */
/* 4 — interruptions                                                   */
/* ------------------------------------------------------------------ */
const irq: Scene = {
  id: 'irq', title: 'Le masquage des interruptions', duration: dur('irq'), audio: audio('irq'), sync: SYNC.irq, narration: narrationOf('irq'),
  beats: [
    { on: 'Autre approche', text: 'Masquer les interruptions : le CPU ignore l’horloge, P1 n’est plus interrompu' },
    { on: "Mais c'est", text: 'Risqué : un programme qui oublie de les réactiver fige le système' },
    { on: 'Avec plusieurs processeurs', text: 'Multicœur : l’autre cœur accède à la ressource malgré tout' },
    { on: "C'est un outil", text: 'À réserver au noyau, pour de très courts instants' },
  ],
  cues: (at) => [...cue(at, 'Le processeur ignore', 0.3, 'enter', { gain: 0.7 }), ...cue(at, "Mais c'est", 0.4, 'move', { gain: 0.6 }), ...cue(at, 'Avec plusieurs processeurs', 0.8, 'move', { gain: 0.6 })],
  render: ({ progress, at }) => <IrqScene progress={progress} at={at} />,
}

/* ------------------------------------------------------------------ */
/* 5 — mutex bloquant                                                  */
/* ------------------------------------------------------------------ */
const MUTEX_STEPS: Step[] = [
  st(1, T('P1 le demande', 0.8)), st(2, T('P2 le demande', 0.8)),
  ...[0, 1, 2].map((i) => st(1, spread(T('P1 avance', 0), T('Quand P1 libère', 0), i, 3))),
  st(1, T('Quand P1 libère', 1.2)), st(2, T('Contrairement', 0.2)),
]
const MUTEX = compile({ ...defaults('mutex'), n: 2 }, MUTEX_STEPS)

const mutex: Scene = {
  id: 'mutex', title: 'Le verrou bloquant (mutex)', duration: dur('mutex'), audio: audio('mutex'), sync: SYNC.mutex, narration: narrationOf('mutex'),
  beats: [
    { on: 'Le verrou, ou mutex', text: 'Deux états : libre ou occupé' },
    { on: 'P2 le demande', text: 'P2 : Élu → Bloqué. Il entre dans la file, sans boucler' },
    { on: 'Un processus bloqué', text: 'Bloqué = pas de CPU consommé : le coût reste à zéro' },
    { on: 'Quand P1 libère', text: 'unlock : P2 est réveillé (Prêt) et reçoit le verrou' },
    { on: "Prêt n'est pas", text: 'Prêt ≠ Élu : P2 attend encore que l’ordonnanceur le choisisse' },
    { on: 'Contrairement', text: 'Pas d’attente active : aucun tour de CPU gaspillé' },
  ],
  cues: (at) => cuesOf(MUTEX, MUTEX_STEPS, at),
  render: ({ progress, at }) => <MachineView machines={MUTEX} steps={MUTEX_STEPS} progress={progress} at={at} />,
}

/* ------------------------------------------------------------------ */
/* 6 — sémaphores : P et V                                             */
/* ------------------------------------------------------------------ */
const SEM_STEPS: Step[] = [st(1, T('la valeur diminue', 0.2)), st(2, T('et le processus continue', 0.6)), st(3, T('Sinon', 0.5)), st(1, T('V, ou signal', 0.1)), st(1, T('Si un processus attend', 0.6))]
const SEM = compile({ ...defaults('sem'), n: 3, permits: 2 }, SEM_STEPS)

const sem: Scene = {
  id: 'sem', title: 'Les sémaphores : P et V', duration: dur('sem'), audio: audio('sem'), sync: SYNC.sem, narration: narrationOf('sem'),
  beats: [
    { on: 'Le sémaphore est', text: 'Un entier (autorisations disponibles) + une file d’attente' },
    { on: 'Il démarre', text: 'Valeur initiale ≥ 0 : ici S = 2' },
    { on: 'P, ou wait', text: 'P (wait) : demander une autorisation' },
    { on: 'la valeur diminue', text: 'S > 0 : S diminue de 1, le processus continue' },
    { on: 'Sinon', text: 'S = 0 : le processus est bloqué dans la file' },
    { on: 'V, ou signal', text: 'V (signal) : rendre une autorisation' },
    { on: 'Si un processus attend', text: 'Quelqu’un attend : il est réveillé et reçoit l’autorisation (S reste 0)' },
    { on: "Rien n'est", text: 'Invariant : S + autorisations détenues = total de départ' },
  ],
  cues: (at) => cuesOf(SEM, SEM_STEPS, at),
  render: ({ progress, at }) => <MachineView machines={SEM} steps={SEM_STEPS} progress={progress} at={at} />,
}

/* ------------------------------------------------------------------ */
/* 7 — sémaphore binaire                                               */
/* ------------------------------------------------------------------ */
const BIN_STEPS: Step[] = [st(1, T('P1 fait P', 0.7)), st(1, T('la valeur tombe', 0.8)), st(2, T('P2 fait P', 0.6)), st(1, T("l'autorisation passe", 0.8)), st(2, T('Un seul processus à la fois', 0.3)), st(2, T('est assurée', 0.5))]
const BIN = compile({ ...defaults('sem'), n: 2, permits: 1 }, BIN_STEPS)

const binary: Scene = {
  id: 'binary', title: 'Le sémaphore binaire', duration: dur('binary'), audio: audio('binary'), sync: SYNC.binary, narration: narrationOf('binary'),
  beats: [
    { on: 'Le sémaphore binaire', text: 'Initialisé à 1 : une seule autorisation' },
    { on: 'P1 fait P', text: 'P1 fait P : S passe de 1 à 0. P2 fait P : il est bloqué' },
    { on: "l'autorisation passe", text: 'V : l’autorisation passe directement à P2' },
    { on: 'Attention', text: 'Binaire ≠ mutex : le mutex a un propriétaire' },
    { on: "Un sémaphore n'en a pas", text: 'Un sémaphore n’a pas de propriétaire : tout processus peut faire V' },
  ],
  cues: (at) => [...cuesOf(BIN, BIN_STEPS, at), ...cue(at, 'Attention', 0.2, 'move', { gain: 0.5 })],
  render: ({ progress, at }) => {
    const over = fade(progress, at, 'Attention', 0, 0.8)
    const own = fade(progress, at, "Un sémaphore n'en a pas", 0, 0.8)
    return (
      <div className="relative h-full w-full">
        <div className="h-full w-full transition-opacity" style={{ opacity: 1 - 0.85 * over }}>
          <MachineView
            machines={BIN} steps={BIN_STEPS} progress={progress} at={at} hideCost
            top={(m) => {
              const last = m.log[m.log.length - 1]
              const active = !last ? -1 : last.kind === 'acquire' ? 0 : last.kind === 'use' ? 1 : last.kind === 'release' || last.kind === 'wake' ? 2 : 0
              return <SeqStrip active={active} />
            }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4 px-2 max-md:flex-col" style={{ opacity: over }}>
          <div className="w-full max-w-[330px] rounded-3xl border border-white/15 bg-[#12142a]/95 p-5">
            <div className="flex items-center gap-2 font-display text-[16px]"><Lock size={18} className="text-[var(--accent)]" /> Mutex</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/75">Un <b>propriétaire</b> : celui qui verrouille doit déverrouiller. Un autre processus ne peut pas le libérer à sa place.</p>
          </div>
          <div className="w-full max-w-[330px] rounded-3xl border bg-[#12142a]/95 p-5" style={{ opacity: 0.3 + 0.7 * own, borderColor: own > 0.5 ? 'rgba(94,234,212,.6)' : 'rgba(255,255,255,.15)' }}>
            <div className="flex items-center gap-2 font-display text-[16px]"><Signal size={18} className="text-[var(--mint)]" /> Sémaphore binaire</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/75"><b>Pas de propriétaire</b> : n’importe quel processus peut faire V. Plus souple (signalement entre processus), mais plus facile à mal utiliser.</p>
          </div>
        </div>
      </div>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 8 — sémaphore de comptage                                           */
/* ------------------------------------------------------------------ */
const CNT_STEPS: Step[] = [
  ...[0, 1, 2].map((i) => st(i + 1, spread(T('Les trois premiers', 0.4), T('la valeur tombe', 0.4), i, 3))),
  st(4, T('Le quatrième fait P', 1.0)), st(1, T('Quand un processus', 0.2)), st(1, T('il fait V', 0.4)), st(4, T('le quatrième continue', 0.2)),
]
const CNT = compile({ ...defaults('sem'), n: 4, permits: 3, resource: 'printers' }, CNT_STEPS)

const counting: Scene = {
  id: 'counting', title: 'Le sémaphore de comptage', duration: dur('counting'), audio: audio('counting'), sync: SYNC.counting, narration: narrationOf('counting'),
  beats: [
    { on: 'Trois imprimantes', text: '3 imprimantes identiques → S = 3' },
    { on: 'Les trois premiers', text: 'Trois P successifs : trois imprimantes prises, S = 0' },
    { on: 'Le quatrième fait P', text: 'S = 0 : le 4e processus est bloqué dans la file' },
    { on: 'Quand un processus', text: 'V : une imprimante est libérée et transmise au 4e processus' },
    { on: 'Le sémaphore de comptage', text: 'Jamais plus de 3 utilisateurs en même temps' },
  ],
  cues: (at) => cuesOf(CNT, CNT_STEPS, at),
  render: ({ progress, at }) => <MachineView machines={CNT} steps={CNT_STEPS} progress={progress} at={at} hideCost />,
}

/* ------------------------------------------------------------------ */
/* 9 — comparaison                                                     */
/* ------------------------------------------------------------------ */
const compare: Scene = {
  id: 'compare', title: 'Comparer les mécanismes', duration: dur('compare'), audio: audio('compare'), sync: SYNC.compare, narration: narrationOf('compare'),
  beats: [
    { on: 'Comparons', text: 'Cinq approches, un même problème' },
    { on: 'Spinlock', text: 'Correct, mais le CPU tourne pour rien pendant l’attente' },
    { on: 'Sémaphore binaire', text: 'Bloquant ne veut pas dire compliqué : la file s’occupe de tout' },
    { on: 'À vous de jouer', text: 'Testez chaque mécanisme dans le laboratoire' },
  ],
  cues: (at) => ['Sans protection', 'Spinlock', 'Mutex bloquant', 'Sémaphore binaire', 'Sémaphore de comptage'].flatMap((p, i) => cue(at, p, 0.2, 'appear', { pitch: i, gain: 0.55 })).concat(cue(at, 'À vous de jouer', 0.3, 'appear', { pitch: 5, gain: 0.9 })),
  render: ({ progress, at, actions }) => {
    const cta = fade(progress, at, 'À vous de jouer', 0, 0.6)
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <div className="w-full"><CompareTable progress={progress} at={at} /></div>
        <div className="flex shrink-0 justify-center" style={{ opacity: cta, transform: `translateY(${(1 - cta) * 10}px)`, pointerEvents: cta > 0.5 ? 'auto' : 'none' }}>
          <button onClick={actions.goExplore} className="btn-primary">Essayer le laboratoire <ArrowRight size={18} /></button>
        </div>
      </div>
    )
  },
}

export const scenes: Scene[] = [race, critical, spin, irq, mutex, sem, binary, counting, compare]

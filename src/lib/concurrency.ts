/**
 * Moteur de concurrence (leçon « Exclusion mutuelle ») — pur, sans React ni horloge.
 *
 * Un CPU, des processus qui exécutent chacun UNE instruction par pas. L'ordre des pas (l'entrelacement) est choisi
 * par un ordonnanceur automatique (`pick`) ou à la main : le résultat dépend réellement de cet ordre.
 *
 * Quatre scénarios :
 *  - race  : retrait sur un solde partagé, sans protection (lire → calculer → écrire, non atomique) ;
 *  - spin  : verrou à attente ACTIVE. Variante atomique (Test and Set) ou variante fautive (tester puis écrire) ;
 *  - mutex : verrou BLOQUANT : file d'attente, le processus bloqué n'est plus ordonnancé, le déblocage le rend Prêt
 *            (pas Élu) et lui transmet le verrou ;
 *  - sem   : sémaphore (valeur ≥ 0 = autorisations disponibles + file). Invariant : valeur + détenues = total initial.
 *
 * États des processus, cohérents avec la leçon « Cycle de vie » : ready (Prêt), running (Élu), blocked (Bloqué), done.
 * Un processus qui fait de l'attente active reste Prêt/Élu (il consomme du CPU) ; seul l'attente bloquante donne Bloqué.
 */
export type Scenario = 'race' | 'spin' | 'mutex' | 'sem'
export type CState = 'ready' | 'running' | 'blocked' | 'done'
export type Policy = 'alternate' | 'sequential'
export type EvKind = 'read' | 'calc' | 'write' | 'acquire' | 'refuse' | 'release' | 'block' | 'wake' | 'use' | 'test'
export type Op = 'lire' | 'calc' | 'ecrire' | 'tas' | 'test' | 'set' | 'release' | 'lock' | 'unlock' | 'P' | 'use' | 'V'

export interface Params {
  scenario: Scenario
  /** nombre de processus */
  n: number
  /** spin : true = Test and Set atomique ; false = « tester puis écrire » en deux instructions (fautif) */
  atomic: boolean
  /** sem : nombre initial d'autorisations */
  permits: number
  /** sem : vocabulaire (imprimantes ou ressource générique) */
  resource: 'generic' | 'printers'
  balance: number
  amounts: number[]
}

export interface CProc {
  id: number
  name: string
  amount: number
  pc: number
  tmp: number | null
  state: CState
  /** tentatives d'attente active (TAS / test échoués) */
  spins: number
  /** la dernière instruction de ce processus était une tentative refusée */
  spinning: boolean
}

export interface LogEntry { tick: number; pid: number; kind: EvKind; text: string }

export interface Machine {
  params: Params
  procs: CProc[]
  balance: number
  lock: 0 | 1
  owner: number | null
  queue: number[]
  value: number
  holders: number[]
  running: number | null
  last: number | null
  tick: number
  wasted: number
  /** a-t-on déjà vu deux processus (ou plus que permis) dans la section critique ? */
  violation: boolean
  log: LogEntry[]
}

export const DEFAULT_AMOUNTS = [30, 50, 10, 20, 40]

export const defaults = (scenario: Scenario): Params => ({
  scenario, n: scenario === 'sem' ? 4 : 2, atomic: true, permits: scenario === 'sem' ? 1 : 1, resource: 'generic', balance: 100, amounts: DEFAULT_AMOUNTS,
})

export function ops(p: Params): Op[] {
  switch (p.scenario) {
    case 'race': return ['lire', 'calc', 'ecrire']
    case 'spin': return p.atomic ? ['tas', 'lire', 'calc', 'ecrire', 'release'] : ['test', 'set', 'lire', 'calc', 'ecrire', 'release']
    case 'mutex': return ['lock', 'lire', 'calc', 'ecrire', 'unlock']
    case 'sem': return ['P', 'use', 'V']
  }
}

/** Indices (inclus) du programme situés dans la section critique : le processus y est entré, pas encore sorti */
export function csRange(p: Params): [number, number] {
  switch (p.scenario) {
    case 'race': return [1, 2]
    case 'spin': return p.atomic ? [1, 4] : [2, 5]
    case 'mutex': return [1, 4]
    case 'sem': return [1, 2]
  }
}

/** Nombre de processus autorisés ensemble dans la section critique (hors scénario sans protection) */
export const csLimit = (p: Params) => (p.scenario === 'sem' ? p.permits : 1)

export function init(params: Params): Machine {
  const procs: CProc[] = Array.from({ length: params.n }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, amount: params.amounts[i] ?? 10, pc: 0, tmp: null, state: 'ready', spins: 0, spinning: false }))
  return { params, procs, balance: params.balance, lock: 0, owner: null, queue: [], value: params.permits, holders: [], running: null, last: null, tick: 0, wasted: 0, violation: false, log: [] }
}

export const expected = (p: Params) => p.balance - p.amounts.slice(0, p.n).reduce((a, b) => a + b, 0)
export const inCS = (m: Machine): number[] => {
  const [a, b] = csRange(m.params)
  return m.procs.filter((p) => p.state !== 'done' && p.pc >= a && p.pc <= b).map((p) => p.id)
}
export const finished = (m: Machine) => m.procs.every((p) => p.state === 'done')
export const runnable = (m: Machine) => m.procs.filter((p) => p.state === 'ready' || p.state === 'running')
export const stuck = (m: Machine) => !finished(m) && runnable(m).length === 0

/** Prochain processus choisi par l'ordonnanceur automatique */
export function pick(m: Machine, policy: Policy): number | null {
  const r = runnable(m)
  if (r.length === 0) return null
  if (policy === 'sequential') return r[0].id
  const after = m.last ?? 0
  const sorted = [...r].sort((a, b) => ((a.id - after - 1 + m.procs.length) % m.procs.length) - ((b.id - after - 1 + m.procs.length) % m.procs.length))
  return sorted[0].id
}

export type StepResult = { ok: true; m: Machine; ev: LogEntry } | { ok: false; why: string }

const where = (m: Machine) => (m.params.scenario === 'mutex' ? 'la file du mutex' : 'la file du sémaphore')

export function step(m0: Machine, pid: number): StepResult {
  const src = m0.procs.find((p) => p.id === pid)
  if (!src) return { ok: false, why: 'Ce processus n’existe pas.' }
  if (src.state === 'done') return { ok: false, why: `${src.name} a terminé son programme : il n’a plus d’instruction à exécuter.` }
  if (src.state === 'blocked') return { ok: false, why: `${src.name} est Bloqué dans ${where(m0)} : l’ordonnanceur ne lui donne pas le CPU tant qu’il n’est pas réveillé (par ${m0.params.scenario === 'mutex' ? 'unlock' : 'V'}).` }

  const m: Machine = { ...m0, procs: m0.procs.map((p) => ({ ...p })), queue: [...m0.queue], holders: [...m0.holders], log: m0.log }
  const p = m.procs.find((x) => x.id === pid)!
  const program = ops(m.params)
  const op = program[p.pc]
  let kind: EvKind = 'use'
  let text = ''
  const attempt = () => { p.spins++; p.spinning = true; m.wasted++ }
  const wake = (id: number) => { const q = m.procs.find((x) => x.id === id)!; q.state = 'ready'; q.pc++; return q }

  switch (op) {
    case 'lire': p.tmp = m.balance; p.pc++; kind = 'read'; text = `${p.name} lit le solde : ${p.tmp} $`; break
    case 'calc': { const old = p.tmp ?? 0; p.tmp = old - p.amount; p.pc++; kind = 'calc'; text = `${p.name} calcule ${old} − ${p.amount} = ${p.tmp} $`; break }
    case 'ecrire': m.balance = p.tmp ?? 0; p.pc++; kind = 'write'; text = `${p.name} écrit ${p.tmp} $ dans le solde`; break
    case 'tas': {
      const old = m.lock
      m.lock = 1 // Test and Set : lit l'ancienne valeur ET met 1, d'un seul bloc
      if (old === 0) { m.owner = pid; p.pc++; p.spinning = false; kind = 'acquire'; text = `${p.name} : TAS lit 0 et met 1 → verrou obtenu` }
      else { attempt(); kind = 'refuse'; text = `${p.name} : TAS lit 1 → verrou occupé, nouvelle tentative (n° ${p.spins})` }
      break
    }
    case 'test':
      if (m.lock === 0) { p.pc++; p.spinning = false; kind = 'test'; text = `${p.name} lit verrou = 0 : il croit pouvoir entrer` }
      else { attempt(); kind = 'refuse'; text = `${p.name} lit verrou = 1 : il attend (tentative n° ${p.spins})` }
      break
    case 'set': m.lock = 1; m.owner = pid; p.pc++; kind = 'acquire'; text = `${p.name} écrit verrou = 1 et entre`; break
    case 'release': m.lock = 0; m.owner = null; p.pc++; kind = 'release'; text = `${p.name} libère le verrou (verrou = 0)`; break
    case 'lock':
      if (m.owner === null) { m.owner = pid; p.pc++; kind = 'acquire'; text = `${p.name} verrouille le mutex : il est libre, il l’obtient` }
      else { m.queue.push(pid); p.state = 'blocked'; kind = 'block'; text = `${p.name} demande le mutex, pris par P${m.owner} : bloqué, placé dans la file (aucun test répété)` }
      break
    case 'unlock': {
      if (m.owner !== pid) return { ok: false, why: `Seul le propriétaire du mutex (P${m.owner}) peut le libérer.` }
      if (m.queue.length) { const next = m.queue.shift()!; m.owner = next; const q = wake(next); kind = 'wake'; text = `${p.name} libère le mutex : ${q.name} est réveillé (Prêt, pas Élu) et reçoit le verrou` }
      else { m.owner = null; kind = 'release'; text = `${p.name} libère le mutex : personne n’attend` }
      p.pc++
      break
    }
    case 'P':
      if (m.value > 0) { m.value--; m.holders.push(pid); p.pc++; kind = 'acquire'; text = `${p.name} fait P : valeur ${m.value + 1} → ${m.value}, il passe` }
      else { m.queue.push(pid); p.state = 'blocked'; kind = 'block'; text = `${p.name} fait P : valeur 0, aucune autorisation → bloqué dans la file` }
      break
    case 'use': p.pc++; kind = 'use'; text = `${p.name} utilise la ressource`; break
    case 'V': {
      if (!m.holders.includes(pid)) return { ok: false, why: `${p.name} ne détient aucune autorisation : un V sans P créerait une autorisation de trop.` }
      m.holders.splice(m.holders.indexOf(pid), 1)
      if (m.queue.length) { const next = m.queue.shift()!; m.holders.push(next); const q = wake(next); kind = 'wake'; text = `${p.name} fait V : ${q.name} est réveillé (Prêt) et reçoit l’autorisation, la valeur reste ${m.value}` }
      else { m.value++; kind = 'release'; text = `${p.name} fait V : personne n’attend, valeur ${m.value - 1} → ${m.value}` }
      p.pc++
      break
    }
  }
  if (kind !== 'refuse' && kind !== 'test') p.spinning = false

  if (p.state !== 'blocked' && p.pc >= program.length) p.state = 'done'
  // CPU : le processus qui vient de s'exécuter est Élu ; l'ancien Élu repasse Prêt (préemption entre deux instructions)
  for (const q of m.procs) if (q.id !== pid && q.state === 'running') q.state = 'ready'
  if (p.state !== 'blocked' && p.state !== 'done') p.state = 'running'
  m.running = p.state === 'running' ? pid : null
  m.last = pid
  m.tick = m0.tick + 1
  const ev: LogEntry = { tick: m.tick, pid, kind, text }
  m.log = [...m0.log, ev]
  if (inCS(m).length > csLimit(m.params)) m.violation = true
  return { ok: true, m, ev }
}

/** Invariants à ne jamais voir violés : renvoie la liste des anomalies (vide = tout va bien) */
export function check(m: Machine): string[] {
  const out: string[] = []
  const { scenario, permits } = m.params
  if (scenario === 'sem') {
    if (m.value < 0) out.push('valeur négative')
    if (m.value + m.holders.length !== permits) out.push(`autorisations perdues ou créées : ${m.value} + ${m.holders.length} ≠ ${permits}`)
    if (m.holders.length > permits) out.push('plus de détenteurs que d’autorisations')
    if (m.value > 0 && m.queue.length) out.push('des processus attendent alors que des autorisations sont libres')
  }
  if (scenario === 'mutex') {
    if (m.owner !== null && m.queue.includes(m.owner)) out.push('le propriétaire est dans la file')
    if (m.owner === null && m.queue.length) out.push('mutex libre mais des processus attendent')
  }
  for (const q of m.queue) if (m.procs[q - 1].state !== 'blocked') out.push(`${q} est dans la file sans être Bloqué`)
  if (m.procs.filter((p) => p.state === 'running').length > 1) out.push('deux processus Élus')
  return out
}

/**
 * Moteur d'allocation mémoire contiguë (leçon « Allocation et fragmentation ») — pur, sans React ni animation.
 *
 * La RAM est une suite de blocs contigus qui couvre exactement [0, capacité[ (unité : Mo) :
 *  - 'os'   : zone réservée au système, au début ;
 *  - 'free' : zone libre ;
 *  - 'proc' : zone attribuée à un processus (`used` = ce que le processus utilise vraiment).
 *
 * Deux modes :
 *  - variable : la taille d'une zone suit la demande. Une zone libre est découpée à l'allocation ;
 *    à la libération, les zones libres voisines FUSIONNENT ;
 *  - fixed    : la RAM est découpée à l'avance en partitions de tailles données. Une partition reçoit un seul
 *    processus, sans jamais être découpée : `size − used` est de la fragmentation interne.
 *
 * Quatre stratégies de choix d'une zone libre : first, next, best, worst (voir `choose`).
 */
export type Strategy = 'first' | 'next' | 'best' | 'worst'
export type Mode = 'variable' | 'fixed'
export type Kind = 'os' | 'free' | 'proc'

export interface Block { start: number; size: number; kind: Kind; pid?: number; used?: number }
export interface Mem {
  mode: Mode
  capacity: number
  blocks: Block[]
  /** Next Fit : adresse où reprendre la recherche (fin de la dernière allocation) */
  rover: number
}

export const STRATEGY_LABEL: Record<Strategy, string> = { first: 'First Fit', next: 'Next Fit', best: 'Best Fit', worst: 'Worst Fit' }
export const STRATEGIES: Strategy[] = ['first', 'next', 'best', 'worst']

export function makeMem(mode: Mode, capacity: number, os: number, partitions?: number[]): Mem {
  const user = capacity - os
  const blocks: Block[] = [{ start: 0, size: os, kind: 'os' }]
  if (mode === 'fixed') {
    const parts = partitions && partitions.length ? partitions : [user]
    let at = os
    for (const p of parts) { blocks.push({ start: at, size: p, kind: 'free' }); at += p }
  } else if (user > 0) blocks.push({ start: os, size: user, kind: 'free' })
  return { mode, capacity, blocks, rover: os }
}

const clone = (m: Mem): Mem => ({ ...m, blocks: m.blocks.map((b) => ({ ...b })) })
const end = (b: Block) => b.start + b.size

export const find = (m: Mem, pid: number) => m.blocks.find((b) => b.kind === 'proc' && b.pid === pid)
export const freeBlocks = (m: Mem) => m.blocks.filter((b) => b.kind === 'free')

export interface Stats {
  capacity: number
  os: number
  /** mémoire attribuée (zones 'proc', partitions entières en mode fixe) */
  allocated: number
  /** mémoire réellement utilisée par les processus */
  used: number
  free: number
  largestFree: number
  holes: number
  /** fragmentation interne : attribué mais inutilisé */
  internal: number
  /** fragmentation externe : 1 − plus grande zone libre / mémoire libre (0 si rien de libre) */
  external: number
}

export function stats(m: Mem): Stats {
  const os = m.blocks.filter((b) => b.kind === 'os').reduce((a, b) => a + b.size, 0)
  const procs = m.blocks.filter((b) => b.kind === 'proc')
  const allocated = procs.reduce((a, b) => a + b.size, 0)
  const used = procs.reduce((a, b) => a + (b.used ?? b.size), 0)
  const fr = freeBlocks(m)
  const free = fr.reduce((a, b) => a + b.size, 0)
  const largestFree = fr.reduce((a, b) => Math.max(a, b.size), 0)
  return { capacity: m.capacity, os, allocated, used, free, largestFree, holes: fr.length, internal: allocated - used, external: free > 0 ? 1 - largestFree / free : 0 }
}

/** Zones libres dans l'ordre où la stratégie les examine, jusqu'à celle qu'elle retient (ou toutes si aucune ne convient) */
export interface Choice { block: Block | null; visited: Block[] }

export function choose(m: Mem, size: number, strategy: Strategy): Choice {
  const free = freeBlocks(m)
  if (strategy === 'first') {
    const visited: Block[] = []
    for (const b of free) { visited.push(b); if (b.size >= size) return { block: b, visited } }
    return { block: null, visited }
  }
  if (strategy === 'next') {
    // on reprend à `rover`, puis retour au début de la mémoire si nécessaire
    const order = [...free.filter((b) => b.start >= m.rover), ...free.filter((b) => b.start < m.rover)]
    const visited: Block[] = []
    for (const b of order) { visited.push(b); if (b.size >= size) return { block: b, visited } }
    return { block: null, visited }
  }
  // best / worst examinent TOUTES les zones libres
  const fit = free.filter((b) => b.size >= size)
  if (fit.length === 0) return { block: null, visited: free }
  let pick = fit[0]
  for (const b of fit) if (strategy === 'best' ? b.size < pick.size : b.size > pick.size) pick = b
  return { block: pick, visited: free }
}

export type FailReason = 'total' | 'contiguous' | 'partition-size' | 'partition-busy' | 'duplicate' | 'invalid'

export interface AllocOk { ok: true; mem: Mem; block: Block; visited: Block[]; leftover: number }
export interface AllocFail { ok: false; reason: FailReason; why: string; visited: Block[] }

export function explainFailure(m: Mem, size: number, visited: Block[] = []): AllocFail {
  const s = stats(m)
  if (m.mode === 'fixed' && s.holes === 0) {
    const n = m.blocks.filter((x) => x.kind !== 'os').length
    return { ok: false, reason: 'partition-busy', visited, why: `Toutes les partitions sont occupées : avec ${n} partition${n > 1 ? 's' : ''}, au plus ${n} processus peuvent être en mémoire en même temps. Le processus doit attendre qu'une partition se libère.` }
  }
  if (size > s.free) return { ok: false, reason: 'total', visited, why: `Mémoire insuffisante : il reste ${s.free} Mo libres au total, la demande est de ${size} Mo. Même un compactage ne changerait rien.` }
  if (m.mode === 'fixed') {
    const maxPart = m.blocks.filter((b) => b.kind !== 'os').reduce((a, b) => Math.max(a, b.size), 0)
    if (size > maxPart) return { ok: false, reason: 'partition-size', visited, why: `Aucune partition n'est assez grande : la plus grande fait ${maxPart} Mo, la demande est de ${size} Mo. Avec des partitions fixes, ce processus ne pourra jamais être chargé.` }
    return { ok: false, reason: 'partition-busy', visited, why: `Les partitions assez grandes (≥ ${size} Mo) sont toutes occupées, alors que ${s.free} Mo sont libres dans des partitions trop petites. Une partition ne se découpe pas.` }
  }
  return { ok: false, reason: 'contiguous', visited, why: `Fragmentation externe : ${s.free} Mo sont libres au total, mais la plus grande zone libre contiguë ne fait que ${s.largestFree} Mo (demande : ${size} Mo). L'allocation contiguë a besoin d'une seule zone.` }
}

export function allocate(m0: Mem, pid: number, size: number, strategy: Strategy): AllocOk | AllocFail {
  if (!Number.isInteger(size) || size <= 0) return { ok: false, reason: 'invalid', visited: [], why: 'La taille demandée doit être un entier positif (en Mo).' }
  if (find(m0, pid)) return { ok: false, reason: 'duplicate', visited: [], why: `P${pid} occupe déjà de la mémoire.` }
  const { block, visited } = choose(m0, size, strategy)
  if (!block) return explainFailure(m0, size, visited)
  const m = clone(m0)
  const i = m.blocks.findIndex((b) => b.start === block.start)
  const b = m.blocks[i]
  const leftover = b.size - size
  if (m.mode === 'fixed') {
    m.blocks[i] = { ...b, kind: 'proc', pid, used: size }
    m.rover = end(b)
  } else {
    const placed: Block = { start: b.start, size, kind: 'proc', pid, used: size }
    m.blocks.splice(i, 1, placed, ...(leftover > 0 ? [{ start: b.start + size, size: leftover, kind: 'free' as Kind }] : []))
    m.rover = b.start + size
  }
  normalizeRover(m)
  return { ok: true, mem: m, block: m.blocks[i], visited, leftover: m.mode === 'fixed' ? leftover : 0 }
}

export type ReleaseResult = { ok: true; mem: Mem; freed: Block; merged: boolean } | { ok: false; why: string }

export function release(m0: Mem, pid: number): ReleaseResult {
  const b0 = find(m0, pid)
  if (!b0) return { ok: false, why: `P${pid} n'occupe aucune zone mémoire : il n'y a rien à libérer.` }
  const m = clone(m0)
  const i = m.blocks.findIndex((b) => b.start === b0.start)
  m.blocks[i] = { start: b0.start, size: b0.size, kind: 'free' }
  let merged = false
  if (m.mode === 'variable') {
    // fusion avec les voisines libres (sinon les trous resteraient artificiellement séparés)
    for (let k = m.blocks.length - 2; k >= 0; k--) {
      if (m.blocks[k].kind === 'free' && m.blocks[k + 1].kind === 'free') { m.blocks[k] = { start: m.blocks[k].start, size: m.blocks[k].size + m.blocks[k + 1].size, kind: 'free' }; m.blocks.splice(k + 1, 1); merged = true }
    }
  }
  normalizeRover(m)
  return { ok: true, mem: m, freed: m.blocks.find((b) => b.kind === 'free' && b.start <= b0.start && end(b) >= end(b0))!, merged }
}

function normalizeRover(m: Mem) {
  const inside = m.blocks.find((b) => b.kind === 'free' && b.start < m.rover && m.rover < end(b))
  if (inside) m.rover = inside.start
  if (m.rover >= m.capacity) m.rover = m.blocks.find((b) => b.kind === 'os') ? end(m.blocks[0]) : 0
}

export interface Move { pid: number; from: number; to: number; size: number }
export type CompactResult = { ok: true; mem: Mem; moves: Move[]; cost: number } | { ok: false; why: string }

/** Compactage : déplace les zones occupées vers le bas pour regrouper les zones libres en une seule */
export function compact(m0: Mem): CompactResult {
  if (m0.mode !== 'variable') return { ok: false, why: 'Le compactage n’a pas de sens avec des partitions fixes : leurs limites sont définies à l’avance et ne bougent pas.' }
  const s = stats(m0)
  if (s.holes <= 1 && m0.blocks.filter((b) => b.kind !== 'os').slice(-1)[0]?.kind !== 'proc' ) {
    const lastProc = [...m0.blocks].reverse().find((b) => b.kind === 'proc')
    const free = freeBlocks(m0)[0]
    if (s.holes === 0 || (free && (!lastProc || free.start >= end(lastProc)))) return { ok: false, why: 'La mémoire est déjà compacte : toute la mémoire libre forme déjà une seule zone, il n’y a rien à déplacer.' }
  }
  if (s.holes === 0) return { ok: false, why: 'Il n’y a aucune zone libre : rien à regrouper.' }
  const os = m0.blocks.filter((b) => b.kind === 'os')
  const procs = m0.blocks.filter((b) => b.kind === 'proc')
  let at = os.reduce((a, b) => a + b.size, 0)
  const moves: Move[] = []
  const blocks: Block[] = os.map((b) => ({ ...b }))
  for (const p of procs) {
    blocks.push({ ...p, start: at })
    if (p.start !== at) moves.push({ pid: p.pid!, from: p.start, to: at, size: p.size })
    at += p.size
  }
  if (at < m0.capacity) blocks.push({ start: at, size: m0.capacity - at, kind: 'free' })
  if (moves.length === 0) return { ok: false, why: 'La mémoire est déjà compacte : aucun processus n’a besoin d’être déplacé.' }
  return { ok: true, mem: { ...m0, blocks, rover: at < m0.capacity ? at : m0.rover }, moves, cost: moves.reduce((a, x) => a + x.size, 0) }
}

/** Table de bits : une case par unité de `unit` Mo (1 = occupée, 0 = libre) ; une case partiellement occupée compte comme occupée */
export function bitmap(m: Mem, unit = 1): (0 | 1)[] {
  const n = Math.ceil(m.capacity / unit)
  return Array.from({ length: n }, (_, i) => {
    const a = i * unit, b = Math.min(m.capacity, a + unit)
    return m.blocks.some((x) => x.kind !== 'free' && x.start < b && end(x) > a) ? 1 : 0
  })
}

/** Liste chaînée : un nœud par zone (P = occupée, H = libre), avec adresse de départ et taille */
export const linkedList = (m: Mem) => m.blocks.map((b) => ({ type: b.kind === 'free' ? 'H' as const : 'P' as const, start: b.start, size: b.size, label: b.kind === 'os' ? 'SE' : b.kind === 'proc' ? `P${b.pid}` : '' }))

/* ------------------------------------------------------------------ */
/* Séquences d'opérations (comparaison des stratégies)                 */
/* ------------------------------------------------------------------ */
export type Op = { type: 'alloc'; pid: number; size: number } | { type: 'free'; pid: number }
export interface OpResult { op: Op; ok: boolean; why?: string; block?: Block; visited?: number }

/** Rejoue la même séquence avec une stratégie : renvoie la mémoire après chaque opération (mems[0] = départ) */
export function runOps(base: Mem, ops: Op[], strategy: Strategy): { mems: Mem[]; results: OpResult[] } {
  const mems = [base]
  const results: OpResult[] = []
  let cur = base
  for (const op of ops) {
    if (op.type === 'alloc') {
      const r = allocate(cur, op.pid, op.size, strategy)
      if (r.ok) { cur = r.mem; results.push({ op, ok: true, block: r.block, visited: r.visited.length }) }
      else results.push({ op, ok: false, why: r.why, visited: r.visited.length })
    } else {
      const r = release(cur, op.pid)
      if (r.ok) { cur = r.mem; results.push({ op, ok: true }) }
      else results.push({ op, ok: false, why: r.why })
    }
    mems.push(cur)
  }
  return { mems, results }
}

/** Anomalies de cohérence (liste vide = mémoire valide) */
export function check(m: Mem): string[] {
  const out: string[] = []
  let at = 0
  const pids = new Set<number>()
  for (const b of m.blocks) {
    if (b.size <= 0) out.push(`zone de taille ${b.size} en ${b.start}`)
    if (b.start !== at) out.push(`trou ou chevauchement : la zone commence en ${b.start}, attendu ${at}`)
    at = b.start + b.size
    if (b.kind === 'proc') {
      if (b.pid === undefined) out.push('zone occupée sans processus')
      else if (pids.has(b.pid)) out.push(`P${b.pid} apparaît deux fois`)
      else pids.add(b.pid)
      if ((b.used ?? b.size) > b.size) out.push(`P${b.pid} utilise plus que sa zone`)
      if (m.mode === 'variable' && b.used !== b.size) out.push(`P${b.pid} : zone ≠ taille demandée en partitions variables`)
    }
  }
  if (at !== m.capacity) out.push(`la mémoire couvre ${at} Mo au lieu de ${m.capacity}`)
  if (m.mode === 'variable') for (let i = 1; i < m.blocks.length; i++) if (m.blocks[i].kind === 'free' && m.blocks[i - 1].kind === 'free') out.push(`deux zones libres voisines non fusionnées en ${m.blocks[i].start}`)
  return out
}

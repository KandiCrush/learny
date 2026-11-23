import type { PhraseAt } from '../../lib/clock'
import { easeInOut } from '../../lib/math'
import { type DrawBlock, memColor } from '../../components/MemoryBar'
import { type Mem, STRATEGIES, allocate, compact, makeMem, release, runOps } from '../../lib/memory'

/**
 * UNE seule histoire : la même RAM (32 Mo, dont 4 pour le système) et les mêmes processus P1… P9 de la première à
 * la dernière scène. Tous les états ci-dessous viennent du MOTEUR (src/lib/memory.ts) : les scènes ne font que les
 * animer, elles ne décident rien.
 */
export const CAP = 32
export const OS = 4
export const SIZE: Record<number, number> = { 1: 5, 2: 7, 3: 10, 4: 9, 5: 1, 6: 2, 7: 6, 8: 4, 9: 4 }

const alloc = (m: Mem, pid: number): Mem => {
  const r = allocate(m, pid, SIZE[pid], 'first')
  if (!r.ok) throw new Error(`histoire invalide (P${pid}) : ${r.why}`)
  return r.mem
}
const free = (m: Mem, pid: number): Mem => {
  const r = release(m, pid)
  if (!r.ok) throw new Error(`histoire invalide (P${pid}) : ${r.why}`)
  return r.mem
}

/** Scène 1 : trois processus se partagent la RAM */
export const M1 = alloc(alloc(alloc(makeMem('variable', CAP, OS), 1), 2), 3)
/** Scène 2 : partitions fixes 8 / 8 / 12 */
export const PARTS = [8, 8, 12]
export const F1 = alloc(alloc(alloc(makeMem('fixed', CAP, OS, PARTS), 1), 2), 3)
/** Scène 3 : P2 termine → deux trous séparés (7 et 6) ; P4 (9) ne trouve pas de zone */
export const M3 = free(M1, 2)
/** Scène 4 : compactage, puis P4 entre */
const compacted = compact(M3)
if (!compacted.ok) throw new Error('compactage impossible')
export const M4a = compacted.mem
export const COMPACT_COST = compacted.cost
export const COMPACT_MOVES = compacted.moves
export const M4 = alloc(M4a, 4)
/** Scène 6 : le temps passe (P3 part, P5 arrive, P1 part) → trous de 5, 9 et 4 Mo */
export const M5a = free(M4, 3)
export const M5b = alloc(M5a, 5)
export const M6 = free(M5b, 1)
/** Les quatre stratégies reçoivent EXACTEMENT les mêmes demandes */
export const REQ = [6, 7, 8, 9]
export const OPS = REQ.map((pid) => ({ type: 'alloc' as const, pid, size: SIZE[pid] }))
export const RUNS = Object.fromEntries(STRATEGIES.map((s) => [s, runOps(M6, OPS, s)])) as Record<(typeof STRATEGIES)[number], ReturnType<typeof runOps>>

/* ------------------------------------------------------------------ */
/* Places : où est chaque processus (zone d'attente ou RAM)            */
/* ------------------------------------------------------------------ */
export interface Place { lane: number; start: number; size: number; part: number; o: number; waste: number }
export type Layout = Record<string, Place>
export const WAIT_DY = -112

export const key = (pid: number) => `p${pid}`
export const off = (pid: number, start: number): Place => ({ lane: 0, start, size: SIZE[pid], part: 0, o: 0, waste: 0 })
export const waiting = (pid: number, start: number): Place => ({ lane: 0, start, size: SIZE[pid], part: 0, o: 1, waste: 0 })

/** Places des processus qui sont dans la RAM d'une mémoire du moteur */
export function placesOf(m: Mem): Layout {
  const out: Layout = {}
  for (const b of m.blocks) if (b.kind === 'proc') out[key(b.pid!)] = { lane: 1, start: b.start, size: b.used ?? b.size, part: m.mode === 'fixed' ? b.size : 0, o: 1, waste: 0 }
  return out
}

export interface FrameDef { on: string; delay?: number; len?: number; to: Record<string, Partial<Place>> }
export interface Frame { start: number; end: number; to: Record<string, Partial<Place>> }

export function resolveFrames(defs: FrameDef[], at: PhraseAt): Frame[] {
  const out: Frame[] = []
  for (const d of defs) {
    const start = at(d.on, d.delay ?? 0.2), end = at(d.on, (d.delay ?? 0.2) + (d.len ?? 1.2))
    if (start == null || end == null) { if (import.meta.env?.DEV) console.warn(`[memory] expression introuvable : « ${d.on} »`); continue }
    if (out.length && start < out[out.length - 1].start) continue
    out.push({ start, end: Math.max(end, start + 1e-4), to: d.to })
  }
  return out
}

const mix = (a: Place, b: Place, u: number): Place => {
  const k = easeInOut(u)
  const l = (x: number, y: number) => x + (y - x) * k
  const pa = a.part || a.size, pb = b.part || b.size
  return { lane: l(a.lane, b.lane), start: l(a.start, b.start), size: l(a.size, b.size), part: b.part ? l(pa, pb) : (a.part ? l(pa, pb) : 0), o: l(a.o, b.o), waste: l(a.waste, b.waste) }
}

/** Place du processus `id` à cet instant (interpolée) + « halo » pendant qu'il bouge */
export function placeAt(id: string, init: Place, frames: Frame[], progress: number): { place: Place; moving: number } {
  let cur = init
  for (const f of frames) {
    const t = f.to[id]
    if (!t) continue
    if (progress < f.start) break
    const next: Place = { ...cur, ...t }
    const u = (progress - f.start) / (f.end - f.start)
    if (u < 1) {
      const moved = next.lane !== cur.lane || next.start !== cur.start || next.size !== cur.size
      return { place: mix(cur, next, u), moving: moved ? Math.sin(Math.PI * u) : 0 }
    }
    cur = next
  }
  return { place: cur, moving: 0 }
}

/** Blocs à dessiner (système + processus) à partir des places interpolées */
export function blocksAt(ids: number[], init: Layout, frames: Frame[], progress: number): DrawBlock[] {
  const out: DrawBlock[] = [{ id: 'os', kind: 'os', label: 'SE', color: '#8a90b5', start: 0, size: OS }]
  for (const pid of ids) {
    const { place, moving } = placeAt(key(pid), init[key(pid)] ?? off(pid, 4), frames, progress)
    out.push({ id: key(pid), kind: 'proc', label: `P${pid}`, color: memColor(pid), start: place.start, size: place.size, part: place.part || undefined, o: place.o, dy: WAIT_DY * (1 - place.lane), glow: moving * 0.8, waste: place.waste })
  }
  return out
}

/** Blocs d'une mémoire du moteur (laboratoire et lignes de stratégies) */
export function blocksOfMem(m: Mem, born: Record<number, number> = {}): DrawBlock[] {
  const out: DrawBlock[] = []
  for (const b of m.blocks) {
    if (b.kind === 'os') out.push({ id: 'os', kind: 'os', label: 'SE', color: '#8a90b5', start: b.start, size: b.size })
    else if (b.kind === 'proc') {
      const u = born[b.pid!] ?? 1
      out.push({ id: key(b.pid!), kind: 'proc', label: `P${b.pid}`, color: memColor(b.pid!), start: b.start, size: b.used ?? b.size, part: m.mode === 'fixed' ? b.size : undefined, o: Math.min(1, u * 2.5), dy: -26 * (1 - easeInOut(u)), glow: u < 1 ? 1 - u : 0, waste: 1 })
    }
  }
  return out
}

import type { PhraseAt } from '../../lib/clock'
import { clamp } from '../../lib/math'
import { type Machine, type Params, init, step } from '../../lib/concurrency'
import type { SoundCue } from '../types'

/**
 * Les scènes « machine » rejouent un SCRIPT : une suite d'instructions (quel processus avance) passée dans le vrai
 * moteur (lib/concurrency.ts). Chaque instruction a un instant, exprimé par une expression de la narration (+ délai) :
 * la scène affiche l'état du moteur après les instructions déjà « dites » par la voix.
 */
export type TimeFn = (at: PhraseAt) => number | null
export interface Step { pid: number; t: TimeFn }

/** instant = expression de la voix + délai en secondes (toujours ≥ 0 : l'image ne devance jamais la voix) */
export const T = (on: string, off = 0): TimeFn => (at) => at(on, off)
/** i-ème (sur k) instant régulièrement espacé entre deux repères */
export const spread = (from: TimeFn, to: TimeFn, i: number, k: number): TimeFn => (at) => {
  const a = from(at), b = to(at)
  return a == null || b == null ? null : a + ((b - a) * (i + 1)) / (k + 1)
}

/** États successifs du moteur : machines[0] = départ, machines[i] = après la i-ème instruction */
export function compile(params: Params, steps: Step[]): Machine[] {
  const out = [init(params)]
  for (const s of steps) {
    const r = step(out[out.length - 1], s.pid)
    if (!r.ok) throw new Error(`script invalide (P${s.pid}) : ${r.why}`)
    out.push(r.m)
  }
  return out
}

/** Durée (en progression) du halo qui suit une instruction */
const PULSE = 0.03

export function playhead(machines: Machine[], steps: Step[], progress: number, at: PhraseAt): { m: Machine; idx: number; pulse: number } {
  let prev = -Infinity
  const times = steps.map((s) => { const t = s.t(at); if (t == null && import.meta.env?.DEV) console.warn('[mutex] expression introuvable dans une instruction du script'); prev = Math.max(prev, t ?? Infinity); return prev })
  const idx = times.filter((t) => progress >= t).length
  const pulse = idx > 0 ? 1 - clamp((progress - times[idx - 1]) / PULSE) : 0
  return { m: machines[idx], idx, pulse }
}

/** Effets sonores déduits des événements du moteur (discrets : pas de son pour lire / calculer / écrire) */
export function cuesOf(machines: Machine[], steps: Step[], at: PhraseAt): SoundCue[] {
  const out: SoundCue[] = []
  let prev = -Infinity, refused = 0
  steps.forEach((s, i) => {
    const t = s.t(at); prev = Math.max(prev, t ?? Infinity)
    if (!Number.isFinite(prev)) return
    const ev = machines[i + 1].log[machines[i + 1].log.length - 1]
    if (ev.kind === 'acquire') out.push({ at: prev, sound: 'enter', gain: 0.8 })
    else if (ev.kind === 'refuse') { if (refused++ < 3) out.push({ at: prev, sound: 'move', gain: 0.3 }) }
    else if (ev.kind === 'release') out.push({ at: prev, sound: 'done', gain: 0.6 })
    else if (ev.kind === 'block') out.push({ at: prev, sound: 'move', gain: 0.7 })
    else if (ev.kind === 'wake') out.push({ at: prev, sound: 'appear', pitch: 3, gain: 0.8 })
  })
  return out
}

/** Apparition progressive (0 → 1) à partir d'une expression de la voix */
export const fade = (progress: number, at: PhraseAt, on: string, offsetSec = 0, lenSec = 0.8): number => {
  const a = at(on, offsetSec), b = at(on, offsetSec + lenSec)
  if (a == null || b == null) { if (import.meta.env?.DEV) console.warn(`[mutex] expression introuvable : « ${on} »`); return 0 }
  const u = clamp((progress - a) / Math.max(1e-4, b - a))
  return 1 - Math.pow(1 - u, 3)
}
/** Position (0 → 1) d'un déplacement qui commence à une expression et dure `lenSec` secondes */
export const move = (progress: number, at: PhraseAt, on: string, offsetSec = 0, lenSec = 1): number => {
  const a = at(on, offsetSec), b = at(on, offsetSec + lenSec)
  if (a == null || b == null) return 0
  const u = clamp((progress - a) / Math.max(1e-4, b - a))
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

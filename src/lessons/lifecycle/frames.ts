import type { PhraseAt } from '../../lib/clock'
import { mixPose, placePose, type Place, type Pose, type StageToken, type Zone } from '../../components/LifecycleStage'
import { STATE_COLOR } from '../../components/LifecycleStage'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

/**
 * Déplacements des jetons dans une scène : une suite d'images clés « à telle expression de la voix, tel jeton
 * va à tel endroit ». Entre deux images, le déplacement dure `len` secondes (à partir de l'expression + `delay`).
 * Rien ne bouge avant que la voix ait dit son expression (jamais d'avance sur la voix).
 */
export type Layout = Record<string, Place>
export interface FrameDef { on: string; delay?: number; len?: number; layout: Layout }
export interface Frame { start: number; end: number; layout: Layout }

export const MOVE_SEC = 0.95

export function resolveFrames(defs: FrameDef[], at: PhraseAt): Frame[] {
  const out: Frame[] = []
  for (const d of defs) {
    const start = at(d.on, d.delay ?? 0.15)
    const end = at(d.on, (d.delay ?? 0.15) + (d.len ?? MOVE_SEC))
    if (start == null || end == null) { if (import.meta.env?.DEV) console.warn(`[lifecycle] expression introuvable : « ${d.on} »`); continue }
    if (out.length && start < out[out.length - 1].start) continue
    out.push({ start, end: Math.max(end, start + 1e-4), layout: d.layout })
  }
  return out
}

export interface Placed { pose: Pose; zone: Zone; place: Place; /** début du séjour dans la zone actuelle (progression) */ since: number; /** progression à laquelle le jeton quitte la zone, ou 1 */ until: number }

/** Où est le jeton `id` à cet instant ? (pose interpolée + zone courante) */
export function placeAt(id: string, init: Place, frames: Frame[], progress: number): Placed {
  let prev = init
  let since = 0
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    const next = f.layout[id]
    if (!next) continue
    if (progress < f.start) break
    const u = (progress - f.start) / (f.end - f.start)
    const moves = next.zone !== prev.zone || next.i !== prev.i || next.x !== prev.x || next.y !== prev.y
    if (u < 1) {
      return { pose: mixPose(placePose(prev), placePose(next), u), zone: u < 0.5 ? prev.zone : next.zone, place: u < 0.5 ? prev : next, since, until: f.start }
    }
    if (moves && next.zone !== prev.zone) since = f.end
    prev = next
  }
  // prochaine image qui concerne ce jeton avec un autre emplacement : fin du séjour
  let until = 1
  for (const f of frames) {
    const n = f.layout[id]
    if (n && f.start > progress && (n.zone !== prev.zone)) { until = f.start; break }
  }
  return { pose: placePose(prev), zone: prev.zone, place: prev, since, until }
}

export interface Actor { id: string; name: string; glyph: ComponentType<LucideProps>; color: string }

const SUB: Partial<Record<Zone, string>> = { queue: 'Prêt', cpu: 'Élu', blocked: 'Bloqué' }
const SUB_COLOR: Partial<Record<Zone, string>> = { queue: STATE_COLOR.ready, cpu: STATE_COLOR.running, blocked: STATE_COLOR.blocked }

export function buildTokens(actors: Actor[], init: Layout, frames: Frame[], progress: number, opts: { showState?: boolean; extra?: (id: string, p: Placed) => Partial<StageToken> } = {}): StageToken[] {
  return actors.map((a) => {
    const p = placeAt(a.id, init[a.id] ?? { zone: 'off' }, frames, progress)
    return {
      id: a.id, name: a.name, glyph: a.glyph, color: a.color, pose: p.pose,
      running: p.zone === 'cpu',
      sub: opts.showState ? SUB[p.zone] : undefined, subColor: SUB_COLOR[p.zone],
      ...opts.extra?.(a.id, p),
    }
  })
}

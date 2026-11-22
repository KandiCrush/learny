/**
 * Horloge de simulation calée sur la voix.
 * Les scènes animées par le temps simulé `t` (ordonnancement) ne doivent pas avancer à vitesse
 * constante : elles suivent la narration. On associe des expressions de la narration à des
 * instants simulés (« quand la voix dit "Quand P1 termine", t = 8 »), et on interpole entre.
 */
/** progression (0 → 1) à laquelle la voix dit `phrase`, décalée de `offsetSec` secondes (négatif = l'image PRÉCÈDE la voix) */
export type PhraseAt = (phrase: string, offsetSec?: number) => number | null
/** [expression, temps simulé, décalage en secondes (facultatif)] — le décalage sert à lisser la vitesse de l'animation */
export type Anchors = readonly (readonly [phrase: string, t: number, offsetSec?: number])[]

export interface Clock {
  /** progression de la scène (0 → 1) → temps simulé */
  t: (progress: number) => number
  /** temps simulé → progression de la scène */
  progress: (t: number) => number
}

/**
 * @param t0     temps simulé au début de la scène (-1 = « avant le départ », rien ne bouge)
 * @param total  durée simulée totale : sert de repli linéaire si aucun repère n'est retrouvé
 */
export function makeClock(anchors: Anchors, at: PhraseAt, t0: number, total: number): Clock {
  const pts: [number, number][] = [[0, t0]]
  for (const [phrase, t, offset] of anchors) {
    const p = at(phrase, offset ?? 0)
    const last = pts[pts.length - 1]
    if (p == null || p <= last[0] || t < last[1]) continue
    pts.push([p, t])
  }
  if (pts.length === 1) pts.push([0.9, total]) // repli : aucune expression retrouvée

  const t = (progress: number) => {
    const end = pts[pts.length - 1]
    if (progress >= end[0]) return end[1]
    for (let k = 1; k < pts.length; k++) {
      const [p0, t0_] = pts[k - 1], [p1, t1] = pts[k]
      if (progress <= p1) return t0_ + ((progress - p0) / (p1 - p0 || 1)) * (t1 - t0_)
    }
    return end[1]
  }
  const progress = (time: number) => {
    if (time <= pts[0][1]) return 0
    for (let k = 1; k < pts.length; k++) {
      const [p0, t0_] = pts[k - 1], [p1, t1] = pts[k]
      if (time <= t1) return t1 === t0_ ? p1 : p0 + ((time - t0_) / (t1 - t0_)) * (p1 - p0)
    }
    return pts[pts.length - 1][0]
  }
  return { t, progress }
}

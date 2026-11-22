/** Préférence « réduire les animations » : on garde les fondus, on supprime mouvements, flous et zooms. */
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Durée adaptée */
export const d = (s: number) => (reducedMotion() ? Math.min(s, 0.15) : s)

/** Ne garde que l'opacité d'un état de départ si les animations sont réduites */
export function soften<T extends Record<string, unknown>>(from: T): Partial<T> {
  if (!reducedMotion()) return from
  return { opacity: (from.opacity as number) ?? 0 } as unknown as Partial<T>
}

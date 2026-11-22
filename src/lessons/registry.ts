import type { Lesson } from './types'

/**
 * Pour ajouter une leçon :
 *  1. créer src/lessons/<ma-lecon>/index.tsx qui exporte un objet `Lesson`
 *  2. déclarer son chargeur et ses métadonnées ici
 *  3. la référencer (lessonId) dans src/library/catalog.ts
 *
 * Les leçons sont chargées à la demande (import dynamique) : l'attente est réelle,
 * et c'est elle qui déclenche les indicateurs de chargement.
 */
const loaders: Record<string, () => Promise<Lesson>> = {
  scheduling: () => import('./scheduling').then((m) => m.schedulingLesson),
}

/** Métadonnées légères, disponibles sans charger la leçon (bibliothèque, accueil) */
export const lessonMeta: Record<string, { scenes: number; minutes: number }> = {
  scheduling: { scenes: 6, minutes: 2 },
}

const cache = new Map<string, Lesson>()

export const hasLesson = (id: string) => id in loaders

export async function loadLesson(id: string): Promise<Lesson> {
  const hit = cache.get(id)
  if (hit) return hit
  const lesson = await loaders[id]()
  cache.set(id, lesson)
  return lesson
}

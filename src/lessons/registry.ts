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
  lifecycle: () => import('./lifecycle').then((m) => m.lifecycleLesson),
  mutex: () => import('./mutex').then((m) => m.mutexLesson),
  memory: () => import('./memory').then((m) => m.memoryLesson),
}

/** Métadonnées légères, disponibles sans charger la leçon (bibliothèque, accueil) */
export const lessonMeta: Record<string, { scenes: number; minutes: number }> = {
  scheduling: { scenes: 7, minutes: 3 },
  lifecycle: { scenes: 6, minutes: 3 },
  mutex: { scenes: 9, minutes: 5 },
  memory: { scenes: 7, minutes: 3 },
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

import { useSyncExternalStore } from 'react'

/** Progression locale (scènes vues) — simple localStorage, pas de base de données. */
const key = (id: string) => `learny:visited:${id}`
const listeners = new Set<() => void>()

function read(id: string): string {
  try { return localStorage.getItem(key(id)) ?? '[]' } catch { return '[]' }
}

export function markVisited(id: string, sceneIndex: number) {
  const cur: number[] = JSON.parse(read(id))
  if (cur.includes(sceneIndex)) return
  try { localStorage.setItem(key(id), JSON.stringify([...cur, sceneIndex].sort())) } catch { /* stockage indisponible */ }
  listeners.forEach((l) => l())
}

export function useVisited(id: string | undefined): number[] {
  const raw = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => (id ? read(id) : '[]'),
  )
  return JSON.parse(raw)
}

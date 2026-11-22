/** Mémorise où l'on en est (leçon, mode, scène) : un rechargement ne ramène plus à l'accueil. */
interface Session { lesson?: string; mode?: 'explain' | 'explore'; scene?: number }
const KEY = 'learny:session'

export function readSession(): Session {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') } catch { return {} }
}
export function writeSession(patch: Session | null) {
  try {
    if (patch === null) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, JSON.stringify({ ...readSession(), ...patch }))
  } catch { /* stockage indisponible */ }
}

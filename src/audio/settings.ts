import { useSyncExternalStore } from 'react'

/** Réglages sonores (persistés localement) : volumes indépendants + interrupteur des effets. */
export interface AudioSettings {
  sfxOn: boolean
  sfxVolume: number // 0 → 1
  narrationVolume: number // 0 → 1
}

const KEY = 'learny:audio'
const DEFAULTS: AudioSettings = { sfxOn: true, sfxVolume: 0.6, narrationVolume: 1 }

function load(): AudioSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
}

let state = load()
const listeners = new Set<() => void>()

export const getAudioSettings = () => state

export function setAudioSettings(patch: Partial<AudioSettings>) {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* stockage indisponible */ }
  listeners.forEach((l) => l())
}

export function subscribeAudioSettings(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export const useAudioSettings = () => useSyncExternalStore(subscribeAudioSettings, getAudioSettings)

import type { ComponentType, ReactNode } from 'react'
import type { SoundName } from '../audio/sfx'

/** Moment clé d'une scène : affiché comme une bulle d'annotation sur l'animation */
export interface Beat {
  /** position dans la scène, 0 → 1 (utilisée si `on` est absent) */
  at?: number
  /** expression de la narration à partir de laquelle la bulle apparaît : suit la voix, pas la minuterie */
  on?: string
  text: string
}

/**
 * Repère sonore : un effet joué quand la scène atteint une position.
 * Position = `on` (expression de la narration, suit la voix) sinon `at` (progression 0 → 1).
 */
export interface SoundCue {
  at?: number
  on?: string
  sound: SoundName
  /** degré de la gamme (appear, done) : permet de faire monter une série de notes */
  pitch?: number
  /** intensité relative, 1 par défaut */
  gain?: number
}

export interface SceneContext {
  /** avancement de la scène, 0 → 1 (la scène est une fonction pure de cette valeur) */
  progress: number
  playing: boolean
  /** progression (0 → 1) à laquelle la voix dit cette expression ; null si elle n'est pas dans la narration */
  at: (phrase: string) => number | null
  actions: { goExplore: () => void }
}

export interface Scene {
  id: string
  title: string
  /** durée de l'animation en secondes (sera remplacée par la durée du MP3 quand il existera) */
  duration: number
  /** texte lu par la narration (affiché en sous-titres + transcription) */
  narration: string
  /**
   * Fichier audio ElevenLabs de la scène, ex. '/audio/scheduling/02-fcfs.mp3'.
   * Quand il est renseigné, le lecteur le joue en synchronisation avec l'animation.
   */
  audioSrc?: string
  /**
   * Repères mesurés sur le MP3 : « ce mot commence à tant de secondes ».
   * Se mesurent avec `python3 scripts/silences.py <fichier.mp3>`. À refaire si l'audio change.
   */
  sync?: { text: string; at: number }[]
  beats?: Beat[]
  /** effets sonores synchronisés (facultatif) — voir src/audio/sfx.ts */
  cues?: SoundCue[] | ((at: (phrase: string) => number | null) => SoundCue[])
  render: (ctx: SceneContext) => ReactNode
}

export interface Lesson {
  id: string
  title: string
  subtitle: string
  scenes: Scene[]
  /** Composant du mode Exploration (simulation manipulable) */
  Explore: ComponentType
}

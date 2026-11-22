import type { ComponentType, ReactNode } from 'react'

/** Moment clé d'une scène : affiché comme une bulle d'annotation sur l'animation */
export interface Beat {
  /** position dans la scène, 0 → 1 */
  at: number
  text: string
}

export interface SceneContext {
  /** avancement de la scène, 0 → 1 (la scène est une fonction pure de cette valeur) */
  progress: number
  playing: boolean
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
  beats?: Beat[]
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

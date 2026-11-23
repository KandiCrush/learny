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
  at: (phrase: string, offsetSec?: number) => number | null
  actions: { goExplore: () => void }
}

export interface SceneAudio {
  src: string
  from: number
  to: number
  /** durée du MP3 au moment de la calibration : si le fichier a changé, la plage est ignorée (avertissement en dev) */
  fileDuration?: number
}

export interface Scene {
  id: string
  title: string
  /** durée de l'animation en secondes (sera remplacée par la durée du MP3 quand il existera) */
  duration: number
  /** texte lu par la narration (affiché en sous-titres + transcription) */
  narration: string
  /**
   * Plage de cette scène dans le fichier audio du cours (un MP3 pour tout le cours, ou un par groupe de scènes) :
   * `from` / `to` en secondes. Les valeurs viennent de `scripts/calibrate-sync.py` (sync.generated.ts).
   * Absent : la scène se joue en silence avec sa durée simulée (`duration`).
   */
  audio?: SceneAudio
  /**
   * Repères mesurés sur le MP3 : « ce mot commence à tant de secondes ».
   * Se mesurent avec `python3 scripts/silences.py <fichier.mp3>`. À refaire si l'audio change.
   */
  sync?: { text: string; at: number }[]
  beats?: Beat[]
  /** effets sonores synchronisés (facultatif) — voir src/audio/sfx.ts */
  cues?: SoundCue[] | ((at: (phrase: string, offsetSec?: number) => number | null) => SoundCue[])
  render: (ctx: SceneContext) => ReactNode
}

/** Une définition du lexique d'une leçon (affichée par le bouton « Lexique », voir components/LexiconMenu.tsx) */
export interface LexiconEntry {
  /** le mot défini */
  term: string
  /** définition courte, en une ou deux phrases, sans autre mot à définir */
  definition: string
  /** variantes ou mots proches, utilisés par la recherche (« ready », « en exécution »…) */
  aliases?: string[]
}

export interface Lesson {
  id: string
  title: string
  subtitle: string
  scenes: Scene[]
  /** Composant du mode Exploration (simulation manipulable) */
  Explore: ComponentType
  /** Lexique de la leçon (facultatif) : le bouton « Lexique » n'apparaît que s'il est renseigné */
  lexicon?: LexiconEntry[]
}

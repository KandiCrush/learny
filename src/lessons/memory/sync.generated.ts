// Généré par scripts/calibrate-sync.py — ne pas modifier à la main.
// Le cours est UN MP3 : chaque scène en occupe une plage [from, to] (secondes).
// `SYNC` : repères « ce mot commence à tant de secondes APRÈS LE DÉBUT DE LA SCÈNE ».
import type { SceneKey } from './narration'

/** Durée du MP3 au moment de la calibration (null = pas de MP3) */
export const FILE_DURATION: number | null = 114.21

export const SEGMENTS: Record<SceneKey, { from: number; to: number } | null> = {
  share: {"from": 0.0, "to": 18.9},
  fixed: {"from": 18.9, "to": 36.0},
  variable: {"from": 36.0, "to": 51.12},
  compact: {"from": 51.12, "to": 62.02},
  track: {"from": 62.02, "to": 76.3},
  strategies: {"from": 76.3, "to": 94.64},
  verdict: {"from": 94.64, "to": 114.21},
}

export const SYNC: Record<SceneKey, { text: string; at: number }[]> = {
  share: [
    { text: "quand", at: 1.8 },
    { text: "Alors", at: 4.84 },
    { text: "c'est", at: 6.52 },
    { text: "Mais", at: 8.16 },
    { text: "Le gestionnaire", at: 10.24 },
    { text: "Chaque", at: 13.42 },
  ],
  fixed: [
    { text: "des", at: 1.06 },
    { text: "Une", at: 3.7 },
    { text: "Mais", at: 6.04 },
    { text: "cet", at: 8.98 },
    { text: "Et", at: 12.1 },
    { text: "le", at: 15.38 },
  ],
  variable: [
    { text: "des", at: 1.08 },
    { text: "Chacun", at: 2.66 },
    { text: "Mais", at: 5.1 },
    { text: "Le", at: 8.22 },
    { text: "l'allocation", at: 11.76 },
    { text: "C'est", at: 13.1 },
  ],
  compact: [
    { text: "Cette", at: 3.38 },
    { text: "Mais", at: 5.42 },
    { text: "on", at: 9.2 },
  ],
  track: [
    { text: "ou", at: 4.48 },
    { text: "l'adresse", at: 5.72 },
    { text: "La table", at: 7.98 },
    { text: "La liste", at: 11.58 },
  ],
  strategies: [
    { text: "de", at: 1.1 },
    { text: "Quand", at: 2.76 },
    { text: "Mêmes", at: 5.18 },
    { text: "First", at: 7.5 },
    { text: "Next", at: 10.18 },
    { text: "Best", at: 13.7 },
    { text: "Worst", at: 16.32 },
  ],
  verdict: [
    { text: "Worst", at: 4.0 },
    { text: "First", at: 6.38 },
    { text: "Ici,", at: 9.42 },
    { text: "pas", at: 12.86 },
    { text: "Avec", at: 13.92 },
    { text: "Aucune", at: 16.3 },
    { text: "À vous", at: 18.46 },
  ],
}

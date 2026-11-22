import { useEffect, useRef } from 'react'
import { type SfxOptions, type SoundName, playSfx } from '../audio/sfx'

export interface ResolvedCue { pos: number; sound: SoundName; pitch?: number; gain?: number }

interface PlayerState { progress: number; playing: boolean; tick: number; index: number; speed: number }

/**
 * Déclenche les effets sonores d'une scène quand la progression FRANCHIT leur position.
 *
 * Règles (c'est ce qui évite les répétitions) :
 *  - on compare l'ancienne et la nouvelle progression ; un rendu React sans avancée ne déclenche rien ;
 *  - lecture seule : en pause, on ne fait que mémoriser la position ;
 *  - retour arrière, déplacement sur la barre, redémarrage et changement de scène (`tick`/`index`)
 *    resynchronisent la position SANS rien jouer ;
 *  - un saut anormal (> 20 % de la scène en une mise à jour) est traité comme un déplacement.
 * La vitesse de lecture n'a pas besoin de traitement : les repères sont fixés à la progression,
 * donc ils suivent automatiquement l'animation et la voix, quelle que soit la vitesse.
 */
export function useSoundCues(cues: ResolvedCue[], s: PlayerState) {
  const last = useRef(-1e-4)
  const key = useRef('')
  const cuesRef = useRef(cues)
  cuesRef.current = cues

  useEffect(() => {
    const rest = s.progress === 0 ? -1e-4 : s.progress // à 0, un repère placé en 0 doit pouvoir sonner
    const k = `${s.index}:${s.tick}`
    if (key.current !== k) { key.current = k; last.current = rest; return }
    if (!s.playing) { last.current = rest; return }
    const from = last.current, to = s.progress
    last.current = to
    if (to <= from || to - from > 0.2) return
    for (const c of cuesRef.current) {
      if (c.pos > from && c.pos <= to) {
        const o: SfxOptions = { pitch: c.pitch, gain: c.gain, speed: s.speed }
        playSfx(c.sound, o)
      }
    }
  }, [s.progress, s.playing, s.tick, s.index, s.speed])
}

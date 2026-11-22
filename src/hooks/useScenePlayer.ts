import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Scene } from '../lessons/types'
import { useAudioSettings } from '../audio/settings'

/**
 * Lecteur de scènes. Chaque scène est une fonction pure de `progress` (0 → 1).
 *
 * Horloge :
 *  - scène AVEC audio (`audioSrc` chargé) : le MP3 est l'horloge maître. `progress` est lu
 *    en continu sur `audio.currentTime / audio.duration` ; animation, sous-titres et bulles
 *    ne peuvent donc plus dériver par rapport à la voix (démarrage, mise en mémoire tampon…).
 *  - scène SANS audio (ou fichier absent) : GSAP fait avancer `progress` avec la durée simulée.
 */
export function useScenePlayer(scenes: Scene[], initialIndex = 0) {
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialIndex), scenes.length - 1))
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [autoNext, setAutoNext] = useState(true)
  const [tick, setTick] = useState(0)
  const proxy = useRef({ p: 0 })
  const scene = scenes[index]
  const { narrationVolume } = useAudioSettings()

  // --- audio de la scène courante ---
  const audio = useRef<HTMLAudioElement | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  useEffect(() => {
    setAudioDuration(null)
    audio.current = null
    if (!scene.audioSrc) return
    const a = new Audio(scene.audioSrc)
    a.preload = 'auto'
    a.onloadedmetadata = () => { if (Number.isFinite(a.duration) && a.duration > 1) { audio.current = a; setAudioDuration(a.duration) } }
    // fichier absent ou illisible : la scène continue avec sa durée simulée, sans son
    a.onerror = () => { audio.current = null; setAudioDuration(null) }
    return () => { a.pause(); a.onloadedmetadata = null; a.onerror = null; audio.current = null }
  }, [scene.audioSrc])
  const duration = audioDuration ?? scene.duration
  useEffect(() => { if (audio.current) audio.current.volume = narrationVolume }, [narrationVolume, audioDuration])

  const seek = useCallback((p: number) => {
    proxy.current.p = p
    setProgress(p)
    setTick((x) => x + 1)
  }, [])

  const goTo = useCallback((i: number, keepPlaying = false) => {
    proxy.current.p = 0
    setProgress(0)
    setIndex(Math.max(0, Math.min(scenes.length - 1, i)))
    setTick((x) => x + 1)
    if (!keepPlaying) setPlaying(false)
  }, [scenes.length])

  useEffect(() => {
    const a = audio.current
    if (!playing) { a?.pause(); return }
    if (proxy.current.p >= 1) proxy.current.p = 0
    const finish = () => {
      if (autoNext && index < scenes.length - 1) goTo(index + 1, true)
      else setPlaying(false)
    }

    if (a && audioDuration) {
      // horloge = audio
      a.playbackRate = speed
      a.volume = narrationVolume
      a.currentTime = proxy.current.p * audioDuration
      a.play().catch(() => setPlaying(false)) // lecture refusée par le navigateur
      let raf = 0
      const loop = () => {
        const p = Math.min(1, a.currentTime / audioDuration)
        proxy.current.p = p
        setProgress(p)
        if (a.ended || p >= 1) { proxy.current.p = 1; setProgress(1); finish(); return }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => { cancelAnimationFrame(raf); a.pause() }
    }

    // horloge = GSAP (durée simulée)
    const tw = gsap.to(proxy.current, {
      p: 1,
      duration: Math.max(0.01, ((1 - proxy.current.p) * scene.duration) / speed),
      ease: 'none',
      onUpdate: () => setProgress(proxy.current.p),
      onComplete: finish,
    })
    return () => { tw.kill() }
  }, [playing, speed, index, tick, audioDuration, scene.duration, autoNext, goTo, scenes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    if (!playing && proxy.current.p >= 1 && index === scenes.length - 1) seek(0)
    setPlaying((p) => !p)
  }, [playing, index, scenes.length, seek])

  const restart = useCallback(() => { seek(0); setPlaying(true) }, [seek])

  return {
    index, scene, progress, playing, speed, autoNext, duration, tick,
    setSpeed, setAutoNext, seek, goTo, toggle, restart, pause: () => setPlaying(false),
    next: () => goTo(index + 1, playing),
    prev: () => (progress > 0.08 ? restart() : goTo(index - 1, playing)),
  }
}

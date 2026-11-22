import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Scene } from '../lessons/types'

/**
 * Lecteur de scènes. Chaque scène est une fonction pure de `progress` (0 → 1) ;
 * GSAP fait avancer `progress` dans le temps. Lecture, pause, reprise, recherche
 * et vitesse se résument donc à piloter une seule valeur.
 *
 * Audio : si `scene.audioSrc` est défini, le MP3 est joué en parallèle et sa durée
 * remplace `scene.duration` (voir useNarrationAudio ci-dessous).
 */
export function useScenePlayer(scenes: Scene[]) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [autoNext, setAutoNext] = useState(true)
  const [tick, setTick] = useState(0)
  const proxy = useRef({ p: 0 })
  const scene = scenes[index]
  const { duration } = useNarrationAudio(scene, playing, speed, tick, proxy)

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
    if (!playing) return
    if (proxy.current.p >= 1) proxy.current.p = 0
    const tw = gsap.to(proxy.current, {
      p: 1,
      duration: Math.max(0.01, ((1 - proxy.current.p) * duration) / speed),
      ease: 'none',
      onUpdate: () => setProgress(proxy.current.p),
      onComplete: () => {
        if (autoNext && index < scenes.length - 1) goTo(index + 1, true)
        else setPlaying(false)
      },
    })
    return () => { tw.kill() }
  }, [playing, speed, index, tick, duration, autoNext, goTo, scenes.length])

  const toggle = useCallback(() => {
    if (!playing && proxy.current.p >= 1 && index === scenes.length - 1) seek(0)
    setPlaying((p) => !p)
  }, [playing, index, scenes.length, seek])

  const restart = useCallback(() => { seek(0); setPlaying(true) }, [seek])

  return {
    index, scene, progress, playing, speed, autoNext, duration,
    setSpeed, setAutoNext, seek, goTo, toggle, restart, pause: () => setPlaying(false),
    next: () => goTo(index + 1, playing),
    prev: () => (progress > 0.08 ? restart() : goTo(index - 1, playing)),
  }
}

/** Joue le MP3 de la scène (s'il existe) en phase avec l'animation. Sans audio : no-op. */
function useNarrationAudio(scene: Scene, playing: boolean, speed: number, tick: number, proxy: { current: { p: number } }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)

  useEffect(() => {
    setAudioDuration(null)
    if (!scene.audioSrc) { audio.current = null; return }
    const a = new Audio(scene.audioSrc)
    a.preload = 'auto'
    a.onloadedmetadata = () => setAudioDuration(a.duration)
    audio.current = a
    return () => { a.pause(); audio.current = null }
  }, [scene.audioSrc])

  useEffect(() => {
    const a = audio.current
    if (!a) return
    a.playbackRate = speed
    if (playing) {
      if (Number.isFinite(a.duration)) a.currentTime = proxy.current.p * a.duration
      a.play().catch(() => { /* lecture bloquée par le navigateur */ })
    } else a.pause()
  }, [playing, speed, tick, proxy])

  return { duration: audioDuration ?? scene.duration }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Scene } from '../lessons/types'
import { useAudioSettings } from '../audio/settings'

/**
 * Lecteur de scènes. Chaque scène est une fonction pure de `progress` (0 → 1).
 *
 * Horloge :
 *  - scène AVEC audio (plage `scene.audio` d'un MP3 chargé) : le MP3 est l'horloge maître. `progress` est lu en
 *    continu sur `audio.currentTime` ; animation, sous-titres et bulles ne peuvent donc pas dériver par rapport à
 *    la voix. Les scènes d'un même MP3 se partagent UN élément audio : passer à la scène suivante ne coupe pas la
 *    voix (pas de nouveau départ), et un chapitre est simplement une position dans le fichier.
 *  - scène SANS audio (ou fichier absent / périmé) : GSAP fait avancer `progress` avec la durée simulée.
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

  // --- éléments audio (un par fichier distinct) ---
  const audios = useRef(new Map<string, HTMLAudioElement>())
  const warned = useRef(false)
  const [fileDurations, setFileDurations] = useState<Record<string, number>>({})
  useEffect(() => {
    const srcs = [...new Set(scenes.flatMap((s) => (s.audio ? [s.audio.src] : [])))]
    const created = srcs.map((src) => {
      const a = new Audio(src)
      a.preload = 'auto'
      // fichier absent ou illisible : on reste sur la durée simulée, sans son
      a.onloadedmetadata = () => { if (Number.isFinite(a.duration) && a.duration > 1) setFileDurations((d) => ({ ...d, [src]: a.duration })) }
      audios.current.set(src, a)
      return a
    })
    return () => { created.forEach((a) => { a.pause(); a.onloadedmetadata = null }); audios.current.clear(); setFileDurations({}) }
  }, [scenes])

  // plage valide : fichier chargé ET toujours conforme à celui qui a été calibré
  const fileDuration = scene.audio ? fileDurations[scene.audio.src] : undefined
  let seg: { src: string; from: number; to: number } | null = null
  if (scene.audio && fileDuration) {
    const { fileDuration: expected, to } = scene.audio
    const stale = (expected !== undefined && Math.abs(fileDuration - expected) > 0.6) || to > fileDuration + 0.5
    if (stale) {
      if (import.meta.env?.DEV && !warned.current) { warned.current = true; console.warn(`[audio] ${scene.audio.src} a changé depuis la calibration : relancez python3 scripts/calibrate-sync.py`) }
    } else seg = scene.audio
  }
  const duration = seg ? seg.to - seg.from : scene.duration

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

  useEffect(() => { audios.current.forEach((a) => { a.volume = narrationVolume }) }, [narrationVolume, fileDurations])
  useEffect(() => { if (!playing) audios.current.forEach((a) => a.pause()) }, [playing])

  // enchaînement automatique : l'audio continue sans être interrompu ni repositionné
  const advancing = useRef(false)
  const lastTick = useRef(-1)

  useEffect(() => {
    if (!playing) return
    if (proxy.current.p >= 1) proxy.current.p = 0
    const finish = () => {
      if (autoNext && index < scenes.length - 1) { advancing.current = true; goTo(index + 1, true) }
      else setPlaying(false)
    }

    const a = seg ? audios.current.get(seg.src) : undefined
    if (seg && a) {
      // horloge = audio
      const len = seg.to - seg.from
      const wasAdvancing = advancing.current // on arrive ici par l'enchaînement automatique
      const forced = lastTick.current !== tick && !wasAdvancing // déplacement demandé par l'utilisateur
      advancing.current = false
      lastTick.current = tick
      a.playbackRate = speed
      a.volume = narrationVolume
      const target = seg.from + proxy.current.p * len
      // enchaînement : si la voix est déjà dans la plage de la nouvelle scène, on ne la touche pas (pas de coupure)
      const inRange = a.currentTime >= seg.from - 0.15 && a.currentTime < seg.to
      const drifted = wasAdvancing ? !inRange : Math.abs(a.currentTime - target) > 0.3
      if (forced || a.paused || drifted) a.currentTime = target
      a.play().catch(() => setPlaying(false)) // lecture refusée par le navigateur
      let raf = 0
      const loop = () => {
        const p = Math.min(1, Math.max(0, (a.currentTime - seg.from) / len))
        proxy.current.p = p
        setProgress(p)
        if (p >= 1 || a.ended) { proxy.current.p = 1; setProgress(1); finish(); return }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(raf) // surtout pas de pause ici : la scène suivante peut continuer la même voix
    }

    // horloge = GSAP (durée simulée) ; toute voix en cours est arrêtée
    advancing.current = false
    lastTick.current = tick
    audios.current.forEach((x) => x.pause())
    const tw = gsap.to(proxy.current, {
      p: 1,
      duration: Math.max(0.01, ((1 - proxy.current.p) * scene.duration) / speed),
      ease: 'none',
      onUpdate: () => setProgress(proxy.current.p),
      onComplete: finish,
    })
    return () => { tw.kill() }
  }, [playing, speed, index, tick, seg?.src, seg?.from, seg?.to, scene.duration, autoNext, goTo, scenes.length]) // eslint-disable-line react-hooks/exhaustive-deps

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

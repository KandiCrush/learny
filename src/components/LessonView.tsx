import { Suspense, useEffect, useMemo, useLayoutEffect, useRef, useState, useTransition } from 'react'
import gsap from 'gsap'
import { Captions as CaptionsIcon, ChevronRight, FileText, Pause, Play, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react'
import { useScenePlayer } from '../hooks/useScenePlayer'
import { markVisited, useVisited } from '../lib/progress'
import type { Lesson } from '../lessons/types'
import { Captions } from './Captions'
import { buildTimeline } from '../lib/narration'
import { useSoundCues } from '../hooks/useSoundCues'
import { SoundMenu } from './SoundMenu'
import { FolderButton } from './FolderButton'
import { type Mode, ModeSwitch } from './ModeSwitch'
import { d, soften } from '../lib/motion'
import { readSession, writeSession } from '../lib/session'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function LessonView({ lesson, onOpenLibrary, onHome }: { lesson: Lesson; onOpenLibrary: (r: DOMRect) => void; onHome: () => void }) {
  const [mode, setMode] = useState<Mode>(() => (readSession().lesson === lesson.id && readSession().mode) || 'explain')
  const [target, setTarget] = useState<Mode | null>(null)
  const [switching, startTransition] = useTransition()
  const [captions, setCaptions] = useState(true)
  const [transcript, setTranscript] = useState(false)
  const player = useScenePlayer(lesson.scenes, readSession().lesson === lesson.id ? readSession().scene ?? 0 : 0)
  const { scene, index, progress, playing } = player
  const visited = useVisited(lesson.id)
  const stageBody = useRef<HTMLDivElement>(null)
  const modeWrap = useRef<HTMLDivElement>(null)
  const scenes = lesson.scenes

  const overall = Math.min(1, (index + progress) / scenes.length)
  // rythme de la narration : estimé, corrigé par les repères mesurés (scene.sync)
  const timeline = useMemo(() => buildTimeline(scene.narration, player.duration, scene.sync), [scene, player.duration])
  // effets sonores : positions résolues sur la voix (on) ou la progression (at), déclenchés au franchissement
  const cues = useMemo(() => {
    const raw = typeof scene.cues === 'function' ? scene.cues(timeline.phraseStart) : scene.cues ?? []
    return raw.map((c) => ({ ...c, pos: (c.on && timeline.phraseStart(c.on)) || c.at || 0 }))
  }, [scene, timeline])
  useSoundCues(cues, { progress, playing, tick: player.tick, index, speed: player.speed })
  const beats = (scene.beats ?? []).map((b) => ({ ...b, pos: (b.on && timeline.phraseStart(b.on)) || b.at || 0 }))
  const beat = [...beats].reverse().find((b) => progress >= b.pos) ?? beats[0]

  useEffect(() => { writeSession({ lesson: lesson.id, mode, scene: index }) }, [lesson.id, mode, index])
  useEffect(() => { if (progress > 0.85) markVisited(lesson.id, index) }, [progress, index, lesson.id])

  // transition entre scènes
  useLayoutEffect(() => {
    if (!stageBody.current) return
    const tw = gsap.fromTo(stageBody.current, soften({ opacity: 0, y: 18, scale: 0.985 }), { opacity: 1, y: 0, scale: 1, duration: d(0.6), ease: 'power3.out' })
    return () => { tw.kill() }
  }, [index])

  // transition entre modes
  const isFirst = useRef(true)
  useLayoutEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    if (modeWrap.current) gsap.fromTo(modeWrap.current, soften({ opacity: 0, y: 22, filter: 'blur(8px)' }), { opacity: 1, y: 0, filter: 'blur(0px)', duration: d(0.7), ease: 'expo.out' })
  }, [mode])
  // Le passage à Exploration charge réellement la simulation (import dynamique) :
  // la transition garde l'écran actuel, affiche un état « en cours » et bloque les clics répétés.
  const changeMode = (m: Mode) => {
    if (switching || m === mode) return
    if (m === 'explore') player.pause()
    setTarget(m)
    startTransition(() => setMode(m))
  }

  // raccourcis clavier
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range') return
      if (mode !== 'explain' || e.metaKey || e.ctrlKey) return
      if (e.key === ' ' && el.tagName !== 'BUTTON') { e.preventDefault(); player.toggle() }
      else if (e.key === 'ArrowRight') player.next()
      else if (e.key === 'ArrowLeft') player.prev()
      else if (e.key.toLowerCase() === 'r') player.restart()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const goExplore = () => changeMode('explore')

  return (
    <div className="flex h-dvh flex-col">
      {/* Barre supérieure */}
      <header className="relative z-10 flex items-center gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-6">
        <FolderButton onOpen={onOpenLibrary} />
        <nav className="hidden min-w-0 items-center gap-1.5 text-[13px] text-white/50 md:flex" aria-label="Fil d’Ariane">
          <button onClick={onHome} className="hover:text-white">Accueil</button>
          <ChevronRight size={13} />
          <span className="truncate text-white/85">{lesson.title}</span>
        </nav>
        <div className="flex-1" />
        <ModeSwitch mode={mode} pending={switching ? target : null} onChange={changeMode} />
        <div className="flex-1" />
        {mode === 'explain' && (
          <div className="flex gap-1.5">
            <SoundMenu />
            <button className="icon-btn" data-active={captions} onClick={() => setCaptions((c) => !c)} aria-label="Sous-titres" title="Sous-titres"><CaptionsIcon size={18} /></button>
            <button className="icon-btn" data-active={transcript} onClick={() => setTranscript((c) => !c)} aria-label="Texte de narration" title="Texte de narration"><FileText size={18} /></button>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/[.06]"><div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--mint)]" style={{ width: `${overall * 100}%` }} /></div>
      </header>

      <main className="relative min-h-0 flex-1 px-4 pb-4 pt-3 sm:px-6">
        <div ref={modeWrap} className={`h-full ${mode === 'explore' ? 'overflow-y-auto lg:overflow-hidden' : ''}`}>
          {mode === 'explain' ? (
            <section className="glass relative flex h-full min-h-[420px] flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
                <div className="min-w-0">
                  <div className="eyebrow">scène <b>{String(index + 1).padStart(2, '0')}</b>/{String(scenes.length).padStart(2, '0')}</div>
                  <h1 key={scene.id} className="title-in mt-1.5 font-display text-[19px] leading-tight sm:text-[27px]"><span className="mr-2 text-[var(--accent)]/70" aria-hidden>›</span>{scene.title}</h1>
                </div>
                <Ring value={overall} />
              </div>

              <div ref={stageBody} className="relative min-h-0 flex-1 px-4 py-2 sm:px-8">
                {/* sur petit écran la scène garde une largeur lisible et se fait défiler horizontalement */}
                <div className="scroll-thin h-full overflow-auto">
                  <div className="h-full min-w-[640px] sm:min-w-0">{scene.render({ progress, playing, at: timeline.phraseStart, actions: { goExplore } })}</div>
                </div>
              </div>

              <div className="flex min-h-[92px] flex-col items-center justify-end gap-2.5 px-5 pb-4 sm:px-8 sm:pb-5">
                {beat && <div key={beat.text} className="beat-in beat">{beat.text}</div>}
                {captions && <Captions timeline={timeline} progress={progress} />}
              </div>

              {/* Transcription */}
              <aside className={`absolute inset-y-0 right-0 z-20 w-full max-w-md border-l border-white/10 bg-[#0c0e1c]/92 backdrop-blur-2xl transition-transform duration-500 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] ${transcript ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!transcript}>
                <div className="flex items-center justify-between p-5 pb-3"><div className="eyebrow">Texte de narration</div><button className="icon-btn !h-8 !w-8" onClick={() => setTranscript(false)} aria-label="Fermer"><X size={16} /></button></div>
                <div className="h-[calc(100%-64px)] space-y-3 overflow-y-auto px-5 pb-6">
                  {scenes.map((s, i) => (
                    <button key={s.id} onClick={() => player.goTo(i, false)} className={`block w-full rounded-2xl border p-4 text-left transition ${i === index ? 'border-[var(--accent)]/60 bg-[var(--accent)]/10' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'}`}>
                      <div className="mb-1 text-[11px] uppercase tracking-widest text-white/45">{String(i + 1).padStart(2, '0')} · {s.title}</div>
                      <p className="text-[13.5px] leading-relaxed text-white/80">{s.narration}</p>
                      {s.audioSrc && <div className="mt-2 text-[11px] text-[var(--mint)]">♪ audio</div>}
                    </button>
                  ))}
                </div>
              </aside>
            </section>
          ) : (
            <Suspense fallback={<ExploreSkeleton />}>
              <lesson.Explore />
            </Suspense>
          )}
        </div>
      </main>

      {/* Dock de lecture */}
      {mode === 'explain' && (
        <footer className="px-4 pb-4 sm:px-6 sm:pb-5">
          <div className="glass !rounded-[26px] p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap">
              <div className="flex items-center gap-1.5">
                <button className="icon-btn" onClick={player.restart} aria-label="Recommencer" title="Recommencer (R)"><RotateCcw size={18} /></button>
                <button className="icon-btn" onClick={player.prev} disabled={index === 0 && progress < 0.08} aria-label="Précédent" title="Précédent (←)"><SkipBack size={18} /></button>
                <button className="play-btn" onClick={player.toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
                  {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="translate-x-[1px]" />}
                </button>
                <button className="icon-btn" onClick={player.next} disabled={index === scenes.length - 1} aria-label="Suivant" title="Suivant (→)"><SkipForward size={18} /></button>
              </div>
              <div className="order-last flex min-w-full flex-1 items-center gap-3 sm:order-none sm:min-w-0">
                <span className="w-9 text-right font-mono text-xs text-white/50">{mmss(progress * player.duration)}</span>
                <input type="range" className="range scrub" min={0} max={1} step={0.001} value={progress} style={{ ['--fill' as string]: `${progress * 100}%` }}
                  onChange={(e) => player.seek(Number(e.target.value))} aria-label="Progression de la scène" />
                <span className="w-9 font-mono text-xs text-white/50">{mmss(player.duration)}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button className="chip !py-1.5 hover:bg-white/10" onClick={() => player.setSpeed(SPEEDS[(SPEEDS.indexOf(player.speed) + 1) % SPEEDS.length])} title="Vitesse">
                  <b className="font-mono">{player.speed}×</b>
                </button>
                <button className="chip !py-1.5 hover:bg-white/10" data-active={player.autoNext} onClick={() => player.setAutoNext(!player.autoNext)} title="Enchaîner les scènes automatiquement">
                  <span className={`h-2 w-2 rounded-full ${player.autoNext ? 'bg-[var(--mint)]' : 'bg-white/30'}`} /> Auto
                </button>
              </div>
            </div>
            <div className="scroll-thin mt-3 flex gap-2 overflow-x-auto pb-0.5">
              {scenes.map((s, i) => {
                const seen = visited.includes(i)
                const fill = i < index ? 1 : i === index ? progress : 0
                return (
                  <button key={s.id} onClick={() => player.goTo(i, playing)} data-active={i === index} className="scene-chip">
                    <span className="absolute inset-y-0 left-0 rounded-xl bg-white/[.09]" style={{ width: `${fill * 100}%` }} />
                    <span className="relative flex items-center gap-2">
                      <i className={seen && i !== index ? 'seen' : ''}>{seen && i !== index ? '✓' : i + 1}</i>
                      <span className="truncate">{s.title}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

function ExploreSkeleton() {
  return (
    <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_350px]" role="status" aria-label="Chargement de la simulation">
      <div className="skeleton min-h-[360px]" /><div className="skeleton hidden min-h-[360px] lg:block" />
    </div>
  )
}

function Ring({ value }: { value: number }) {
  const r = 18, c = 2 * Math.PI * r
  return (
    <div className="hidden shrink-0 items-center gap-3 sm:flex" title="Progression de la leçon">
      <div className="text-right"><div className="eyebrow">leçon</div><div className="font-mono text-[13px] text-white/80">{Math.round(value * 100)} %</div></div>
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="4" />
        <circle cx="23" cy="23" r={r} fill="none" stroke="url(#rg)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${value * c} ${c}`} transform="rotate(-90 23 23)" />
        <defs><linearGradient id="rg"><stop offset="0" stopColor="#8b7bff" /><stop offset="1" stopColor="#5eead4" /></linearGradient></defs>
      </svg>
    </div>
  )
}

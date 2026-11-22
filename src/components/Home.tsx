import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowRight, BookOpen, FlaskConical, Folder, Headphones, Play } from 'lucide-react'
import { SchedulerMachine } from './SchedulerMachine'
import { FolderButton } from './FolderButton'
import { DEMO_PROCS, rr } from '../lessons/scheduling/data'
import { useVisited } from '../lib/progress'
import { lessonMeta } from '../lessons/registry'
import { Spinner } from './Spinner'
import { d, reducedMotion, soften } from '../lib/motion'

export function Home({ onOpenLibrary, onOpenLesson, loadingId }: { onOpenLibrary: (r: DOMRect) => void; onOpenLesson: (id: string) => void; loadingId: string | null }) {
  const loading = loadingId === 'scheduling'
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const libBtn = useRef<HTMLButtonElement>(null)
  const [t, setT] = useState(-1)
  const visited = useVisited('scheduling')

  // entrée en scène
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('.h-in', { ...soften({ opacity: 0, y: 34, filter: 'blur(10px)' }), duration: d(1.1), stagger: reducedMotion() ? 0 : 0.1 })
        .from('.h-card', { ...soften({ opacity: 0, y: 60, rotateX: 14, scale: 0.92 }), duration: d(1.4) }, 0.25)
        .from('.h-feat', { ...soften({ opacity: 0, y: 24 }), duration: d(0.9), stagger: reducedMotion() ? 0 : 0.09 }, 0.7)
    }, root)
    return () => ctx.revert()
  }, [])

  // démo vivante : Round Robin en boucle
  useEffect(() => {
    if (reducedMotion()) { setT(8); return } // image fixe si les animations sont réduites
    const p = { t: -0.5 }
    const tw = gsap.to(p, { t: rr.total + 1.2, duration: (rr.total + 1.7) * 0.8, ease: 'none', repeat: -1, repeatDelay: 1.4, onUpdate: () => setT(p.t) })
    return () => { tw.kill() }
  }, [])

  // parallaxe 3D
  const onMove = (e: React.PointerEvent) => {
    if (!card.current || reducedMotion()) return
    const r = card.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    gsap.to(card.current, { rotateY: x * 9, rotateX: -y * 9, duration: 0.8, ease: 'power3.out' })
  }
  const onLeave = () => card.current && gsap.to(card.current, { rotateY: 0, rotateX: 0, duration: 1.2, ease: 'elastic.out(1,.6)' })

  const total = lessonMeta.scheduling.scenes

  return (
    <div ref={root} className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <div className="h-in flex items-center gap-3">
          <Logo />
          <span className="font-display text-[19px]">learny<span className="caret" aria-hidden /></span>
        </div>
        <div className="h-in"><FolderButton onOpen={onOpenLibrary} /></div>
      </header>

      <main className="mx-auto grid w-full max-w-[1280px] flex-1 items-center gap-10 px-5 pb-10 pt-4 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-14">
        <div>
          <div className="h-in eyebrow flex items-center gap-2"><b>~/</b> apprendre en mouvement</div>
          <h1 className="h-in font-display mt-5 text-[36px] leading-[1.08] sm:text-[52px] lg:text-[58px]">
            Voyez les concepts <em className="text-[#a99dff] not-italic">prendre vie</em><span className="text-white/35">.</span>
          </h1>
          <p className="h-in mt-6 max-w-lg text-[17px] leading-relaxed text-white/60">
            Des animations pas à pas, des simulations que vous manipulez, une voix qui explique. L’informatique abstraite devient enfin quelque chose que l’on peut toucher.
          </p>
          <div className="h-in mt-9 flex flex-wrap gap-3">
            <button className="btn-primary" disabled={!!loadingId} aria-busy={loading} onClick={() => onOpenLesson('scheduling')}>{loading ? <Spinner delayed /> : <Play size={16} fill="currentColor" />} {loading ? 'Ouverture…' : visited.length ? 'Reprendre la leçon' : 'Commencer la leçon'}</button>
            <button ref={libBtn} className="btn-ghost" disabled={!!loadingId} onClick={() => onOpenLibrary(libBtn.current!.getBoundingClientRect())}><Folder size={18} /> Ouvrir la bibliothèque</button>
          </div>
          <div className="h-in mt-5 text-[13px] text-white/40">Astuce : appuyez sur <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/70">L</kbd> n’importe où pour ouvrir la bibliothèque.</div>
        </div>

        <div className="[perspective:1400px]" onPointerMove={onMove} onPointerLeave={onLeave}>
          <div ref={card} className="h-card glass group relative cursor-pointer p-4 sm:p-6 [transform-style:preserve-3d]" onClick={() => onOpenLesson('scheduling')} role="button" tabIndex={0} aria-busy={loading} onKeyDown={(e) => e.key === 'Enter' && onOpenLesson('scheduling')} aria-label="Ouvrir la leçon sur l’ordonnancement">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="eyebrow">Systèmes d’exploitation</div>
                <div className="font-display mt-1.5 text-[20px] sm:text-[22px]">Ordonnancement des processus</div>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10">{loading ? <Spinner delayed /> : <ArrowRight size={18} />}</div>
            </div>
            <div className="rounded-2xl border border-white/[.07] bg-[#0a0b18]/60 p-2 [transform:translateZ(30px)]">
              <SchedulerMachine procs={DEMO_PROCS} schedule={rr} t={t} className="w-full" />
            </div>
            <div className="mt-4 flex items-center gap-3 text-[12.5px] text-white/55">
              <span className="chip">{total} scènes</span><span className="chip">FCFS · SJF · Round Robin</span>
              <span className="ml-auto font-mono">{visited.length}/{total} vues</span>
            </div>
          </div>
        </div>
      </main>

      <section className="mx-auto grid w-full max-w-[1280px] gap-3 px-5 pb-10 sm:grid-cols-3 sm:px-10">
        {[
          [BookOpen, 'Mode Explication', 'Des scènes animées enchaînées, avec lecture, pause et retour en arrière.'],
          [FlaskConical, 'Mode Exploration', 'Changez les paramètres, lancez l’expérience, observez le résultat.'],
          [Headphones, 'Narration audio', 'Chaque scène aura sa voix ElevenLabs. L’interface est déjà prête.'],
        ].map(([I, h, p]) => {
          const Icon = I as typeof BookOpen
          return (
            <div key={h as string} className="h-feat flex gap-4 rounded-3xl border border-white/[.08] bg-white/[.03] p-5 transition hover:-translate-y-1 hover:bg-white/[.06]">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[var(--accent)]/20 text-[#b9b0ff]"><Icon size={20} /></div>
              <div><div className="cmd text-[14px]">{h as string}</div><p className="mt-1 text-[13.5px] leading-relaxed text-white/50">{p as string}</p></div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b7bff" /><stop offset="1" stopColor="#5eead4" /></linearGradient></defs>
      <rect width="34" height="34" rx="11" fill="#12142a" stroke="rgba(255,255,255,.15)" />
      <circle cx="17" cy="17" r="11" fill="none" stroke="url(#lg)" strokeWidth="1.8" strokeDasharray="4.5 4" />
      <circle cx="17" cy="17" r="5" fill="url(#lg)" />
    </svg>
  )
}

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { BookOpen, FlaskConical } from 'lucide-react'
import { d } from '../lib/motion'
import { Spinner } from './Spinner'

export type Mode = 'explain' | 'explore'

/** `pending` : mode cible en cours de chargement (opération réellement asynchrone) */
export function ModeSwitch({ mode, pending, onChange }: { mode: Mode; pending: Mode | null; onChange: (m: Mode) => void }) {
  const pill = useRef<HTMLDivElement>(null)
  const btns = useRef<Record<string, HTMLButtonElement | null>>({})
  const first = useRef(true)
  useLayoutEffect(() => {
    const place = (instant: boolean) => {
      const b = btns.current[mode]
      if (!b || !pill.current) return
      gsap.to(pill.current, { x: b.offsetLeft, width: b.offsetWidth, duration: instant ? 0 : d(0.6), ease: 'expo.out', overwrite: true })
    }
    place(first.current)
    first.current = false
    const onResize = () => place(true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mode])
  const item = (m: Mode, label: string, Icon: typeof BookOpen) => (
    <button ref={(el) => { btns.current[m] = el }} onClick={() => onChange(m)} disabled={!!pending} data-active={mode === m} data-pending={pending === m} className="mode-btn" role="tab" aria-selected={mode === m} aria-busy={pending === m}>
      {pending === m ? <Spinner size={16} delayed /> : <Icon size={16} />} <span>{label}</span>
    </button>
  )
  return (
    <div className="relative flex rounded-full border border-white/10 bg-white/[.05] p-1 backdrop-blur-xl" role="tablist" aria-label="Mode d’apprentissage">
      <div ref={pill} className="absolute left-0 top-1 h-[calc(100%-8px)] rounded-full bg-white shadow-[0_6px_24px_-6px_rgba(139,123,255,.8)]" />
      {item('explain', 'Explication', BookOpen)}
      {item('explore', 'Exploration', FlaskConical)}
    </div>
  )
}

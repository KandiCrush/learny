import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/** Nombre qui « roule » vers sa nouvelle valeur (micro-interaction) */
export function AnimatedNumber({ value, decimals = 2, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const state = useRef({ v: value })
  useEffect(() => {
    const tw = gsap.to(state.current, {
      v: value,
      duration: 0.7,
      ease: 'power3.out',
      onUpdate: () => {
        if (!ref.current) return
        const v = state.current.v
        const s = Number.isInteger(value) && Math.abs(v - value) < 0.005 ? String(value) : v.toFixed(decimals).replace(/\.?0+$/, '')
        ref.current.textContent = s.replace('.', ',')
      },
    })
    return () => { tw.kill() }
  }, [value, decimals])
  return <span ref={ref} className={className}>{String(value).replace('.', ',')}</span>
}

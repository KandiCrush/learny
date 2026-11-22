import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { reducedMotion } from '../lib/motion'

/** Fond vivant : halos colorés qui dérivent lentement + grain */
export function Ambient() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.blob').forEach((el, i) => {
        gsap.to(el, { x: `random(-140, 140)`, y: `random(-100, 100)`, scale: `random(0.85, 1.25)`, duration: 14 + i * 3, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatRefresh: true })
      })
    }, root)
    return () => ctx.revert()
  }, [])
  return (
    <div ref={root} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]" aria-hidden>
      <div className="blob absolute -left-40 -top-40 h-[640px] w-[640px] rounded-full bg-[#5b49e6] opacity-[.28] blur-[130px]" />
      <div className="blob absolute -right-32 top-1/4 h-[560px] w-[560px] rounded-full bg-[#14b8a6] opacity-[.16] blur-[130px]" />
      <div className="blob absolute bottom-[-220px] left-1/3 h-[560px] w-[560px] rounded-full bg-[#ff6b6b] opacity-[.12] blur-[140px]" />
      <div className="grain absolute inset-0" />
    </div>
  )
}

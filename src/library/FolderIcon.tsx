import { useId } from 'react'
import { ICONS } from './icons'
import type { IconKey } from './catalog'

/** Dossier dessiné en SVG : s'entrouvre au survol, laisse dépasser des feuilles */
export function FolderIcon({ color, icon, count, className = '' }: { color: string; icon: IconKey; count?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const Icon = ICONS[icon]
  return (
    <div className={`fold relative aspect-[5/4] ${className}`}>
      <svg viewBox="0 0 150 120" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".55" /><stop offset="1" stopColor={color} stopOpacity=".3" /></linearGradient>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".72" /></linearGradient>
        </defs>
        <path d="M10 22 a10 10 0 0 1 10 -10 h34 q6 0 10 5 l5 6 h61 a10 10 0 0 1 10 10 v70 a10 10 0 0 1 -10 10 h-110 a10 10 0 0 1 -10 -10z" fill={`url(#${id}b)`} />
        <g className="fold-sheets">
          <rect x="24" y="30" width="96" height="60" rx="6" fill="#fff" fillOpacity=".9" transform="rotate(-3 72 60)" />
          <rect x="30" y="34" width="96" height="60" rx="6" fill="#e8e9ff" fillOpacity=".95" transform="rotate(2 78 64)" />
        </g>
        <g className="fold-front">
          <path d="M6 44 a10 10 0 0 1 10 -10 h118 a10 10 0 0 1 10 10 v62 a10 10 0 0 1 -10 10 h-118 a10 10 0 0 1 -10 -10z" fill={`url(#${id}f)`} />
          <path d="M16 35 h118" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-[10%] top-[40%] grid place-items-center text-white/90"><Icon className="h-[26%] w-[26%] drop-shadow" strokeWidth={1.8} /></div>
      {count !== undefined && <span className="absolute bottom-[8%] right-[9%] rounded-full bg-black/30 px-1.5 py-px font-mono text-[10px] text-white/90">{count}</span>}
    </div>
  )
}

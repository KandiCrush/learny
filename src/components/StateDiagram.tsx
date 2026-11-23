import { useId } from 'react'
import { X } from 'lucide-react'
import { clamp, easeOut } from '../lib/math'
import { STATE_COLOR } from './LifecycleStage'

/**
 * Diagramme à trois états (Prêt, Élu, Bloqué) et ses quatre transitions.
 * Tout est une fonction des valeurs passées : la scène « Les quatre transitions » le construit pas à pas,
 * le mode Exploration s'en sert pour montrer ce que le modèle autorise.
 */
type P = [number, number]
interface EdgeDef { id: 0 | 1 | 2 | 3; from: P; c: P; to: P; label: string; hint: string; at: P; anchor: 'start' | 'middle' | 'end' }

export const NODE = { ready: { x: 170, y: 262 }, running: { x: 830, y: 262 }, blocked: { x: 500, y: 76 } } as const
const R = 52

/** ① Prêt→Élu · ② Élu→Prêt · ③ Élu→Bloqué · ④ Bloqué→Prêt (même numérotation que la narration) */
export const EDGES: EdgeDef[] = [
  { id: 0, from: [212, 304], c: [500, 420], to: [788, 304], label: 'Élection', hint: 'l’ordonnanceur choisit', at: [500, 396], anchor: 'middle' },
  { id: 1, from: [782, 246], c: [500, 176], to: [218, 246], label: 'Préemption', hint: 'le processeur est retiré', at: [500, 238], anchor: 'middle' },
  { id: 2, from: [842, 210], c: [830, 84], to: [554, 76], label: 'Attente', hint: 'une donnée manque', at: [800, 82], anchor: 'middle' },
  { id: 3, from: [446, 76], c: [190, 84], to: [158, 210], label: 'Événement', hint: 'la donnée arrive', at: [200, 82], anchor: 'middle' },
]
const FORBIDDEN = { from: [536, 118] as P, to: [782, 232] as P }

const bez = (e: EdgeDef, t: number): P => {
  const u = 1 - t
  return [u * u * e.from[0] + 2 * u * t * e.c[0] + t * t * e.to[0], u * u * e.from[1] + 2 * u * t * e.c[1] + t * t * e.to[1]]
}
const dPath = (e: EdgeDef) => `M${e.from[0]} ${e.from[1]} Q${e.c[0]} ${e.c[1]} ${e.to[0]} ${e.to[1]}`

export interface DiagramProps {
  /** apparition des trois états (Prêt, Élu, Bloqué), 0 → 1 */
  nodes?: [number, number, number]
  /** apparition de chaque transition, 0 → 1 */
  edges?: [number, number, number, number]
  /** apparition de l'étiquette (titre + exemple) de chaque transition */
  labels?: [number, number, number, number]
  /** transition mise en avant (la flèche s'illumine) */
  active?: number | null
  /** jeton qui parcourt la transition `edge` : position t (0 → 1) */
  dot?: { edge: number; t: number; color: string; text: string } | null
  /** transition interdite Bloqué → Élu (pointillé barré) */
  forbidden?: number
  /** surligne un état : celui où se trouve le processus sélectionné */
  current?: 'ready' | 'running' | 'blocked' | null
  /** transitions que le processus sélectionné peut emprunter : les autres sont atténuées */
  legal?: number[] | null
  /** en exploration : texte plus compact */
  compact?: boolean
  className?: string
}

const NODES: { key: 'ready' | 'running' | 'blocked'; name: string; sub: string }[] = [
  { key: 'ready', name: 'Prêt', sub: 'attend le CPU' },
  { key: 'running', name: 'Élu', sub: 'utilise le CPU' },
  { key: 'blocked', name: 'Bloqué', sub: 'attend un événement' },
]

export function StateDiagram({ nodes = [1, 1, 1], edges = [1, 1, 1, 1], labels, active = null, dot = null, forbidden = 0, current = null, legal = null, compact, className }: DiagramProps) {
  const uid = useId().replace(/:/g, '')
  const lab = labels ?? edges
  return (
    <svg viewBox="0 0 1000 440" className={className} role="img" aria-label="Diagramme des états Prêt, Élu et Bloqué et de leurs transitions">
      <defs>
        <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke" /></marker>
      </defs>

      {/* transition interdite */}
      <g opacity={easeOut(clamp(forbidden))}>
        <path d={`M${FORBIDDEN.from[0]} ${FORBIDDEN.from[1]} L${FORBIDDEN.to[0]} ${FORBIDDEN.to[1]}`} stroke={STATE_COLOR.blocked} strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" fill="none" opacity=".8" />
        <g transform={`translate(${(FORBIDDEN.from[0] + FORBIDDEN.to[0]) / 2} ${(FORBIDDEN.from[1] + FORBIDDEN.to[1]) / 2})`}>
          <circle r={17} fill="#2a0f16" stroke={STATE_COLOR.blocked} strokeWidth="2" />
          <X x={-10} y={-10} width={20} height={20} color={STATE_COLOR.blocked} strokeWidth={3} />
        </g>
        <text x={640} y={228} textAnchor="middle" fontSize="13" fontWeight="600" fill={STATE_COLOR.blocked} fontFamily="Geist, sans-serif" transform="rotate(25 640 228)" dy="-24">pas de transition directe</text>
      </g>

      {/* transitions */}
      {EDGES.map((e, i) => {
        const o = easeOut(clamp(edges[i]))
        const isActive = active === i
        const faded = legal ? !legal.includes(i) : active !== null && !isActive
        const stroke = isActive ? '#fff' : 'rgba(255,255,255,.5)'
        const lo = easeOut(clamp(lab[i]))
        return (
          <g key={e.id} opacity={o * (faded ? 0.3 : 1)} style={{ transition: compact ? 'opacity .35s' : undefined }}>
            <path d={dPath(e)} fill="none" stroke={isActive ? STATE_COLOR.running : stroke} strokeWidth={isActive ? 4 : 2.5} strokeLinecap="round" markerEnd={`url(#${uid}-arrow)`} style={{ stroke: isActive ? STATE_COLOR.running : stroke }} />
            <g opacity={lo}>
              <text x={e.at[0]} y={e.at[1]} textAnchor={e.anchor} fontSize={compact ? 15 : 17} fontWeight="700" fill="#fff" fontFamily="IBM Plex Mono, monospace">{`${'①②③④'[i]} ${e.label}`}</text>
              {!compact && <text x={e.at[0]} y={e.at[1] + 20} textAnchor={e.anchor} fontSize="13.5" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">{e.hint}</text>}
            </g>
          </g>
        )
      })}

      {/* états */}
      {NODES.map((n, i) => {
        const o = easeOut(clamp(nodes[i]))
        const c = STATE_COLOR[n.key]
        const p = NODE[n.key]
        const on = current === n.key
        return (
          <g key={n.key} transform={`translate(${p.x} ${p.y}) scale(${0.85 + 0.15 * o})`} opacity={o}>
            {on && <circle r={R + 16} fill={c} opacity=".2" className="cpu-pulse" />}
            <circle r={R} fill="#14162b" stroke={c} strokeWidth={on ? 4 : 2.5} />
            <circle r={R} fill={c} opacity=".14" />
            <text y={6} textAnchor="middle" fontSize="19" fontWeight="700" fill="#fff" fontFamily="IBM Plex Mono, monospace">{n.name}</text>
            {!compact && <text y={R + 22} textAnchor="middle" fontSize="12.5" fill={c} fontFamily="Geist Mono, monospace">{n.sub}</text>}
          </g>
        )
      })}

      {/* jeton en déplacement sur une transition */}
      {dot && (() => {
        const [x, y] = bez(EDGES[dot.edge], clamp(dot.t))
        return (
          <g transform={`translate(${x} ${y})`}>
            <circle r={26} fill={dot.color} opacity=".25" />
            <circle r={19} fill="#161830" stroke={dot.color} strokeWidth="2.5" />
            <text y={4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{dot.text}</text>
          </g>
        )
      })()}
    </svg>
  )
}

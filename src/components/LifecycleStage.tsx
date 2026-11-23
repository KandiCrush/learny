import { type ComponentType, type ReactNode, useId } from 'react'
import type { LucideProps } from 'lucide-react'
import { Check, X } from 'lucide-react'
import type { PState } from '../lib/lifecycle'
import { clamp, easeInOut, lerp } from '../lib/math'

/** Couleur de chaque état (zones, étiquettes, diagramme) — indépendante de la couleur propre d'un processus */
export const STATE_COLOR: Record<PState, string> = { new: '#a78bfa', ready: '#60a5fa', running: '#5eead4', blocked: '#ff6b6b', terminated: '#8a90b5' }

/* ------------------------------------------------------------------ */
/* Géométrie de la scène (viewBox 1000 × 440)                          */
/* ------------------------------------------------------------------ */
export const VIEW = { w: 1000, h: 440 }
const LANE = { x: 24, y: 64, w: 548, h: 170 }
const BLK = { x: 24, y: 250, w: 548, h: 150 }
const NEW_TRAY = { x: 596, y: 250, w: 180, h: 150 }
const DONE_TRAY = { x: 796, y: 250, w: 180, h: 150 }
export const CPU = { x: 780, y: 134 }
const QUEUE_Y = 134, QUEUE_FRONT = 520, GAP = 84

export type Zone = 'queue' | 'cpu' | 'blocked' | 'new' | 'done' | 'free' | 'off'
export interface Place { zone: Zone; i?: number; /** emplacement libre (zone 'free') */ x?: number; y?: number }
export interface Pose { x: number; y: number; s: number; o: number }

/** Position d'un emplacement : file des prêts (le prochain élu est à droite), CPU, zone des bloqués, plateaux Nouveau / Terminé */
export function placePose({ zone, i = 0, x, y }: Place): Pose {
  switch (zone) {
    case 'queue': return { x: QUEUE_FRONT - i * GAP, y: QUEUE_Y, s: 1, o: 1 }
    case 'cpu': return { x: CPU.x, y: CPU.y, s: 1.12, o: 1 }
    case 'blocked': return { x: 88 + i * GAP, y: 322, s: 1, o: 1 }
    case 'new': return { x: NEW_TRAY.x + 40 + (i % 3) * 54, y: NEW_TRAY.y + 56 + Math.floor(i / 3) * 56, s: 0.62, o: 1 }
    case 'done': return { x: DONE_TRAY.x + 40 + (i % 3) * 54, y: DONE_TRAY.y + 56 + Math.floor(i / 3) * 56, s: 0.62, o: 1 }
    case 'free': return { x: x ?? 300, y: y ?? 200, s: 1, o: 1 }
    default: return { x: x ?? 300, y: y ?? -60, s: 0.6, o: 0 }
  }
}

/** Mélange deux poses (u : 0 → 1) avec un léger soulèvement pendant le déplacement */
export function mixPose(a: Pose, b: Pose, u: number, lift = -16): Pose {
  const k = easeInOut(clamp(u))
  const moving = a.x !== b.x || a.y !== b.y
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) + (moving ? Math.sin(Math.PI * k) * lift : 0), s: lerp(a.s, b.s, k), o: lerp(a.o, b.o, k) }
}

export interface StageToken {
  id: string
  /** texte principal du jeton (P1, N…) si pas de pictogramme */
  label?: string
  glyph?: ComponentType<LucideProps>
  /** nom affiché sous le jeton */
  name?: string
  /** deuxième ligne sous le jeton (l'état, en général) */
  sub?: string
  subColor?: string
  color: string
  pose: Pose
  /** anneau « en exécution » */
  running?: boolean
  selected?: boolean
  /** surimpression : ✓ ou ✕ */
  mark?: 'check' | 'cross' | null
  markOpacity?: number
  /** halo (0 → 1) : événement reçu */
  glow?: number
}

interface Reveal { lane?: number; cpu?: number; blocked?: number; trays?: number }

interface Props {
  tokens: StageToken[]
  /** apparition des zones (0 → 1, 1 par défaut) */
  reveal?: Reveal
  /** le processeur est-il occupé ? (halo + anneau) */
  cpuBusy?: boolean
  cpuColor?: string
  /** avancement de la tranche de temps du processus élu (anneau 0 → 1), facultatif */
  slicePct?: number
  /** zone mise en évidence */
  focus?: Zone | null
  /** affiche les plateaux « Nouveau » et « Terminé » (hors du modèle à trois états) */
  extended?: boolean
  /** transitions CSS entre deux poses (mode Exploration) ; en scène, tout est calculé à partir de la progression */
  smooth?: boolean
  onSelect?: (id: string) => void
  className?: string
  label?: string
  /** surimpressions propres à la scène (ordonnanceur, paquets, étiquettes…), dessinées par-dessus les jetons */
  children?: ReactNode
  /** surimpressions dessinées SOUS les jetons, au-dessus des zones */
  under?: ReactNode
}

export function LifecycleStage({ tokens, reveal, cpuBusy, cpuColor = '#5eead4', slicePct, focus, extended, smooth, onSelect, className, label, children, under }: Props) {
  const uid = useId().replace(/:/g, '')
  const R = { lane: 1, cpu: 1, blocked: 1, trays: 1, ...reveal }
  const dim = (z: Zone) => (focus && focus !== z ? 0.42 : 1)

  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className={className} role={onSelect ? 'group' : 'img'} aria-label={label ?? 'Processus répartis entre la file des prêts, le processeur et la zone des bloqués'}>
      <defs>
        <clipPath id={`${uid}-blk`}><rect x={-36} y={-36} width={72} height={72} rx={15} /></clipPath>
        <linearGradient id={`${uid}-chip`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#262a4a" /><stop offset="1" stopColor="#12142a" /></linearGradient>
        <radialGradient id={`${uid}-glow`}><stop offset="0" stopColor={cpuColor} stopOpacity=".5" /><stop offset="1" stopColor={cpuColor} stopOpacity="0" /></radialGradient>
      </defs>

      {/* PRÊTS : file d'attente du CPU */}
      <g opacity={R.lane * dim('queue')} style={{ transition: smooth ? 'opacity .4s' : undefined }}>
        <rect x={LANE.x} y={LANE.y} width={LANE.w} height={LANE.h} rx={26} fill={`${STATE_COLOR.ready}0d`} stroke={STATE_COLOR.ready} strokeOpacity={focus === 'queue' ? 0.8 : 0.32} strokeDasharray="3 7" />
        <text x={46} y={LANE.y + 26} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill={STATE_COLOR.ready}>PRÊTS · FILE D’ATTENTE</text>
        <g className="flow-arrows" stroke="rgba(255,255,255,.22)" strokeWidth="2.5" strokeLinecap="round" fill="none">
          {[0, 1, 2].map((i) => <path key={i} d={`M${LANE.x + LANE.w - 22 - i * 16} ${LANE.y + 104} l8 6 l-8 6`} style={{ animationDelay: `${i * 0.18}s` }} />)}
        </g>
      </g>
      <path d={`M${LANE.x + LANE.w + 6} ${QUEUE_Y} H ${CPU.x - 106}`} stroke="rgba(255,255,255,.22)" strokeWidth="2" strokeDasharray="2 5" opacity={Math.min(R.lane, R.cpu)} />

      {/* ÉLU : processeur */}
      <g opacity={R.cpu * dim('cpu')} transform={`translate(${CPU.x} ${CPU.y})`} style={{ transition: smooth ? 'opacity .4s' : undefined }}>
        {cpuBusy && <circle r={125} fill={`url(#${uid}-glow)`} className="cpu-pulse" />}
        <g stroke="rgba(255,255,255,.28)" strokeWidth="3" strokeLinecap="round">
          {[-44, -15, 15, 44].map((o) => (
            <g key={o}><path d={`M${o} -84 v-14`} /><path d={`M${o} 84 v14`} /><path d={`M-84 ${o} h-14`} /><path d={`M84 ${o} h14`} /></g>
          ))}
        </g>
        <rect x={-84} y={-84} width={168} height={168} rx={28} fill={`url(#${uid}-chip)`} stroke={focus === 'cpu' ? cpuColor : 'rgba(255,255,255,.2)'} strokeWidth="1.5" />
        <circle r={68} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        {cpuBusy && slicePct !== undefined && <circle r={68} fill="none" stroke={cpuColor} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${clamp(slicePct) * 427} 427`} transform="rotate(-90)" />}
        {!cpuBusy && <text y={6} textAnchor="middle" fontSize="12" letterSpacing="2.4" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">LIBRE</text>}
        <text y={112} textAnchor="middle" fontSize="11.5" letterSpacing="2.4" fontFamily="Geist Mono, monospace" fill={STATE_COLOR.running}>ÉLU · CPU</text>
      </g>

      {/* BLOQUÉS */}
      <g opacity={R.blocked * dim('blocked')} style={{ transition: smooth ? 'opacity .4s' : undefined }}>
        <rect x={BLK.x} y={BLK.y} width={BLK.w} height={BLK.h} rx={26} fill={`${STATE_COLOR.blocked}0b`} stroke={STATE_COLOR.blocked} strokeOpacity={focus === 'blocked' ? 0.8 : 0.3} strokeDasharray="3 7" />
        <text x={46} y={BLK.y + 26} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill={STATE_COLOR.blocked}>BLOQUÉS · ATTENDENT UN ÉVÉNEMENT</text>
      </g>

      {/* Nouveau / Terminé : hors du modèle à trois états du cours */}
      {extended && (
        <g opacity={R.trays}>
          {([['NOUVEAU', NEW_TRAY, STATE_COLOR.new], ['TERMINÉ', DONE_TRAY, STATE_COLOR.terminated]] as const).map(([t, z, c]) => (
            <g key={t}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={22} fill="rgba(255,255,255,.02)" stroke={c} strokeOpacity=".4" strokeDasharray="2 6" />
              <text x={z.x + 18} y={z.y + 26} fontSize="11" letterSpacing="2" fontFamily="Geist Mono, monospace" fill={c}>{t}</text>
              <text x={z.x + z.w - 14} y={z.y + z.h - 12} textAnchor="end" fontSize="9.5" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.3)">hors modèle à 3 états</text>
            </g>
          ))}
        </g>
      )}

      {under}

      {/* Processus */}
      {tokens.map((t) => {
        const { x, y, s, o } = t.pose
        const small = s < 0.8
        const body = (
          <g
            role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? `${t.name ?? t.label} : ${t.sub ?? ''}` : undefined} aria-pressed={onSelect ? !!t.selected : undefined}
            onClick={onSelect ? () => onSelect(t.id) : undefined}
            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id) } } : undefined}
            style={onSelect ? { cursor: 'pointer', outline: 'none' } : undefined} className={onSelect ? 'token-btn' : undefined}
          >
            {!!t.glow && <circle r={62} fill={t.color} opacity={0.22 * t.glow} />}
            {t.running && <rect x={-42} y={-42} width={84} height={84} rx={19} fill="none" stroke={t.color} strokeOpacity=".5" strokeWidth="2" className="run-ring" />}
            {t.selected && <rect x={-46} y={-46} width={92} height={92} rx={22} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" strokeDasharray="4 5" />}
            <rect x={-36} y={-36} width={72} height={72} rx={15} fill="#161830" />
            <rect x={-36} y={-36} width={72} height={72} rx={15} fill={t.color} opacity={t.running ? 0.34 : 0.2} />
            <rect x={-36} y={-36} width={72} height={72} rx={15} fill="none" stroke={t.color} strokeWidth={t.running ? 2.6 : 1.6} />
            {t.glyph ? <t.glyph x={-17} y={-17} width={34} height={34} color="#fff" strokeWidth={1.8} /> : <text y={8} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="Geist, sans-serif">{t.label}</text>}
            {t.mark && (
              <g opacity={t.markOpacity ?? 1} transform="translate(26 -26)">
                <circle r={13} fill={t.mark === 'check' ? '#0f3a33' : '#3b1218'} stroke={t.mark === 'check' ? STATE_COLOR.running : STATE_COLOR.blocked} strokeWidth="1.5" />
                {t.mark === 'check' ? <Check x={-8} y={-8} width={16} height={16} color={STATE_COLOR.running} strokeWidth={3} /> : <X x={-8} y={-8} width={16} height={16} color={STATE_COLOR.blocked} strokeWidth={3} />}
              </g>
            )}
            {!small && t.name && <text y={56} textAnchor="middle" fill="#fff" fillOpacity=".86" fontSize="12.5" fontWeight="600" fontFamily="Geist, sans-serif">{t.name}</text>}
            {!small && t.sub && <text y={t.name ? 72 : 56} textAnchor="middle" fill={t.subColor ?? '#fff'} fillOpacity=".8" fontSize="11" fontFamily="Geist Mono, monospace">{t.sub}</text>}
          </g>
        )
        return smooth
          ? <g key={t.id} style={{ transform: `translate(${x}px, ${y}px) scale(${s})`, opacity: o, transition: 'transform .8s cubic-bezier(.2,.8,.2,1), opacity .45s' }}>{body}</g>
          : <g key={t.id} transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>{body}</g>
      })}

      {children}
    </svg>
  )
}

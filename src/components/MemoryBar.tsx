import { useId } from 'react'
import { clamp } from '../lib/math'

/**
 * Barre de RAM de la leçon « Allocation et fragmentation » : des blocs PROPORTIONNELS à leur taille (unité : Mo).
 * Elle dessine ce qu'on lui donne (système + processus) ; les zones libres sont le COMPLÉMENT : leur taille affichée
 * est donc toujours celle de l'espace réellement vide, y compris pendant un déplacement.
 * Utilisée par les scènes (blocs interpolés) et par le laboratoire (blocs issus du moteur src/lib/memory.ts).
 */
export const MEM_COLORS = ['#ffb84d', '#f472b6', '#a78bfa', '#c4f06b', '#60a5fa', '#5eead4', '#fb923c', '#e879f9', '#34d399']
export const memColor = (pid: number) => MEM_COLORS[(pid - 1) % MEM_COLORS.length]
export const FREE = '#5eead4'
export const BAD = '#ff6b6b'
const MONO = 'Geist Mono, monospace'

export interface DrawBlock {
  id: string
  kind: 'os' | 'proc'
  label: string
  color: string
  start: number
  /** taille du bloc dessiné (= taille réellement utilisée par le processus) */
  size: number
  /** partitions fixes : taille de la partition qui contient ce processus (≥ size) */
  part?: number
  o?: number
  /** décalage vertical en pixels (0 = dans la RAM ; négatif = zone d'attente au-dessus) */
  dy?: number
  /** 0 → 1 : halo (nouveau bloc, bloc en cours de déplacement) */
  glow?: number
  /** 0 → 1 : opacité du motif « espace perdu » (fragmentation interne) */
  waste?: number
}

export interface Mark { start: number; size: number; kind: 'scan' | 'pick' | 'fail' | 'hole'; o?: number }
export interface Geom { x: number; y: number; w: number; h: number; capacity: number }

interface Props {
  geom: Geom
  blocks: DrawBlock[]
  /** partitions fixes (cadres en pointillés) et leur apparition */
  partitions?: { start: number; size: number }[]
  partO?: number
  /** étiquettes de taille sur les zones libres (0 → 1) */
  gapO?: number
  /** graduations d'adresses sous la barre (0 → 1) */
  tickO?: number
  marks?: Mark[]
  /** réduit les polices (petites barres) */
  small?: boolean
}

export function MemoryBar({ geom, blocks, partitions, partO = 0, gapO = 1, tickO = 1, marks = [], small }: Props) {
  const uid = useId().replace(/:/g, '')
  const { x, y, w, h, capacity } = geom
  const k = w / capacity
  const X = (mo: number) => x + mo * k
  const inRam = (b: DrawBlock) => (b.dy ?? 0) > -4 && (b.o ?? 1) > 0.5

  // zones libres = complément des blocs présents dans la RAM
  const ram = blocks.filter(inRam).sort((a, b) => a.start - b.start)
  const gaps: { start: number; size: number }[] = []
  let cur = 0
  for (const b of ram) { if (b.start > cur + 0.05) gaps.push({ start: cur, size: b.start - cur }); cur = Math.max(cur, b.start + b.size) }
  if (cur < capacity - 0.05) gaps.push({ start: cur, size: capacity - cur })

  // graduations : toutes les frontières, sans chevauchement de texte
  const edges = new Set<number>([0, capacity])
  for (const b of ram) { edges.add(Math.round(b.start * 10) / 10); edges.add(Math.round((b.start + b.size) * 10) / 10) }
  for (const g of gaps) { edges.add(Math.round(g.start * 10) / 10); edges.add(Math.round((g.start + g.size) * 10) / 10) }
  const ticks: number[] = []
  let lastX = -99
  for (const e of [...edges].sort((a, b) => a - b)) { if (X(e) - lastX >= 22) { ticks.push(e); lastX = X(e) } }

  const fs = small ? 11 : 16
  return (
    <g>
      <defs>
        <pattern id={`${uid}-os`} patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><rect width="9" height="9" fill="#232643" /><rect width="3" height="9" fill="rgba(255,255,255,.08)" /></pattern>
        <pattern id={`${uid}-waste`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><rect width="3" height="8" fill={BAD} opacity=".75" /></pattern>
      </defs>

      {/* piste */}
      <rect x={x} y={y} width={w} height={h} rx={small ? 10 : 14} fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.16)" strokeDasharray="3 6" />

      {/* partitions fixes */}
      {partitions && partO > 0 && (
        <g opacity={partO}>
          {partitions.map((p, i) => (
            <g key={i}>
              <rect x={X(p.start) + 1.5} y={y + 2} width={p.size * k - 3} height={h - 4} rx={small ? 8 : 11} fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.6" strokeDasharray="6 5" />
              <text x={X(p.start) + (p.size * k) / 2} y={y + h + (small ? 12 : 16)} textAnchor="middle" fontSize={small ? 10 : 11.5} fill="rgba(255,255,255,.6)" fontFamily={MONO}>partition {p.size} Mo</text>
            </g>
          ))}
        </g>
      )}

      {/* zones libres : taille */}
      {gaps.map((g, i) => (
        <g key={i} opacity={gapO}>
          {g.size * k > 24 && (
            <g>
              <text x={X(g.start) + (g.size * k) / 2} y={y + h / 2 + (h > 60 ? -2 : 4)} textAnchor="middle" fontSize={small ? 11 : 15} fontWeight="700" fill={FREE} fontFamily={MONO}>{Math.round(g.size)} Mo</text>
              {h > 60 && g.size * k > 56 && <text x={X(g.start) + (g.size * k) / 2} y={y + h / 2 + 16} textAnchor="middle" fontSize="11" fill="rgba(94,234,212,.7)" fontFamily={MONO}>libre</text>}
            </g>
          )}
        </g>
      ))}

      {/* blocs */}
      {blocks.map((b) => {
        const bx = X(b.start), bw = b.size * k, by = y + (b.dy ?? 0)
        const o = b.o ?? 1
        if (o <= 0.01) return null
        const bigPart = b.part && b.part > b.size
        return (
          <g key={b.id} opacity={o}>
            {bigPart && (
              <g>
                <rect x={bx + bw} y={by + 2} width={(b.part! - b.size) * k - 1} height={h - 4} fill={`url(#${uid}-waste)`} opacity={0.18 + 0.6 * (b.waste ?? 0)} />
                <rect x={bx} y={by + 2} width={b.part! * k - 1} height={h - 4} rx={small ? 8 : 11} fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.6" strokeDasharray="6 5" />
                {(b.waste ?? 0) > 0.3 && (b.part! - b.size) * k > 20 && <text x={bx + bw + ((b.part! - b.size) * k) / 2} y={by + h / 2 + 4} textAnchor="middle" fontSize={small ? 10 : 13} fontWeight="700" fill={BAD} fontFamily={MONO} opacity={b.waste}>−{Math.round(b.part! - b.size)}</text>}
              </g>
            )}
            {!!b.glow && <rect x={bx - 4} y={by - 4} width={bw + 8} height={h + 8} rx={small ? 12 : 17} fill={b.color} opacity={0.25 * b.glow} />}
            <rect x={bx + 1} y={by + 1} width={Math.max(0, bw - 2)} height={h - 2} rx={small ? 9 : 12} fill={b.kind === 'os' ? `url(#${uid}-os)` : '#161830'} />
            {b.kind === 'proc' && <rect x={bx + 1} y={by + 1} width={Math.max(0, bw - 2)} height={h - 2} rx={small ? 9 : 12} fill={b.color} opacity=".26" />}
            <rect x={bx + 1} y={by + 1} width={Math.max(0, bw - 2)} height={h - 2} rx={small ? 9 : 12} fill="none" stroke={b.kind === 'os' ? 'rgba(255,255,255,.3)' : b.color} strokeWidth="1.8" />
            {bw > 22 && <text x={bx + bw / 2} y={by + h / 2 + (h > 60 && bw > 50 ? -2 : 5)} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{b.label}</text>}
            {h > 60 && bw > 50 && <text x={bx + bw / 2} y={by + h / 2 + 15} textAnchor="middle" fontSize="11.5" fill="rgba(255,255,255,.7)" fontFamily={MONO}>{Math.round(b.size)} Mo</text>}
          </g>
        )
      })}

      {/* marques : recherche d'une zone */}
      {marks.map((m, i) => {
        const col = m.kind === 'fail' ? BAD : m.kind === 'pick' ? '#fff' : m.kind === 'hole' ? FREE : '#ffb84d'
        return <rect key={i} x={X(m.start) + 2} y={y - 3} width={Math.max(2, m.size * k - 4)} height={h + 6} rx={small ? 9 : 13} fill={m.kind === 'pick' ? 'rgba(255,255,255,.12)' : 'none'} stroke={col} strokeWidth={m.kind === 'scan' ? 2 : 2.6} strokeDasharray={m.kind === 'scan' ? '5 4' : undefined} opacity={m.o ?? 1} />
      })}

      {/* adresses */}
      {tickO > 0 && (
        <g opacity={tickO}>
          {ticks.map((t) => (
            <g key={t}>
              <path d={`M${X(t)} ${y + h} v5`} stroke="rgba(255,255,255,.35)" />
              <text x={X(t)} y={y + h + (partitions && partO > 0.5 ? 30 : 17)} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,.45)" fontFamily={MONO}>{Math.round(t * 10) / 10}</text>
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

/** Interpolation d'un nombre avec la même courbe que le reste de Learny */
export const smooth = (u: number) => { const c = clamp(u); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2 }

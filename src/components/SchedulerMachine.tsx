import { useId } from 'react'
import { type Layout, type Proc, type Schedule, ALGO_LABEL, executedAt, sliceIndexAt } from '../lib/scheduling'
import { clamp, easeInOut, easeOut, lerp } from '../lib/math'

/** Durée (en unités de temps) du déplacement d'un processus entre deux zones */
const MOVE = 0.55

interface Pos { x: number; y: number; s: number }

/** Mise en page (viewBox 1000 × 340) : file 24→560 · espace · processeur · espace · zone « Terminés » */
const LANE = { x: 24, w: 536 }
const CPU = { x: 700, y: 175 }
const QUEUE_FRONT = 502 // centre du 1er bloc : 22 px de marge entre le bloc et le bord droit de la file
const GAP = 84

function posOf(pid: number, l: Layout): Pos {
  if (l.running === pid) return { x: CPU.x, y: CPU.y, s: 1.12 }
  const q = l.queue.indexOf(pid)
  if (q >= 0) return { x: QUEUE_FRONT - q * GAP, y: 175, s: 1 }
  const d = l.done.indexOf(pid)
  const k = d < 0 ? 0 : d
  return { x: 880 + (k % 2) * 58, y: 138 + Math.floor(k / 2) * 58, s: 0.62 } // 20 px de marge sous le bord haut de la zone
}

export interface Reveal { lane: number; cpu: number; procs: (i: number) => number }

interface Props {
  procs: Proc[]
  schedule: Schedule
  /** temps simulé ; < 0 = avant le départ */
  t: number
  /** 0 → 1 : apparition progressive (scène d'introduction) */
  /** apparition : nombre (0 → 1, scène d'intro classique) ou calendrier précis { lane, cpu, procs[i] } (chacun 0 → 1) */
  reveal?: number | Reveal
  /** Round Robin : badge « contexte sauvegardé » sur les processus interrompus + mention sauvegarde / restauration */
  contextHints?: boolean
  className?: string
}

export function SchedulerMachine({ procs, schedule, t, reveal = 1, contextHints, className }: Props) {
  const uid = useId().replace(/:/g, '')
  const { slices, layouts, initial } = schedule
  const idx = sliceIndexAt(schedule, t)
  const n = slices.length

  // layout précédent / courant pour le fondu de position
  // SJF : la file se TRIE d'abord (t de -1 à -0,5), puis on attend ; le 1er processus n'entre au CPU qu'à t = 0.
  // (Dans les autres algorithmes, `start` = `initial` : rien ne bouge avant t = 0.)
  const f0 = layouts[0]
  const start: Layout = schedule.algo === 'sjf' && f0 && f0.running !== null ? { running: null, queue: [f0.running, ...f0.queue], done: [] } : initial
  const cur = idx < 0 ? start : layouts[Math.min(idx, n)]
  const prev = idx < 0 ? initial : idx === 0 ? start : layouts[idx - 1]
  const segStart = idx < 0 ? 0 : idx >= n ? slices[n - 1]?.end ?? 0 : slices[idx].start
  const u = idx < 0 ? easeInOut(clamp((t + 1) / 0.5)) : easeInOut(clamp((t - segStart) / MOVE))
  const sinceStart = u

  const exec = executedAt(schedule, Math.max(t, 0))
  const running = idx >= 0 && idx < n ? slices[idx] : null
  const runPct = running ? clamp((t - running.start) / (running.end - running.start)) : 0
  const idle = !running
  const finished = idx >= n && n > 0
  const clock = Math.max(0, Math.min(t, schedule.total))

  // --- indice « contexte » (Round Robin) : sauvegarde à la sortie du CPU, restauration au retour ---
  const hint: string[] = []
  let hintOp = 0
  if (contextHints && idx >= 1 && idx < n) {
    const w = clamp(1 - Math.abs((t - (segStart + 0.4)) / 1.1))
    hintOp = easeInOut(w)
    const outgoing = prev.running
    if (outgoing !== null && cur.queue.includes(outgoing)) hint.push(`↗ SAUVEGARDE · P${outgoing}`)
    const incoming = cur.running
    if (incoming !== null && (executedAt(schedule, segStart)[incoming] ?? 0) > 0) hint.push(`↙ RESTAURATION · P${incoming}`)
  }

  const R: Reveal = typeof reveal === 'number'
    ? { lane: clamp(reveal * 4), cpu: clamp((reveal - 0.45) * 4), procs: (i) => easeOut(clamp(reveal * 3 - 0.1 - i * 0.35 + 0.2)) }
    : reveal
  const laneOp = R.lane
  const cpuOp = R.cpu

  return (
    <svg viewBox="0 0 1000 340" className={className} role="img" aria-label="Processus, file d'attente et processeur">
      <defs>
        <clipPath id={`${uid}-blk`}><rect x={-36} y={-36} width={72} height={72} rx={15} /></clipPath>
        <linearGradient id={`${uid}-chip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#262a4a" /><stop offset="1" stopColor="#12142a" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={running ? procs.find((p) => p.id === running.pid)?.color : '#8b7bff'} stopOpacity=".55" />
          <stop offset="1" stopColor="#8b7bff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* HUD */}
      <g opacity={laneOp}>
        <text x={32} y={44} className="fill-white/45" fontSize="12" letterSpacing="2.4" fontFamily="Geist Mono, monospace">TEMPS</text>
        <text x={32} y={80} fill="#fff" fontSize="34" fontWeight="500" fontFamily="Geist Mono, monospace">
          {clock.toFixed(1).replace('.', ',')}<tspan fontSize="14" className="fill-white/40" dx="6">u.t.</tspan>
        </text>
        <g transform="translate(962 36)">
          <rect x={-118} y={-17} width={118} height={30} rx={15} fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.12)" />
          <text x={-59} y={3} textAnchor="middle" fill="#e9eaff" fontSize="13" fontWeight="600" fontFamily="Geist, sans-serif">{ALGO_LABEL[schedule.algo]}{schedule.algo === 'rr' ? ` · q=${schedule.quantum}` : ''}</text>
        </g>
      </g>

      {/* File d'attente */}
      <g opacity={laneOp}>
        <rect x={LANE.x} y={104} width={LANE.w} height={142} rx={26} fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.12)" strokeDasharray="3 7" />
        <text x={46} y={130} className="fill-white/50" fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace">FILE D'ATTENTE</text>
        <g className="flow-arrows" stroke="rgba(255,255,255,.22)" strokeWidth="2.5" strokeLinecap="round" fill="none">
          {[0, 1, 2].map((i) => <path key={i} d={`M${LANE.x + LANE.w - 24 - i * 16} 230 l8 6 l-8 6`} style={{ animationDelay: `${i * 0.18}s` }} />)}
        </g>
        <text x={LANE.x + LANE.w - 108} y={241} className="fill-white/35" fontSize="11" fontFamily="Geist Mono, monospace" textAnchor="end">prochain →</text>
      </g>

      {/* Lien file → CPU */}
      <path d={`M${LANE.x + LANE.w + 6} 175 H ${CPU.x - 106}`} stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeDasharray="2 5" opacity={laneOp} />

      {/* Processeur */}
      <g opacity={cpuOp} transform={`translate(${CPU.x} ${CPU.y})`}>
        {!idle && <circle r={130} fill={`url(#${uid}-glow)`} className="cpu-pulse" />}
        {/* broches */}
        <g stroke="rgba(255,255,255,.28)" strokeWidth="3" strokeLinecap="round">
          {[-48, -16, 16, 48].map((o) => (
            <g key={o}>
              <path d={`M${o} -92 v-14`} /><path d={`M${o} 92 v14`} />
              <path d={`M-92 ${o} h-14`} /><path d={`M92 ${o} h14`} />
            </g>
          ))}
        </g>
        <rect x={-92} y={-92} width={184} height={184} rx={30} fill={`url(#${uid}-chip)`} stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />
        <rect x={-80} y={-80} width={160} height={160} rx={22} fill="none" stroke="rgba(255,255,255,.07)" />
        {/* anneau de tranche */}
        <circle r={74} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        {running && (
          <circle r={74} fill="none" stroke={procs.find((p) => p.id === running.pid)?.color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${runPct * 465} 465`} transform="rotate(-90)" />
        )}
        <text y={idle ? 6 : 112} textAnchor="middle" fontSize="11.5" letterSpacing="2.4" fontFamily="Geist Mono, monospace" className="fill-white/50" opacity={idle ? 1 : 0}>
          {finished ? 'TERMINÉ' : 'EN ATTENTE'}
        </text>
        <text y={134} textAnchor="middle" fontSize="11.5" letterSpacing="2.4" fontFamily="Geist Mono, monospace" className="fill-white/55">PROCESSEUR</text>
        {hint.map((h, i) => (
          <text key={h} y={-118 - (hint.length - 1 - i) * 17} textAnchor="middle" fontSize="11.5" letterSpacing="1.4" fontFamily="Geist Mono, monospace" fill="#5eead4" opacity={hintOp}>{h}</text>
        ))}
      </g>

      {/* Terminés */}
      <g opacity={cpuOp}>
        <rect x={838} y={96} width={140} height={196} rx={24} fill="rgba(94,234,212,.05)" stroke="rgba(94,234,212,.22)" strokeDasharray="3 7" />
        <text x={908} y={314} textAnchor="middle" className="fill-white/45" fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace">TERMINÉS</text>
      </g>

      {/* Processus */}
      {procs.map((p, i) => {
        const a = posOf(p.id, prev)
        const b = posOf(p.id, cur)
        const k = sinceStart
        const lift = Math.sin(Math.PI * k) * (p.id === cur.running || p.id === prev.running ? -26 : -6)
        const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k) + lift, s = lerp(a.s, b.s, k)
        const appear = R.procs(i)
        const rem = Math.max(0, p.burst - (exec[p.id] ?? 0))
        const frac = p.burst ? rem / p.burst : 0
        const isRun = running?.pid === p.id
        const doneNow = layouts[idx < 0 ? 0 : Math.min(idx, n)].done.includes(p.id) && !isRun
        return (
          <g key={p.id} transform={`translate(${x} ${y + (1 - appear) * 40}) scale(${s * (0.6 + 0.4 * appear)})`} opacity={appear}>
            {isRun && <rect x={-42} y={-42} width={84} height={84} rx={19} fill="none" stroke={p.color} strokeOpacity=".5" strokeWidth="2" className="run-ring" />}
            <rect x={-36} y={-36} width={72} height={72} rx={15} fill="#161830" />
            <g clipPath={`url(#${uid}-blk)`}>
              <rect x={-36} y={36 - 72 * frac} width={72} height={72 * frac + 0.5} fill={p.color} opacity={doneNow ? 0.9 : 0.34} />
            </g>
            <rect x={-36} y={-36} width={72} height={72} rx={15} fill="none" stroke={p.color} strokeWidth={isRun ? 2.5 : 1.6} />
            {contextHints && !isRun && !doneNow && (exec[p.id] ?? 0) > 1e-6 && (
              <g transform="translate(0 -50)">
                <rect x={-26} y={-9} width={52} height={18} rx={9} fill="rgba(94,234,212,.16)" stroke="rgba(94,234,212,.55)" />
                <text y={4} textAnchor="middle" fill="#5eead4" fontSize="10" fontFamily="Geist Mono, monospace">PCB ✓</text>
              </g>
            )}
            <text y={-4} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700" fontFamily="Geist, sans-serif">{p.name}</text>
            <text y={17} textAnchor="middle" fill="#fff" fillOpacity=".78" fontSize="11.5" fontFamily="Geist Mono, monospace">
              {doneNow ? '✓' : `reste ${Math.ceil(rem - 1e-6)}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

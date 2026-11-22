import { type Proc, type Schedule } from '../lib/scheduling'

interface Props {
  procs: Proc[]
  schedule: Schedule
  t: number
  /** échelle commune (permet d'aligner plusieurs diagrammes) */
  scaleTotal?: number
  label?: string
  sublabel?: string
  compact?: boolean
  className?: string
}

const W = 1000, PAD_L = 14, PAD_R = 18

export function GanttChart({ procs, schedule, t, scaleTotal, label, sublabel, compact, className }: Props) {
  const total = scaleTotal ?? schedule.total
  const x = (v: number) => PAD_L + (v / total) * (W - PAD_L - PAD_R)
  const barY = label ? 30 : 8
  const barH = compact ? 34 : 46
  const H = barY + barH + 34
  const step = total <= 24 ? 1 : total <= 60 ? 5 : 10
  const ticks: number[] = []
  for (let v = 0; v <= total; v += step) ticks.push(v)
  const byId = new Map(procs.map((p) => [p.id, p]))
  const head = Math.max(0, Math.min(t, schedule.total))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Diagramme de Gantt">
      {label && (
        <text x={PAD_L} y={16} fill="#eef0ff" fontSize="13" fontWeight="600" fontFamily="Geist, sans-serif">
          {label}<tspan fill="rgba(238,240,255,.5)" fontWeight="400" dx="10" fontFamily="Geist Mono, monospace" fontSize="11.5">{sublabel}</tspan>
        </text>
      )}
      <rect x={PAD_L} y={barY} width={W - PAD_L - PAD_R} height={barH} rx={10} fill="rgba(255,255,255,.04)" />
      {schedule.slices.map((s, i) => {
        const p = byId.get(s.pid)
        if (!p || t <= s.start) return null
        const end = Math.min(t, s.end)
        const w = Math.max(0, x(end) - x(s.start) - 2)
        return (
          <g key={i}>
            <rect x={x(s.start) + 1} y={barY} width={w} height={barH} rx={Math.min(8, w / 2)} fill={p.color} fillOpacity=".92" />
            <rect x={x(s.start) + 1} y={barY} width={w} height={barH / 2} rx={Math.min(8, w / 2)} fill="#fff" fillOpacity=".12" />
            {w > 26 && (
              <text x={x(s.start) + 1 + w / 2} y={barY + barH / 2 + 5} textAnchor="middle" fill="#0b0d17" fontSize="14" fontWeight="700" fontFamily="Geist, sans-serif">{p.name}</text>
            )}
          </g>
        )
      })}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={barY + barH + 4} y2={barY + barH + 10} stroke="rgba(255,255,255,.3)" />
          <text x={x(v)} y={barY + barH + 26} textAnchor="middle" fill="rgba(238,240,255,.5)" fontSize="11" fontFamily="Geist Mono, monospace">{v}</text>
        </g>
      ))}
      {t > 0 && t < schedule.total + 0.01 && (
        <g>
          <line x1={x(head)} x2={x(head)} y1={barY - 6} y2={barY + barH + 6} stroke="#fff" strokeWidth="2" />
          <circle cx={x(head)} cy={barY - 6} r="4" fill="#fff" />
        </g>
      )}
    </svg>
  )
}

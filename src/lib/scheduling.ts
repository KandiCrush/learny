/**
 * Moteur d'ordonnancement (tous les processus arrivent à t = 0).
 * Les animations ne « simulent » rien : elles lisent ce calcul.
 */
export type Algo = 'fcfs' | 'sjf' | 'rr'

export interface Proc {
  id: number
  name: string
  burst: number
  color: string
}

export interface Slice {
  pid: number
  start: number
  end: number
  /** processus en attente pendant cette tranche, du plus proche du CPU au plus éloigné */
  queue: number[]
}

export interface Layout {
  running: number | null
  queue: number[]
  done: number[]
}

export interface Metrics {
  completion: Record<number, number>
  waiting: Record<number, number>
  response: Record<number, number>
  avgWaiting: number
  avgTurnaround: number
  avgResponse: number
  switches: number
  total: number
}

export interface Schedule {
  algo: Algo
  quantum: number
  slices: Slice[]
  /** layouts[i] = état au début de la tranche i ; layouts[n] = tout est terminé */
  layouts: Layout[]
  initial: Layout
  total: number
  metrics: Metrics
}

export const ALGO_LABEL: Record<Algo, string> = {
  fcfs: 'FCFS',
  sjf: 'SJF',
  rr: 'Round Robin',
}

export const PALETTE = ['#ff6b6b', '#ffb84d', '#5eead4', '#a78bfa', '#60a5fa', '#f472b6']

export function makeProcs(bursts: number[]): Proc[] {
  return bursts.map((burst, i) => ({ id: i + 1, name: `P${i + 1}`, burst, color: PALETTE[i % PALETTE.length] }))
}

export function computeSchedule(algo: Algo, procs: Proc[], quantum = 3): Schedule {
  const slices: Slice[] = []
  let clock = 0

  if (algo === 'rr') {
    const q = Math.max(1, quantum)
    const rem = new Map(procs.map((p) => [p.id, p.burst]))
    const queue = procs.map((p) => p.id)
    while (queue.length) {
      const pid = queue.shift()!
      const run = Math.min(q, rem.get(pid)!)
      slices.push({ pid, start: clock, end: clock + run, queue: [...queue] })
      clock += run
      rem.set(pid, rem.get(pid)! - run)
      if (rem.get(pid)! > 0) queue.push(pid)
    }
  } else {
    const order = [...procs]
    if (algo === 'sjf') order.sort((a, b) => a.burst - b.burst || a.id - b.id)
    order.forEach((p, i) => {
      slices.push({ pid: p.id, start: clock, end: clock + p.burst, queue: order.slice(i + 1).map((o) => o.id) })
      clock += p.burst
    })
  }

  // Layouts (début de chaque tranche)
  const remaining = new Map(procs.map((p) => [p.id, p.burst]))
  const done: number[] = []
  const layouts: Layout[] = []
  for (const s of slices) {
    layouts.push({ running: s.pid, queue: s.queue, done: [...done] })
    remaining.set(s.pid, remaining.get(s.pid)! - (s.end - s.start))
    if (remaining.get(s.pid) === 0) done.push(s.pid)
  }
  layouts.push({ running: null, queue: [], done: [...done] })

  const initial: Layout = { running: null, queue: procs.map((p) => p.id), done: [] }

  // Métriques
  const completion: Record<number, number> = {}
  const response: Record<number, number> = {}
  for (const s of slices) {
    completion[s.pid] = s.end
    if (response[s.pid] === undefined) response[s.pid] = s.start
  }
  const waiting: Record<number, number> = {}
  for (const p of procs) waiting[p.id] = completion[p.id] - p.burst
  const n = procs.length || 1
  const sum = (o: Record<number, number>) => Object.values(o).reduce((a, b) => a + b, 0)
  let switches = 0
  slices.forEach((s, i) => {
    if (i > 0 && slices[i - 1].pid !== s.pid) switches++
  })

  return {
    algo,
    quantum,
    slices,
    layouts,
    initial,
    total: clock,
    metrics: {
      completion,
      waiting,
      response,
      avgWaiting: sum(waiting) / n,
      avgTurnaround: sum(completion) / n,
      avgResponse: sum(response) / n,
      switches,
      total: clock,
    },
  }
}

/** Index de la tranche active à l'instant t (n = tout est terminé, -1 = avant le début) */
export function sliceIndexAt(sch: Schedule, t: number): number {
  if (t < 0) return -1
  for (let i = 0; i < sch.slices.length; i++) if (t < sch.slices[i].end) return i
  return sch.slices.length
}

/** Temps d'exécution déjà consommé par chaque processus à l'instant t */
export function executedAt(sch: Schedule, t: number): Record<number, number> {
  const out: Record<number, number> = {}
  for (const s of sch.slices) {
    out[s.pid] = (out[s.pid] ?? 0) + Math.max(0, Math.min(t, s.end) - s.start)
  }
  return out
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '').replace('.', ','))

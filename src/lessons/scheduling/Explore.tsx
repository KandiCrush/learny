import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { Gauge, Minus, Pause, Play, Plus, RotateCcw, StepForward } from 'lucide-react'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { GanttChart } from '../../components/GanttChart'
import { SchedulerMachine } from '../../components/SchedulerMachine'
import { clamp } from '../../lib/math'
import { ALGO_LABEL, type Algo, PALETTE, computeSchedule, executedAt, fmt, makeProcs } from '../../lib/scheduling'

const ALGOS: { id: Algo; hint: string }[] = [
  { id: 'fcfs', hint: 'Dans l’ordre d’arrivée' },
  { id: 'sjf', hint: 'Le plus court d’abord' },
  { id: 'rr', hint: 'Tourniquet à quantum' },
]

export function Explore() {
  const [bursts, setBursts] = useState([8, 3, 5, 2])
  const [algo, setAlgo] = useState<Algo>('fcfs')
  const [quantum, setQuantum] = useState(3)
  const [speed, setSpeed] = useState(1.5)
  const [t, setT] = useState(-0.001)
  const [playing, setPlaying] = useState(false)
  const proxy = useRef({ t: 0 })

  const procs = useMemo(() => makeProcs(bursts), [bursts])
  const sch = useMemo(() => computeSchedule(algo, procs, quantum), [algo, procs, quantum])
  const all = useMemo(() => (['fcfs', 'sjf', 'rr'] as Algo[]).map((a) => computeSchedule(a, procs, quantum)), [procs, quantum])

  // toute modification des paramètres remet la simulation à zéro
  useEffect(() => { setPlaying(false); setT(-0.001); proxy.current.t = 0 }, [bursts, algo, quantum])

  // moteur de lecture : GSAP fait avancer le temps simulé
  useEffect(() => {
    if (!playing) return
    if (proxy.current.t >= sch.total) proxy.current.t = 0
    const tw = gsap.to(proxy.current, {
      t: sch.total,
      duration: Math.max(0.01, (sch.total - proxy.current.t) / speed),
      ease: 'none',
      onUpdate: () => setT(proxy.current.t),
      onComplete: () => setPlaying(false),
    })
    return () => { tw.kill() }
  }, [playing, speed, sch.total])

  const seek = (v: number) => { proxy.current.t = v; setT(v === 0 ? -0.001 : v) }
  const reset = () => { setPlaying(false); seek(0) }
  const step = () => { setPlaying(false); seek(Math.min(sch.total, Math.floor(proxy.current.t + 1e-6) + 1)) }
  const toggle = () => setPlaying((p) => !p)
  const tt = Math.max(0, t)
  const finished = tt >= sch.total
  const exec = executedAt(sch, tt)
  const m = sch.metrics
  const bestW = Math.min(...all.map((s) => s.metrics.avgWaiting))

  const setBurst = (i: number, v: number) => setBursts((b) => b.map((x, j) => (j === i ? v : x)))

  return (
    <div className="grid min-h-full gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_350px]">
      {/* Scène */}
      <section className="glass flex min-w-0 flex-col gap-3 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto">
        <SchedulerMachine procs={procs} schedule={sch} t={t} className="w-full shrink-0" />
        <GanttChart procs={procs} schedule={sch} t={t} className="w-full shrink-0" label="Diagramme de Gantt" sublabel={`${fmt(sch.total)} unités de temps`} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Attente moyenne" value={m.avgWaiting} best={m.avgWaiting === bestW} />
          <Metric label="Rotation moyenne" value={m.avgTurnaround} />
          <Metric label="Réponse moyenne" value={m.avgResponse} />
          <Metric label="Chgts de contexte" value={m.switches} decimals={0} />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[460px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-widest text-white/40">
              <tr><th className="p-3 font-medium">Processus</th><th className="font-medium">Durée</th><th className="font-medium">Avancement</th><th className="font-medium">Attente</th><th className="pr-3 text-right font-medium">État</th></tr>
            </thead>
            <tbody>
              {procs.map((p) => {
                const ex = exec[p.id] ?? 0
                const isDone = ex >= p.burst - 1e-9
                const running = !finished && tt > 0 && sch.slices.some((s) => s.pid === p.id && tt >= s.start && tt < s.end)
                const wait = isDone ? m.waiting[p.id] : Math.max(0, tt - ex)
                return (
                  <tr key={p.id} className="border-t border-white/[.07]">
                    <td className="p-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: p.color }} /><b>{p.name}</b></td>
                    <td className="font-mono text-white/70">{p.burst}</td>
                    <td className="w-[34%] pr-4"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${(ex / p.burst) * 100}%`, background: p.color }} /></div></td>
                    <td className="font-mono text-white/70">{fmt(Number(wait.toFixed(1)))}</td>
                    <td className="pr-3 text-right text-[12px]">
                      {isDone ? <span className="text-[var(--mint)]">terminé</span> : running ? <span style={{ color: p.color }}>● exécution</span> : <span className="text-white/40">en attente</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Panneau de contrôle */}
      <aside className="glass flex flex-col gap-5 p-5 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex gap-2">
          <button onClick={() => (finished ? (seek(0), setPlaying(true)) : toggle())} className="btn-primary flex-1 justify-center">
            {playing ? <><Pause size={17} /> Pause</> : <><Play size={17} /> {finished ? 'Relancer' : tt > 0 ? 'Reprendre' : 'Lancer'}</>}
          </button>
          <button onClick={step} className="icon-btn" aria-label="Avancer d’une unité" title="Avancer d’une unité"><StepForward size={18} /></button>
          <button onClick={reset} className="icon-btn" aria-label="Réinitialiser" title="Réinitialiser"><RotateCcw size={18} /></button>
        </div>

        <label className="block">
          <span className="eyebrow">Position dans le temps</span>
          <input type="range" className="range mt-2" min={0} max={sch.total} step={0.05} value={tt}
            onChange={(e) => { setPlaying(false); seek(Number(e.target.value)) }} />
        </label>

        <div>
          <div className="eyebrow mb-2">Algorithme</div>
          <div className="grid gap-1.5">
            {ALGOS.map((a) => (
              <button key={a.id} onClick={() => setAlgo(a.id)} data-active={algo === a.id} className="seg">
                <b>{ALGO_LABEL[a.id]}</b><span>{a.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid transition-all duration-500" style={{ gridTemplateRows: algo === 'rr' ? '1fr' : '0fr', opacity: algo === 'rr' ? 1 : 0 }}>
          <div className="overflow-hidden">
            <label className="block rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
              <div className="flex justify-between"><span className="eyebrow">Quantum</span><b className="font-mono text-[var(--mint)]">{quantum}</b></div>
              <input type="range" className="range mt-2" min={1} max={10} value={quantum} onChange={(e) => setQuantum(Number(e.target.value))} />
              <div className="mt-1 text-[11.5px] text-white/45">Temps max. de CPU avant préemption</div>
            </label>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Durées d’exécution</span>
            <div className="flex gap-1">
              <button className="icon-btn !h-7 !w-7" disabled={bursts.length <= 2} onClick={() => setBursts((b) => b.slice(0, -1))} aria-label="Retirer un processus"><Minus size={14} /></button>
              <button className="icon-btn !h-7 !w-7" disabled={bursts.length >= PALETTE.length} onClick={() => setBursts((b) => [...b, 4])} aria-label="Ajouter un processus"><Plus size={14} /></button>
            </div>
          </div>
          <div className="space-y-3">
            {procs.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-8 text-[13px] font-semibold" style={{ color: p.color }}>{p.name}</span>
                <input type="range" className="range" style={{ ['--c' as string]: p.color }} min={1} max={12} value={p.burst} onChange={(e) => setBurst(i, Number(e.target.value))} aria-label={`Durée de ${p.name}`} />
                <span className="w-6 text-right font-mono text-[13px]">{p.burst}</span>
              </div>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="flex justify-between"><span className="eyebrow flex items-center gap-1.5"><Gauge size={13} /> Vitesse</span><b className="font-mono text-[13px]">{speed.toFixed(1).replace('.', ',')} u/s</b></div>
          <input type="range" className="range mt-2" min={0.5} max={5} step={0.5} value={speed} onChange={(e) => setSpeed(clamp(Number(e.target.value), 0.5, 5))} />
        </label>

        <div>
          <div className="eyebrow mb-2">Attente moyenne — comparaison</div>
          <div className="space-y-1.5">
            {all.map((s) => {
              const v = s.metrics.avgWaiting
              const best = v === bestW
              return (
                <div key={s.algo} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[88px] text-white/65">{ALGO_LABEL[s.algo]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(v / Math.max(...all.map((x) => x.metrics.avgWaiting))) * 100}%`, background: best ? 'var(--mint)' : '#8b7bff' }} /></div>
                  <b className="w-10 text-right font-mono">{fmt(Number(v.toFixed(2)))}</b>
                </div>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}

function Metric({ label, value, decimals = 2, best }: { label: string; value: number; decimals?: number; best?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.035] px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/45">{label}</div>
      <div className={`mt-1 font-mono text-2xl ${best ? 'text-[var(--mint)]' : 'text-white'}`}><AnimatedNumber value={value} decimals={decimals} /></div>
    </div>
  )
}

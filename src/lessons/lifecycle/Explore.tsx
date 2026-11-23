import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Cpu, Hourglass, Lightbulb, Pause, Play, Plus, Rocket, RotateCcw, SkipForward, Square, Undo2, Zap } from 'lucide-react'
import { LifecycleStage, STATE_COLOR, placePose, type StageToken } from '../../components/LifecycleStage'
import { StateDiagram } from '../../components/StateDiagram'
import { playSfx } from '../../audio/sfx'
import { PALETTE } from '../../lib/scheduling'
import {
  type Action, MAX_PROCS, type PState, STATE_LABEL, type Sim, type WaitReason, WAIT_LABEL,
  apply, find, initialSim, suggest,
} from '../../lib/lifecycle'

/**
 * Mode Exploration — simulation interactive du cycle de vie.
 * Le moteur (src/lib/lifecycle.ts) applique les règles d'un système d'exploitation : une action impossible est
 * refusée avec sa raison. Chaque événement est un pas : l'élève voit la transition, sa cause et ses conséquences,
 * et peut revenir en arrière.
 */
interface Entry { sim: Sim; title: string; why: string; kind: 'ok' | 'info'; trans?: { from: PState; to: PState; id: number } }

const START: Entry = { sim: initialSim(), kind: 'info', title: 'La simulation est prête', why: 'Un seul processeur, aucun processus. Créez un processus : il naîtra dans l’état Nouveau.' }

/** Exemple guidé : suite d'événements qui parcourt tout le cycle (les identifiants sont ceux d'une simulation vierge) */
const DEMO: Action[] = [
  { type: 'create' }, { type: 'create' }, { type: 'create' },
  { type: 'admit', id: 1 }, { type: 'admit', id: 2 }, { type: 'admit', id: 3 },
  { type: 'elect' }, { type: 'block', id: 1, reason: 'network' }, { type: 'elect' },
  { type: 'wake', id: 1 }, { type: 'preempt', id: 2 }, { type: 'elect' },
  { type: 'end', id: 3 }, { type: 'elect' }, { type: 'end', id: 1 }, { type: 'elect' }, { type: 'end', id: 2 },
]

const EDGE_OF = (from: PState, to: PState) => (from === 'ready' && to === 'running' ? 0 : from === 'running' && to === 'ready' ? 1 : from === 'running' && to === 'blocked' ? 2 : from === 'blocked' && to === 'ready' ? 3 : null)
const LEGAL_EDGES: Partial<Record<PState, number[]>> = { ready: [0], running: [1, 2], blocked: [3] }
const REASONS: WaitReason[] = ['disk', 'network', 'keyboard']
const REASON_NAME: Record<WaitReason, string> = { disk: 'Disque', network: 'Réseau', keyboard: 'Clavier' }
const colorOf = (id: number) => PALETTE[(id - 1) % PALETTE.length]

export function Explore() {
  const [hist, setHist] = useState<Entry[]>([START])
  const [sel, setSel] = useState<number | null>(null)
  const [reason, setReason] = useState<WaitReason>('network')
  const [refusal, setRefusal] = useState<{ why: string; n: number } | null>(null)
  const [demo, setDemo] = useState<{ i: number; playing: boolean } | null>(null)

  const cur = hist[hist.length - 1]
  const sim = cur.sim
  const curRef = useRef(cur)
  curRef.current = cur

  const selected = sel !== null ? find(sim, sel) : undefined

  const run = (a: Action, fromDemo = false) => {
    if (!fromDemo) setDemo(null)
    const c = curRef.current
    const o = apply(c.sim, a)
    if (!o.ok) { setRefusal((r) => ({ why: o.why, n: (r?.n ?? 0) + 1 })); return false }
    setRefusal(null)
    setHist((h) => [...h.slice(-80), { sim: o.sim, kind: 'ok', title: o.title, why: o.why, trans: o.transition }])
    if (a.type === 'create') { setSel(c.sim.nextId); playSfx('appear', { pitch: 0 }) }
    else {
      if ('id' in a && a.id !== undefined) setSel(a.id)
      else if (a.type === 'elect') setSel(c.sim.ready[0] ?? null)
      playSfx(a.type === 'elect' ? 'enter' : a.type === 'end' ? 'done' : a.type === 'wake' ? 'appear' : a.type === 'admit' ? 'appear' : 'move', { pitch: a.type === 'wake' ? 3 : a.type === 'admit' ? 1 : 0, gain: 0.8 })
    }
    return true
  }
  const reset = () => { setDemo(null); setHist([START]); setSel(null); setRefusal(null) }
  const undo = () => { setDemo(null); setRefusal(null); setHist((h) => (h.length > 1 ? h.slice(0, -1) : h)) }

  // exemple guidé : un événement toutes les 1,8 s (ou « étape suivante » à la main)
  const demoRef = useRef(demo)
  demoRef.current = demo
  const stepDemo = () => {
    const d = demoRef.current
    if (!d) return
    const a = DEMO[d.i]
    if (a) run(a, true)
    setDemo(d.i + 1 >= DEMO.length ? { i: DEMO.length, playing: false } : { ...d, i: d.i + 1 })
  }
  const startDemo = () => { setHist([START]); curRef.current = START; setSel(null); setRefusal(null); setDemo({ i: 0, playing: true }) }
  useEffect(() => {
    if (!demo?.playing) return
    const id = window.setTimeout(stepDemo, 1800)
    return () => window.clearTimeout(id)
  }, [demo]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- scène ---------- */
  const tokens: StageToken[] = useMemo(() => {
    const news = sim.procs.filter((p) => p.state === 'new')
    const dones = sim.procs.filter((p) => p.state === 'terminated')
    return sim.procs.map((p) => {
      let place
      if (p.state === 'ready') place = { zone: 'queue' as const, i: sim.ready.indexOf(p.id) }
      else if (p.state === 'running') place = { zone: 'cpu' as const }
      else if (p.state === 'blocked') place = { zone: 'blocked' as const, i: sim.blocked.indexOf(p.id) }
      else if (p.state === 'new') place = { zone: 'new' as const, i: news.indexOf(p) }
      else { const k = dones.length - 1 - dones.indexOf(p); place = k < 6 ? { zone: 'done' as const, i: 5 - k } : { zone: 'off' as const } }
      const small = p.state === 'new' || p.state === 'terminated'
      return {
        id: String(p.id), label: p.name, color: colorOf(p.id), pose: placePose(place), running: p.state === 'running', selected: p.id === sel,
        name: p.state === 'blocked' && p.waiting ? WAIT_LABEL[p.waiting].replace('le ', '') : undefined,
        sub: small ? undefined : STATE_LABEL[p.state], subColor: STATE_COLOR[p.state],
        mark: p.state === 'terminated' ? ('check' as const) : null,
      }
    })
  }, [sim, sel])

  const run1 = sim.cpu !== null ? find(sim, sim.cpu) : undefined
  const lastEdge = cur.trans ? EDGE_OF(cur.trans.from, cur.trans.to) : null
  const hint = suggest(sim, sel)
  const live = sim.procs.filter((p) => p.state !== 'terminated').length
  const ok = (a: Action) => apply(sim, a).ok
  const dim = (a: Action) => !ok(a)
  const sid = selected?.id ?? -1

  const why = refusal ? { kind: 'no' as const, title: 'Action impossible', why: refusal.why } : { kind: cur.kind, title: cur.title, why: cur.why }
  const demoOn = demo !== null

  return (
    <div className="grid min-h-full gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_350px]">
      {/* Scène */}
      <section className="glass flex min-w-0 flex-col gap-3 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto">
        <LifecycleStage
          className="w-full shrink-0" tokens={tokens} extended smooth cpuBusy={!!run1} cpuColor={run1 ? colorOf(run1.id) : STATE_COLOR.running}
          onSelect={(id) => setSel(Number(id))} label="Simulation : processus répartis entre Nouveau, Prêts, CPU, Bloqués et Terminés. Cliquez un processus pour le sélectionner."
        />

        {/* Ce qui vient de se passer */}
        <div
          key={refusal ? `r${refusal.n}` : `h${hist.length}`} role="status" aria-live="polite"
          className={`beat-in flex items-start gap-3 rounded-2xl border px-4 py-3 ${why.kind === 'no' ? 'shake border-[var(--coral)]/50 bg-[var(--coral)]/10' : why.kind === 'ok' ? 'border-[var(--mint)]/35 bg-[var(--mint)]/[.07]' : 'border-white/10 bg-white/[.035]'}`}
        >
          <span className="mt-0.5 shrink-0" style={{ color: why.kind === 'no' ? 'var(--coral)' : why.kind === 'ok' ? 'var(--mint)' : 'var(--accent)' }}>{why.kind === 'no' ? <Ban size={18} /> : <Zap size={18} />}</span>
          <div className="min-w-0">
            <div className="font-display text-[14px]">{why.title}</div>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/75">{why.why}</p>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-2">
            <div className="eyebrow px-2 pt-1">Modèle à trois états</div>
            <StateDiagram className="mt-1 w-full" compact active={lastEdge} current={selected && (selected.state === 'ready' || selected.state === 'running' || selected.state === 'blocked') ? selected.state : null} legal={selected ? LEGAL_EDGES[selected.state] ?? [] : null} />
            <p className="px-2 pb-1 text-[11.5px] leading-snug text-white/45">Nouveau et Terminé n’appartiennent pas au modèle du cours : ils montrent le cycle complet. {selected ? `Flèches claires : ce que ${selected.name} peut faire maintenant.` : 'Sélectionnez un processus pour voir ses transitions possibles.'}</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[360px] text-left text-[13px]">
              <caption className="sr-only">État de chaque processus</caption>
              <thead className="text-[11px] uppercase tracking-widest text-white/40">
                <tr><th className="p-3 font-medium">Processus</th><th className="font-medium">État</th><th className="font-medium">Tours de CPU</th><th className="pr-3 text-right font-medium">Attend</th></tr>
              </thead>
              <tbody>
                {sim.procs.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-white/40">Aucun processus pour l’instant.</td></tr>}
                {sim.procs.map((p) => (
                  <tr key={p.id} className={`border-t border-white/[.07] ${p.id === sel ? 'bg-white/[.06]' : ''}`}>
                    <td className="p-1.5">
                      <button onClick={() => setSel(p.id)} aria-pressed={p.id === sel} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/[.06]">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorOf(p.id) }} /><b>{p.name}</b>
                      </button>
                    </td>
                    <td><span className="rounded-full border px-2 py-0.5 text-[11.5px]" style={{ borderColor: `${STATE_COLOR[p.state]}88`, color: STATE_COLOR[p.state], background: `${STATE_COLOR[p.state]}14` }}>{STATE_LABEL[p.state]}</span></td>
                    <td className="font-mono text-white/70">{p.turns}</td>
                    <td className="pr-3 text-right text-[12px] text-white/55">{p.waiting ? WAIT_LABEL[p.waiting] : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="eyebrow mb-2">Journal des événements</div>
          <ol className="scroll-thin max-h-[150px] space-y-1 overflow-y-auto text-[12.5px]" reversed>
            {[...hist].reverse().filter((h) => h.kind === 'ok').slice(0, 12).map((h, i) => (
              <li key={hist.length - i} className="flex gap-2 text-white/65" style={{ opacity: i === 0 ? 1 : 0.7 }}>
                <span className="font-mono text-white/30">{String(hist.length - 1 - i).padStart(2, '0')}</span>
                <span><b className="font-medium text-white/90">{h.title}</b></span>
              </li>
            ))}
            {hist.length === 1 && <li className="text-white/35">Rien pour l’instant.</li>}
          </ol>
        </div>
      </section>

      {/* Panneau de contrôle */}
      <aside className="glass flex flex-col gap-4 p-5 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex gap-2">
          <button onClick={undo} disabled={hist.length <= 1} className="btn-ghost flex-1 justify-center !h-11"><Undo2 size={16} /> Étape précédente</button>
          <button onClick={reset} className="icon-btn !h-11 !w-11" aria-label="Réinitialiser la simulation" title="Réinitialiser"><RotateCcw size={18} /></button>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[.08] px-3.5 py-3 text-[13px] leading-snug">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
          <span className="text-white/80">{demoOn ? 'Exemple guidé : regardez ce qui provoque chaque transition.' : hint}</span>
        </div>

        <div>
          <div className="eyebrow mb-2">Événements du système</div>
          <div className="grid gap-1.5">
            <button className="seg" data-dim={live >= MAX_PROCS} onClick={() => run({ type: 'create' })}><b className="flex items-center gap-1.5"><Plus size={14} /> Créer un processus</b><span>naît dans l’état Nouveau</span></button>
            <button className="seg" data-dim={dim({ type: 'elect' })} onClick={() => run({ type: 'elect' })}><b className="flex items-center gap-1.5"><Cpu size={14} /> Ordonnanceur : élire</b><span>choisit le premier de la file des Prêts</span></button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Sur le processus sélectionné</span>
            {selected ? <span className="chip !py-0.5 !text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(selected.id) }} /><b>{selected.name}</b><span style={{ color: STATE_COLOR[selected.state] }}>{STATE_LABEL[selected.state]}</span></span> : <span className="text-[12px] text-white/40">cliquez un processus</span>}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button className="seg" data-dim={dim({ type: 'admit', id: sid })} onClick={() => run({ type: 'admit', id: sid })}><b className="flex items-center gap-1.5"><Rocket size={14} /> Lancer</b><span>Nouveau → Prêt</span></button>
            <button className="seg" data-dim={dim({ type: 'elect', id: sid })} onClick={() => run({ type: 'elect', id: sid })}><b className="flex items-center gap-1.5"><Cpu size={14} /> Donner le CPU</b><span>Prêt → Élu</span></button>
            <button className="seg" data-dim={dim({ type: 'preempt', id: sid })} onClick={() => run({ type: 'preempt', id: sid })}><b className="flex items-center gap-1.5"><Square size={14} /> Retirer le CPU</b><span>Élu → Prêt</span></button>
            <button className="seg" data-dim={dim({ type: 'block', id: sid, reason })} onClick={() => run({ type: 'block', id: sid, reason })}><b className="flex items-center gap-1.5"><Hourglass size={14} /> Attendre une E/S</b><span>Élu → Bloqué</span></button>
            <button className="seg" data-dim={dim({ type: 'wake', id: sid })} onClick={() => run({ type: 'wake', id: sid })}><b className="flex items-center gap-1.5"><Zap size={14} /> Fin de l’attente</b><span>Bloqué → Prêt</span></button>
            <button className="seg" data-dim={dim({ type: 'end', id: sid })} onClick={() => run({ type: 'end', id: sid })}><b className="flex items-center gap-1.5"><Ban size={14} /> Terminer</b><span>fin du processus</span></button>
          </div>
          <div className="mt-2.5 flex items-center gap-2" role="radiogroup" aria-label="Ce que le processus attend">
            <span className="text-[12px] text-white/50">E/S :</span>
            {REASONS.map((r) => (
              <button key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className="chip !py-1 hover:bg-white/10" data-active={reason === r} style={reason === r ? { borderColor: 'rgba(139,123,255,.7)', background: 'rgba(139,123,255,.2)' } : undefined}>{REASON_NAME[r]}</button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
          <div className="eyebrow mb-2">Exemple guidé</div>
          {!demoOn || demo.i >= DEMO.length ? (
            <button className="btn-ghost w-full justify-center !h-10 !text-[12.5px]" onClick={startDemo}><Play size={15} /> {demoOn ? 'Rejouer l’exemple' : 'Voir un cycle complet'}</button>
          ) : (
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 justify-center !h-10 !text-[12.5px]" onClick={() => setDemo((d) => (d ? { ...d, playing: !d.playing } : d))}>{demo.playing ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Reprendre</>}</button>
              <button className="btn-ghost flex-1 justify-center !h-10 !text-[12.5px]" onClick={() => { setDemo((d) => (d ? { ...d, playing: false } : d)); stepDemo() }}><SkipForward size={15} /> Étape suivante</button>
            </div>
          )}
          <p className="mt-2 text-[11.5px] leading-snug text-white/45">{demoOn ? `Étape ${Math.min(demo.i, DEMO.length)} sur ${DEMO.length}. Toute action manuelle arrête l’exemple.` : 'Lance une suite d’événements qui parcourt tout le cycle, étape par étape.'}</p>
        </div>

        <div className="text-[11.5px] leading-relaxed text-white/45">
          <b className="font-medium text-white/65">Règles du système :</b> un seul processus Élu à la fois · seul l’ordonnanceur attribue le CPU, dans l’ordre de la file · un processus Bloqué repasse toujours par Prêt.
        </div>
      </aside>
    </div>
  )
}

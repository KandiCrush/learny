import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Check, Lightbulb, Pause, Play, RotateCcw, SkipForward, TriangleAlert, Undo2, Zap } from 'lucide-react'
import { ConcurrencyBoard, procColor } from '../../components/ConcurrencyBoard'
import { STATE_COLOR } from '../../components/LifecycleStage'
import { playSfx } from '../../audio/sfx'
import {
  type EvKind, type Machine, type Params, type Policy, type Scenario,
  check, defaults, expected, finished, init, pick, step, stuck,
} from '../../lib/concurrency'

/**
 * Laboratoire de concurrence : le moteur (src/lib/concurrency.ts) est le SEUL à décider de ce qui se passe.
 * Ici : choix du scénario, de l'entrelacement (automatique ou à la main), pas à pas, retour arrière, journal.
 */
const SCENARIOS: { id: Scenario; letter: string; name: string; hint: string }[] = [
  { id: 'race', letter: 'A', name: 'Sans protection', hint: 'retraits concurrents sur un solde' },
  { id: 'spin', letter: 'B', name: 'Attente active', hint: 'spinlock, Test and Set' },
  { id: 'mutex', letter: 'C', name: 'Mutex bloquant', hint: 'file d’attente, états des processus' },
  { id: 'sem', letter: 'D', name: 'Sémaphores', hint: 'binaire ou de comptage, P et V' },
]
type UiPolicy = Policy | 'manual'
const POLICIES: { id: UiPolicy; name: string; hint: string }[] = [
  { id: 'alternate', name: 'Alterné', hint: 'une instruction chacun, à tour de rôle' },
  { id: 'sequential', name: 'Séquentiel', hint: 'le premier va jusqu’au bout' },
  { id: 'manual', name: 'À la main', hint: 'vous choisissez qui avance' },
]

const WHY: Record<EvKind, string> = {
  read: 'Le processus copie la valeur partagée dans son registre local : à partir de maintenant, il travaille sur SA copie.',
  calc: 'Le calcul porte sur la copie locale : si quelqu’un modifie le solde entre-temps, ce processus ne le sait pas.',
  write: 'L’écriture remplace la valeur partagée par la copie locale, quoi qu’elle contienne à cet instant.',
  acquire: 'Le processus est maintenant propriétaire / détenteur : il peut entrer dans la section critique.',
  refuse: 'Attente active : le processus reste sur le CPU (Prêt / Élu) et recommence. Chaque tentative consomme un tour de processeur.',
  release: 'La ressource est libérée : personne n’attendait, elle redevient disponible.',
  block: 'Attente bloquante : Élu → Bloqué. Le processus quitte le CPU et n’est plus ordonnancé tant qu’il n’est pas réveillé : aucun test répété.',
  wake: 'Réveil : Bloqué → Prêt (pas Élu). Le processus est en tête de file et attend que l’ordonnanceur lui donne le CPU.',
  use: 'Le processus travaille avec la ressource : il est dans la section critique.',
  test: 'Il a vu le verrou libre, mais il ne l’a pas encore pris : un autre processus peut s’intercaler avant l’écriture.',
}

const SOUND: Partial<Record<EvKind, [Parameters<typeof playSfx>[0], number, number]>> = {
  acquire: ['enter', 0, 0.8], refuse: ['move', 0, 0.25], release: ['done', 0, 0.6], block: ['move', 0, 0.7], wake: ['appear', 3, 0.8],
}

interface Notice { kind: 'info' | 'ok' | 'no'; title: string; text: string }
const WELCOME: Notice = { kind: 'info', title: 'Laboratoire de concurrence', text: 'Choisissez un scénario, puis lancez la simulation ou faites avancer un processus à la fois. Le résultat dépend de l’ordre des instructions.' }

/** Exécute tout l'exemple d'un trait (sans affichage) pour comparer deux mécanismes à ordre identique */
function simulate(params: Params, policy: Policy): Machine {
  let m = init(params)
  for (let i = 0; i < 400 && !finished(m); i++) {
    const p = pick(m, policy)
    if (p === null) break
    const r = step(m, p)
    if (!r.ok) break
    m = r.m
  }
  return m
}

export function Explore() {
  const [scenario, setScenario] = useState<Scenario>('race')
  const [atomic, setAtomic] = useState(true)
  const [n, setN] = useState(2)
  const [counting, setCounting] = useState(false)
  const [permits, setPermits] = useState(3)
  const [policy, setPolicy] = useState<UiPolicy>('alternate')
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)

  const params: Params = useMemo(() => {
    const d = defaults(scenario)
    if (scenario === 'race') return { ...d, n: 2 }
    if (scenario === 'spin') return { ...d, n, atomic }
    if (scenario === 'mutex') return { ...d, n }
    return { ...d, n, permits: counting ? permits : 1, resource: counting ? 'printers' : 'generic' }
  }, [scenario, atomic, n, counting, permits])

  const [hist, setHist] = useState<Machine[]>(() => [init(params)])
  const [notice, setNotice] = useState<Notice>(WELCOME)
  const m = hist[hist.length - 1]
  const ref = useRef(m)
  ref.current = m

  // toute modification du scénario ou des paramètres repart d'un état neuf, dans le même rendu (jamais d'état périmé)
  const [seen, setSeen] = useState(params)
  if (seen !== params) { setSeen(params); setHist([init(params)]); setPlaying(false); setNotice(WELCOME) }

  const ui = policy === 'manual' ? 'alternate' : policy

  const apply = (pid: number, auto: boolean) => {
    const cur = ref.current
    const r = step(cur, pid)
    if (!r.ok) { setNotice({ kind: 'no', title: 'Action impossible', text: r.why }); setPlaying(false); return false }
    setHist((h) => [...h.slice(-150), r.m])
    const ev = r.ev
    const s = SOUND[ev.kind]
    if (s) playSfx(s[0], { pitch: s[1], gain: s[2] })
    const done = finished(r.m)
    setNotice({
      kind: ev.kind === 'refuse' ? 'no' : 'ok',
      title: ev.text,
      text: done
        ? `Tous les processus ont terminé. ${params.scenario === 'sem' ? 'Toutes les autorisations ont été rendues.' : r.m.balance === expected(params) ? `Solde final ${r.m.balance} $ : correct.` : `Solde final ${r.m.balance} $ au lieu de ${expected(params)} $ : mise à jour perdue.`}`
        : WHY[ev.kind],
    })
    if (done || stuck(r.m)) setPlaying(false)
    void auto
    return true
  }

  const stepAuto = () => {
    const cur = ref.current
    if (finished(cur)) { setPlaying(false); setNotice({ kind: 'info', title: 'Simulation terminée', text: 'Revenez en arrière ou réinitialisez pour rejouer avec un autre ordre.' }); return }
    if (policy === 'manual') { setPlaying(false); setNotice({ kind: 'no', title: 'Mode « à la main »', text: 'Choisissez vous-même quel processus exécute la prochaine instruction (boutons sous les commandes), ou passez en ordre Alterné / Séquentiel.' }); return }
    const pid = pick(cur, ui)
    if (pid === null) { setPlaying(false); setNotice({ kind: 'no', title: 'Aucun processus exécutable', text: 'Tous les processus restants sont bloqués : personne ne pourrait les réveiller (interblocage).' }); return }
    apply(pid, true)
  }
  const stepAutoRef = useRef(stepAuto)
  stepAutoRef.current = stepAuto

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => stepAutoRef.current(), 900 / speed)
    return () => window.clearTimeout(id)
  }, [playing, hist.length, speed])

  const reset = () => { setPlaying(false); setHist([init(params)]); setNotice(WELCOME) }
  const undo = () => { setPlaying(false); setHist((h) => (h.length > 1 ? h.slice(0, -1) : h)); setNotice({ kind: 'info', title: 'Retour d’une étape', text: 'L’état revient exactement à ce qu’il était avant l’instruction annulée.' }) }
  const toggle = () => {
    if (finished(m)) { setNotice({ kind: 'info', title: 'Simulation terminée', text: 'Réinitialisez ou revenez en arrière pour rejouer.' }); return }
    setPlaying((p) => !p)
  }

  /* ---------- indicateurs ---------- */
  const problems = check(m)
  const fin = finished(m)
  const exp = expected(params)
  const first = hist.length === 1
  const compareParams: Params | null = scenario === 'spin' ? { ...params, scenario: 'mutex' } : scenario === 'mutex' ? { ...params, scenario: 'spin', atomic: true } : null
  const cmp = useMemo(() => (compareParams ? simulate(compareParams, ui) : null), [scenario, params, ui]) // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => simulate(params, ui), [params, ui])
  const spinM = scenario === 'spin' ? mine : cmp
  const mutexM = scenario === 'mutex' ? mine : cmp

  const hint = scenario === 'race' ? 'Essayez Alterné, puis Séquentiel : le même programme donne deux résultats.'
    : scenario === 'spin' ? (atomic ? 'Regardez le compteur de tentatives de P2 et le coût CPU pendant que P1 est dans la section critique.' : 'Sans atomicité : en mode Alterné, les deux processus passent le test avant que l’un écrive.')
      : scenario === 'mutex' ? 'Observez la file : un processus bloqué n’exécute aucune tentative, et le coût CPU reste nul.'
        : counting ? `Avec ${permits} autorisations, jamais plus de ${permits} processus ne détiennent une imprimante.` : 'Avec une seule autorisation, un seul processus à la fois est dans la section critique.'

  const runnableIds = (id: number) => { const p = m.procs[id - 1]; return p.state === 'ready' || p.state === 'running' }

  return (
    <div className="grid min-h-full gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_350px]">
      {/* Scène */}
      <section className="glass flex min-w-0 flex-col gap-3 p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto">
        <ConcurrencyBoard m={m} pulse={first ? 0 : 0.6} className="w-full shrink-0" label="Laboratoire : processus, ressource partagée et mécanisme de protection" />

        <div key={`${hist.length}-${notice.title}`} role="status" aria-live="polite"
          className={`beat-in flex items-start gap-3 rounded-2xl border px-4 py-3 ${notice.kind === 'no' ? 'border-[var(--coral)]/50 bg-[var(--coral)]/10' : notice.kind === 'ok' ? 'border-[var(--mint)]/35 bg-[var(--mint)]/[.07]' : 'border-white/10 bg-white/[.035]'}`}>
          <span className="mt-0.5 shrink-0" style={{ color: notice.kind === 'no' ? 'var(--coral)' : notice.kind === 'ok' ? 'var(--mint)' : 'var(--accent)' }}>{notice.kind === 'no' ? <Ban size={18} /> : <Zap size={18} />}</span>
          <div className="min-w-0">
            <div className="font-display text-[14px]">{notice.title}</div>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/75">{notice.text}</p>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
            <div className="eyebrow mb-2">Vérifications</div>
            <ul className="space-y-1.5 text-[13px]">
              <Check1 ok={!m.violation} label={scenario === 'sem' ? `Jamais plus de ${params.permits} dans la section critique` : 'Un seul processus à la fois dans la section critique'} bad={scenario === 'race' || (scenario === 'spin' && !atomic) ? 'Section critique partagée par plusieurs processus : conflit !' : 'Violation de l’exclusion mutuelle détectée'} />
              {scenario !== 'sem' && <Check1 ok={!fin || m.balance === exp} pending={!fin} label={fin ? `Solde final correct : ${m.balance} $` : `Solde final attendu : ${exp} $`} bad={`Solde final ${m.balance} $ au lieu de ${exp} $ : mise à jour perdue`} />}
              {scenario === 'sem' && <Check1 ok={problems.length === 0} label={`Autorisations conservées : S + détenues = ${m.value} + ${m.holders.length} = ${params.permits}`} bad={problems.join(' ; ')} />}
              {scenario !== 'sem' && scenario !== 'race' && <Check1 ok={problems.length === 0} label="États des processus cohérents (Prêt / Élu / Bloqué)" bad={problems.join(' ; ')} />}
            </ul>
          </div>

          {(scenario === 'spin' || scenario === 'mutex') && spinM && mutexM && (
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
              <div className="eyebrow mb-2">Coût de l’attente — même exemple, même ordre</div>
              <div className="space-y-2.5 text-[12.5px]">
                {[['Spinlock (TAS)', spinM, STATE_COLOR.blocked], ['Mutex bloquant', mutexM, STATE_COLOR.running]].map(([name, mm, color]) => {
                  const x = mm as Machine
                  const w = x.tick ? (x.wasted / x.tick) * 100 : 0
                  return (
                    <div key={name as string}>
                      <div className="mb-1 flex justify-between text-white/65"><span>{name as string}</span><b className="font-mono text-white">{x.wasted} / {x.tick} tours gaspillés</b></div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, background: color as string }} /></div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-white/45">Un tour « gaspillé » est une tentative refusée : le processus occupe le CPU sans progresser. Un processus bloqué n’en consomme aucun.</p>
            </div>
          )}
        </div>

        <div>
          <div className="eyebrow mb-2">Journal des événements</div>
          <ol className="scroll-thin max-h-[190px] space-y-1 overflow-y-auto text-[12.5px]">
            {[...m.log].reverse().slice(0, 40).map((e) => (
              <li key={e.tick} className="flex gap-2 text-white/70">
                <span className="w-6 font-mono text-white/30">{String(e.tick).padStart(2, '0')}</span>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: procColor(e.pid) }} />
                <span style={{ color: e.kind === 'refuse' ? 'var(--coral)' : undefined }}>{e.text}</span>
              </li>
            ))}
            {m.log.length === 0 && <li className="text-white/35">Rien pour l’instant.</li>}
          </ol>
        </div>
      </section>

      {/* Panneau de contrôle */}
      <aside className="glass flex flex-col gap-4 p-5 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex gap-2">
          <button onClick={toggle} className="btn-primary flex-1 justify-center !h-11">{playing ? <><Pause size={16} /> Pause</> : <><Play size={16} /> {first ? 'Lancer' : fin ? 'Terminé' : 'Reprendre'}</>}</button>
          <button onClick={() => { setPlaying(false); stepAuto() }} className="icon-btn !h-11 !w-11" aria-label="Pas suivant" title="Pas suivant (selon l’ordre choisi)"><SkipForward size={18} /></button>
          <button onClick={undo} disabled={hist.length <= 1} className="icon-btn !h-11 !w-11" aria-label="Étape précédente" title="Étape précédente"><Undo2 size={18} /></button>
          <button onClick={reset} className="icon-btn !h-11 !w-11" aria-label="Réinitialiser" title="Réinitialiser"><RotateCcw size={18} /></button>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[.08] px-3.5 py-3 text-[13px] leading-snug">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden /><span className="text-white/80">{hint}</span>
        </div>

        <div>
          <div className="eyebrow mb-2">Scénario</div>
          <div className="grid gap-1.5">
            {SCENARIOS.map((s) => (
              <button key={s.id} className="seg" data-active={scenario === s.id} onClick={() => setScenario(s.id)}><b>{s.letter} · {s.name}</b><span>{s.hint}</span></button>
            ))}
          </div>
        </div>

        {/* paramètres du scénario */}
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
          <div className="eyebrow">Paramètres</div>
          {scenario === 'spin' && (
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Type de verrou">
              <button role="radio" aria-checked={atomic} className="seg" data-active={atomic} onClick={() => setAtomic(true)}><b>Test and Set</b><span>atomique</span></button>
              <button role="radio" aria-checked={!atomic} className="seg" data-active={!atomic} onClick={() => setAtomic(false)}><b>Tester, puis écrire</b><span>2 instructions</span></button>
            </div>
          )}
          {scenario === 'sem' && (
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Type de sémaphore">
              <button role="radio" aria-checked={!counting} className="seg" data-active={!counting} onClick={() => setCounting(false)}><b>Binaire</b><span>1 autorisation</span></button>
              <button role="radio" aria-checked={counting} className="seg" data-active={counting} onClick={() => setCounting(true)}><b>De comptage</b><span>N autorisations</span></button>
            </div>
          )}
          {scenario === 'sem' && counting && (
            <label className="block"><div className="flex justify-between"><span className="text-[12px] text-white/55">Autorisations initiales</span><b className="font-mono text-[var(--mint)]">{permits}</b></div>
              <input type="range" className="range mt-1" min={1} max={4} value={permits} onChange={(e) => setPermits(Number(e.target.value))} aria-label="Nombre initial d’autorisations" /></label>
          )}
          {scenario !== 'race' && (
            <label className="block"><div className="flex justify-between"><span className="text-[12px] text-white/55">Processus</span><b className="font-mono text-[var(--mint)]">{n}</b></div>
              <input type="range" className="range mt-1" min={2} max={scenario === 'sem' ? 5 : 3} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Nombre de processus" /></label>
          )}
          <div>
            <div className="mb-1.5 text-[12px] text-white/55">Ordre des instructions</div>
            <div className="grid gap-1.5" role="radiogroup" aria-label="Ordre d’exécution">
              {POLICIES.map((p) => <button key={p.id} role="radio" aria-checked={policy === p.id} className="seg" data-active={policy === p.id} onClick={() => setPolicy(p.id)}><b>{p.name}</b><span>{p.hint}</span></button>)}
            </div>
          </div>
          <label className="block"><div className="flex justify-between"><span className="text-[12px] text-white/55">Vitesse</span><b className="font-mono text-[12px]">{speed.toFixed(1).replace('.', ',')}×</b></div>
            <input type="range" className="range mt-1" min={0.5} max={3} step={0.5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Vitesse de la simulation" /></label>
        </div>

        <div>
          <div className="eyebrow mb-2">Faire avancer un processus</div>
          <div className="flex flex-wrap gap-1.5">
            {m.procs.map((p) => (
              <button key={p.id} onClick={() => { setPlaying(false); apply(p.id, false) }} data-dim={!runnableIds(p.id)} className="seg !flex-row !items-center !gap-2 !py-2" style={{ opacity: runnableIds(p.id) ? 1 : 0.5 }} title={runnableIds(p.id) ? `Exécuter une instruction de ${p.name}` : `${p.name} ne peut pas avancer`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: procColor(p.id) }} /><b>{p.name}</b>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-white/45">Chaque clic exécute UNE instruction : c’est vous qui choisissez l’entrelacement. Un processus bloqué ou terminé ne peut pas avancer.</p>
        </div>
      </aside>
    </div>
  )
}

function Check1({ ok, label, bad, pending }: { ok: boolean; label: string; bad: string; pending?: boolean }) {
  return (
    <li className="flex items-start gap-2" style={{ color: ok ? (pending ? 'rgba(255,255,255,.6)' : STATE_COLOR.running) : STATE_COLOR.blocked }}>
      {ok ? (pending ? <span className="mt-1 h-3 w-3 shrink-0 rounded-full border border-white/30" /> : <Check size={15} className="mt-0.5 shrink-0" />) : <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
      <span>{ok ? label : bad}</span>
    </li>
  )
}

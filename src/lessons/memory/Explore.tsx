import { useMemo, useState } from 'react'
import { Ban, Check, Dices, Lightbulb, Minus, Play, Plus, RotateCcw, Scissors, Shrink, Undo2, Zap } from 'lucide-react'
import { FREE, BAD, MemoryBar, memColor } from '../../components/MemoryBar'
import { playSfx } from '../../audio/sfx'
import {
  type Mem, type Mode, type Op, STRATEGIES, STRATEGY_LABEL, type Strategy,
  allocate, bitmap, check, compact, find, linkedList, makeMem, release, runOps, stats,
} from '../../lib/memory'
import { blocksOfMem } from './story'
import { M6 } from './story'

/**
 * Laboratoire de mémoire : le moteur (src/lib/memory.ts) décide de TOUT — allocation, libération, fusion des trous,
 * compactage, échecs expliqués. Les barres sont dessinées à partir de l'état du moteur, avec des blocs proportionnels.
 * Deux onglets : « Laboratoire » (une mémoire, vous commandez) et « Comparer » (quatre stratégies, mêmes opérations).
 */
const OS = 4
type Tab = 'lab' | 'compare'

interface P { id: number; size: number; done: boolean }
interface Snap { mem: Mem; procs: P[] }
interface Notice { kind: 'info' | 'ok' | 'no'; title: string; text: string }

const defaultParts = (cap: number) => {
  const user = cap - OS
  const a = Math.max(1, Math.round(user * 0.3)), b = Math.max(1, Math.round(user * 0.3))
  return [a, b, Math.max(1, user - a - b)]
}
const WELCOME: Notice = { kind: 'info', title: 'Laboratoire de mémoire', text: 'Créez des processus (taille en Mo), puis allouez-les. Chaque opération est expliquée, et un échec vous dit pourquoi.' }
const mo = (n: number) => `${Math.round(n * 10) / 10} Mo`

export function Explore() {
  const [tab, setTab] = useState<Tab>('lab')
  return (
    <div className="flex min-h-full flex-col gap-3 lg:h-full lg:min-h-0">
      <div role="tablist" aria-label="Mode du laboratoire" className="flex shrink-0 gap-1.5 self-start rounded-full border border-white/10 bg-white/[.04] p-1">
        {([['lab', 'Laboratoire', 'Une mémoire, vous commandez'], ['compare', 'Comparer les stratégies', 'Mêmes opérations, quatre algorithmes']] as const).map(([id, name, hint]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} title={hint}
            className="rounded-full px-4 py-1.5 font-display text-[12.5px] transition-colors" style={{ background: tab === id ? 'rgba(139,123,255,.28)' : 'transparent', color: tab === id ? '#fff' : 'rgba(238,240,255,.6)', boxShadow: tab === id ? 'inset 0 0 0 1px rgba(139,123,255,.6)' : undefined }}>{name}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{tab === 'lab' ? <Lab /> : <Compare />}</div>
    </div>
  )
}

/* ================================================================== */
/* Onglet 1 — un laboratoire                                           */
/* ================================================================== */
function Lab() {
  const [mode, setMode] = useState<Mode>('variable')
  const [cap, setCap] = useState(32)
  const [parts, setParts] = useState(() => defaultParts(32))
  const [strategy, setStrategy] = useState<Strategy>('first')
  const [newSize, setNewSize] = useState(6)
  const [view, setView] = useState<'blocks' | 'bits' | 'list'>('blocks')
  const fresh = (m: Mode, c: number, p: number[]): Snap[] => [{ mem: makeMem(m, c, OS, m === 'fixed' ? p : undefined), procs: [] }]
  const [hist, setHist] = useState<Snap[]>(() => fresh('variable', 32, defaultParts(32)))
  const [notice, setNotice] = useState<Notice>(WELCOME)
  const [log, setLog] = useState<string[]>([])

  // configuration modifiée → mémoire neuve, dans le même rendu (jamais d'état périmé)
  const cfg = `${mode}|${cap}|${mode === 'fixed' ? parts.join(',') : ''}`
  const [seen, setSeen] = useState(cfg)
  if (seen !== cfg) { setSeen(cfg); setHist(fresh(mode, cap, parts)); setNotice(WELCOME); setLog([]) }

  const { mem, procs } = hist[hist.length - 1]
  const s = stats(mem)
  const problems = check(mem)
  const userSpace = cap - OS
  const push = (snap: Snap, title: string, text: string, kind: Notice['kind'], sound?: Parameters<typeof playSfx>[0]) => {
    setHist((h) => [...h.slice(-80), snap])
    setNotice({ kind, title, text })
    setLog((l) => [title, ...l].slice(0, 30))
    if (sound) playSfx(sound, { gain: 0.8 })
  }
  const refuse = (title: string, text: string) => setNotice({ kind: 'no', title, text })

  const create = () => {
    if (procs.filter((p) => !p.done).length >= 9) return refuse('Trop de processus', 'Pour garder la simulation lisible, 9 processus au plus. Libérez ou terminez-en.')
    if (newSize > userSpace) return refuse('Processus trop grand', `${newSize} Mo dépasse la mémoire utilisable (${userSpace} Mo, le système en réserve ${OS}) : il ne pourra jamais être chargé, même avec une mémoire vide.`)
    const id = (procs.reduce((a, p) => Math.max(a, p.id), 0)) + 1
    push({ mem, procs: [...procs, { id, size: newSize, done: false }] }, `P${id} créé (${newSize} Mo)`, `P${id} attend en mémoire de masse. Demandez son allocation pour voir où le gestionnaire le place (stratégie : ${STRATEGY_LABEL[strategy]}).`, 'ok', 'appear')
  }

  const doAlloc = (p: P) => {
    const r = allocate(mem, p.id, p.size, strategy)
    if (!r.ok) return refuse(`P${p.id} : allocation impossible`, r.why)
    const where = `${r.block.start}–${r.block.start + r.block.size} Mo`
    const search = r.visited.length
    const extra = mem.mode === 'fixed' ? (r.leftover > 0 ? ` La partition fait ${r.block.size} Mo : ${r.leftover} Mo restent inutilisés (fragmentation interne).` : ' Ajustement parfait : aucune perte.') : (mem.blocks.find((b) => b.kind === 'free' && b.start === r.block.start + r.block.size) ? ' La zone libre est découpée : le reste redevient un trou.' : ' La zone libre est consommée en entier.')
    push({ mem: r.mem, procs: procs.map((x) => (x.id === p.id ? { ...x, done: false } : x)) }, `P${p.id} alloué en ${where}`, `${STRATEGY_LABEL[strategy]} a examiné ${search} zone${search > 1 ? 's' : ''} libre${search > 1 ? 's' : ''}.${extra}`, 'ok', 'enter')
  }

  const doRelease = (p: P) => {
    const r = release(mem, p.id)
    if (!r.ok) return refuse(`P${p.id} : rien à libérer`, r.why)
    push({ mem: r.mem, procs: procs.map((x) => (x.id === p.id ? { ...x, done: true } : x)) }, `P${p.id} libéré`, r.merged ? 'Sa zone devient un trou et fusionne avec le trou voisin : les deux ne forment plus qu’une zone libre.' : mem.mode === 'fixed' ? 'La partition redevient libre, avec sa taille d’origine (elle ne fusionne pas).' : 'Sa zone devient un trou, entouré de zones occupées.', 'ok', 'done')
  }

  const doCompact = () => {
    const r = compact(mem)
    if (!r.ok) return refuse('Compactage impossible', r.why)
    push({ mem: r.mem, procs }, `Compactage : ${mo(r.cost)} copiés`, `${r.moves.map((m) => `P${m.pid} : ${m.from} → ${m.to}`).join(' · ')}. Tous les trous sont regroupés en une zone de ${mo(stats(r.mem).largestFree)}. Coût : ${mo(r.cost)} à copier, processus suspendus, adresses de base mises à jour.`, 'ok', 'move')
  }

  const undo = () => { if (hist.length > 1) { setHist((h) => h.slice(0, -1)); setNotice({ kind: 'info', title: 'Étape annulée', text: 'La mémoire est revenue exactement à son état précédent.' }) } }
  const reset = () => { setHist(fresh(mode, cap, parts)); setNotice(WELCOME); setLog([]) }

  /* --- éditeur de partitions (mode fixe) : la somme reste égale à la mémoire utilisable --- */
  const move = (i: number, d: 1 | -1) => {
    const j = i < parts.length - 1 ? i + 1 : i - 1
    if (j < 0) return
    const next = [...parts]
    next[i] += d; next[j] -= d
    if (next[i] < 1 || next[j] < 1) return refuse('Partition trop petite', 'Une partition fait au moins 1 Mo. Agrandissez-en une autre d’abord.')
    setParts(next)
  }
  const split = (i: number) => { if (parts[i] < 2) return refuse('Partition trop petite', 'Une partition de 1 Mo ne peut pas être scindée.'); const next = [...parts]; next.splice(i, 1, Math.floor(parts[i] / 2), Math.ceil(parts[i] / 2)); setParts(next) }
  const merge = (i: number) => { if (i >= parts.length - 1) return refuse('Fusion impossible', 'Il n’y a pas de partition après la dernière.'); const next = [...parts]; next.splice(i, 2, parts[i] + parts[i + 1]); setParts(next) }
  const changeCap = (c: number) => { setCap(c); setParts(defaultParts(c)) }

  const geom = { x: 20, y: 36, w: 960, h: 92, capacity: cap }
  const blocks = useMemo(() => blocksOfMem(mem), [mem])
  const partitions = mem.mode === 'fixed' ? mem.blocks.filter((b) => b.kind !== 'os').map((b) => ({ start: b.start, size: b.size })) : undefined
  const waiting = procs.filter((p) => !find(mem, p.id) && !p.done)
  const bits = useMemo(() => bitmap(mem), [mem])
  const nodes = useMemo(() => linkedList(mem), [mem])
  const ownerAt = (i: number) => { const b = mem.blocks.find((x) => x.start <= i && i < x.start + x.size)!; return b.kind === 'os' ? '#8a90b5' : b.kind === 'free' ? FREE : memColor(b.pid!) }

  const hint = mode === 'variable' ? 'Créez P1 (6), P2 (4), P3 (8), allouez-les, libérez P2, puis demandez 6 Mo : essayez sans puis avec compactage.' : 'Essayez un processus de 1 Mo dans une partition de 8 : regardez l’espace perdu à l’intérieur.'

  return (
    <div className="grid min-h-full gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="glass flex min-w-0 flex-col gap-3 p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto">
        <div className="eyebrow flex flex-wrap items-center justify-between gap-2"><span>RAM · {cap} Mo · {mode === 'variable' ? 'partitions variables' : `partitions fixes (${parts.join(' / ')})`}</span><span className="normal-case tracking-normal text-white/45">Système : 0–{OS} Mo</span></div>
        <svg viewBox={`0 0 1000 ${view === 'blocks' ? 190 : 190}`} className="w-full shrink-0" role="img" aria-label="Mémoire vive : blocs proportionnels à leur taille">
          <MemoryBar geom={geom} blocks={blocks} partitions={partitions} partO={1} tickO={1} />
        </svg>

        {/* En attente */}
        <div className="flex min-h-[34px] flex-wrap items-center gap-2 text-[12.5px]">
          <span className="eyebrow">En attente</span>
          {waiting.length === 0 && <span className="text-white/35">aucun processus</span>}
          {waiting.map((p) => <span key={p.id} className="rounded-full border px-3 py-1" style={{ borderColor: `${memColor(p.id)}aa`, background: `${memColor(p.id)}1f` }}><b>P{p.id}</b> · {p.size} Mo</span>)}
        </div>

        <div role="status" aria-live="polite" key={`${hist.length}-${notice.title}`} className={`beat-in flex items-start gap-3 rounded-2xl border px-4 py-3 ${notice.kind === 'no' ? 'border-[var(--coral)]/50 bg-[var(--coral)]/10' : notice.kind === 'ok' ? 'border-[var(--mint)]/35 bg-[var(--mint)]/[.07]' : 'border-white/10 bg-white/[.035]'}`}>
          <span className="mt-0.5 shrink-0" style={{ color: notice.kind === 'no' ? 'var(--coral)' : notice.kind === 'ok' ? 'var(--mint)' : 'var(--accent)' }}>{notice.kind === 'no' ? <Ban size={18} /> : <Zap size={18} />}</span>
          <div className="min-w-0"><div className="font-display text-[14px]">{notice.title}</div><p className="mt-0.5 text-[13.5px] leading-relaxed text-white/75">{notice.text}</p></div>
        </div>

        {/* indicateurs : calculés sur l'état réel de la mémoire */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Utilisée" value={mo(s.used)} sub={`${s.allocated} Mo attribués`} />
          <Stat label="Libre" value={mo(s.free)} color={FREE} sub={`${s.holes} zone${s.holes > 1 ? 's' : ''}`} />
          <Stat label="Plus grande zone libre" value={mo(s.largestFree)} color={FREE} />
          {mode === 'fixed' ? <Stat label="Fragmentation interne" value={mo(s.internal)} color={s.internal ? BAD : undefined} sub="attribué mais inutilisé" /> : <Stat label="Fragmentation externe" value={`${Math.round(s.external * 100)} %`} color={s.external ? BAD : undefined} sub={s.holes > 1 ? `1 − ${s.largestFree}/${s.free}` : 'une seule zone'} />}
          <Stat label="Système" value={mo(s.os)} />
          <Stat label="Cohérence" value={problems.length ? 'ANOMALIE' : 'OK'} color={problems.length ? BAD : FREE} sub={problems.length ? problems[0] : 'sans chevauchement'} />
        </div>

        {/* vues du gestionnaire */}
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Vue de la mémoire">
            {([['blocks', 'Zones'], ['bits', 'Table de bits'], ['list', 'Liste chaînée']] as const).map(([id, name]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className="chip hover:bg-white/10" style={view === id ? { borderColor: 'rgba(139,123,255,.7)', background: 'rgba(139,123,255,.2)' } : undefined}>{name}</button>
            ))}
          </div>
          {view === 'blocks' && (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <caption className="sr-only">Zones de la mémoire</caption>
                <thead className="text-[11px] uppercase tracking-widest text-white/40"><tr><th className="p-3 font-medium">Zone</th><th className="font-medium">Début</th><th className="font-medium">Fin</th><th className="font-medium">Taille</th><th className="pr-3 font-medium">Détail</th></tr></thead>
                <tbody>
                  {mem.blocks.map((b) => (
                    <tr key={b.start} className="border-t border-white/[.07]">
                      <td className="p-2.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: b.kind === 'free' ? FREE : b.kind === 'os' ? '#8a90b5' : memColor(b.pid!) }} /><b>{b.kind === 'os' ? 'Système' : b.kind === 'free' ? 'Libre' : `P${b.pid}`}</b></td>
                      <td className="font-mono text-white/70">{b.start}</td><td className="font-mono text-white/70">{b.start + b.size}</td><td className="font-mono text-white/70">{b.size} Mo</td>
                      <td className="pr-3 text-[12px] text-white/50">{b.kind === 'proc' && mem.mode === 'fixed' ? `utilise ${b.used} Mo${b.size > (b.used ?? 0) ? ` · perd ${b.size - (b.used ?? 0)}` : ''}` : b.kind === 'free' && mem.mode === 'fixed' ? 'partition libre' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view === 'bits' && (
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3">
              <div className="flex flex-wrap gap-1" aria-label="Table de bits, une case par Mo">
                {bits.map((b, i) => <span key={i} title={`${i}–${i + 1} Mo : ${b ? 'occupé' : 'libre'}`} className="grid h-7 w-7 place-items-center rounded-md border font-mono text-[12px]" style={{ borderColor: b ? ownerAt(i) : FREE, background: b ? `${ownerAt(i)}33` : 'rgba(94,234,212,.08)' }}>{b}</span>)}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-white/45">Une case = 1 Mo (1 occupé, 0 libre). Pour allouer {newSize} Mo, il faut trouver {newSize} cases libres d’affilée : plus la mémoire est grande, plus cette recherche est longue.</p>
            </div>
          )}
          {view === 'list' && (
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]" aria-label="Liste chaînée des zones">
                {nodes.map((n, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-white/30">→</span>}
                    <span className="rounded-xl border px-2.5 py-1.5" style={{ borderColor: n.type === 'H' ? FREE : n.label === 'SE' ? '#8a90b5' : memColor(Number(n.label.slice(1))) }}>
                      <b>{n.type === 'H' ? 'Libre' : n.label}</b><span className="ml-2 font-mono text-white/55">{n.start} · {n.size}</span>
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-white/45">Chaque nœud : type (occupée ou libre), adresse de début, taille. Une libération fusionne les nœuds libres voisins.</p>
            </div>
          )}
        </div>

        <div>
          <div className="eyebrow mb-2">Journal</div>
          <ol className="scroll-thin max-h-[120px] space-y-1 overflow-y-auto text-[12.5px] text-white/70">
            {log.length === 0 && <li className="text-white/35">Rien pour l’instant.</li>}
            {log.map((l, i) => <li key={`${i}-${l}`} className="flex gap-2"><span className="w-6 font-mono text-white/30">{String(log.length - i).padStart(2, '0')}</span>{l}</li>)}
          </ol>
        </div>
      </section>

      {/* Commandes */}
      <aside className="glass flex flex-col gap-4 p-5 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex gap-2">
          <button onClick={undo} disabled={hist.length <= 1} className="btn-ghost flex-1 justify-center !h-11"><Undo2 size={16} /> Étape précédente</button>
          <button onClick={reset} className="icon-btn !h-11 !w-11" aria-label="Réinitialiser" title="Réinitialiser"><RotateCcw size={18} /></button>
        </div>
        <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[.08] px-3.5 py-3 text-[13px] leading-snug"><Lightbulb size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden /><span className="text-white/80">{hint}</span></div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
          <div className="eyebrow">Mémoire</div>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Type de partitions">
            <button role="radio" aria-checked={mode === 'variable'} className="seg" data-active={mode === 'variable'} onClick={() => setMode('variable')}><b>Variables</b><span>taille = demande</span></button>
            <button role="radio" aria-checked={mode === 'fixed'} className="seg" data-active={mode === 'fixed'} onClick={() => setMode('fixed')}><b>Fixes</b><span>découpées à l’avance</span></button>
          </div>
          <label className="block"><div className="flex justify-between"><span className="text-[12px] text-white/55">Capacité totale</span><b className="font-mono text-[var(--mint)]">{cap} Mo</b></div>
            <input type="range" className="range mt-1" min={16} max={64} step={4} value={cap} onChange={(e) => changeCap(Number(e.target.value))} aria-label="Capacité de la mémoire" /></label>
          {mode === 'fixed' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between"><span className="text-[12px] text-white/55">Partitions (total {userSpace} Mo)</span><button className="text-[11.5px] underline text-white/50 hover:text-white" onClick={() => setParts(defaultParts(cap))}>par défaut</button></div>
              <div className="space-y-1.5">
                {parts.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-2 py-1">
                    <span className="w-16 font-mono text-[12.5px]">{p} Mo</span>
                    <button className="icon-btn !h-7 !w-7" onClick={() => move(i, -1)} aria-label={`Réduire la partition ${i + 1}`}><Minus size={13} /></button>
                    <button className="icon-btn !h-7 !w-7" onClick={() => move(i, 1)} aria-label={`Agrandir la partition ${i + 1}`}><Plus size={13} /></button>
                    <button className="icon-btn !h-7 !w-7" onClick={() => split(i)} aria-label={`Scinder la partition ${i + 1}`} title="Scinder en deux"><Scissors size={13} /></button>
                    <button className="icon-btn !h-7 !w-7" onClick={() => merge(i)} aria-label={`Fusionner la partition ${i + 1} avec la suivante`} title="Fusionner avec la suivante"><Shrink size={13} /></button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-white/40">± déplace la limite avec la partition voisine. Modifier la configuration remet la mémoire à zéro.</p>
            </div>
          )}
        </div>

        <div>
          <div className="eyebrow mb-2">Stratégie d’allocation</div>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Stratégie">
            {STRATEGIES.map((st) => <button key={st} role="radio" aria-checked={strategy === st} className="seg" data-active={strategy === st} onClick={() => setStrategy(st)}><b>{STRATEGY_LABEL[st]}</b><span>{{ first: 'le premier qui convient', next: 'reprend où il s’est arrêté', best: 'le plus petit qui convient', worst: 'le plus grand' }[st]}</span></button>)}
          </div>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
          <div className="eyebrow">Nouveau processus</div>
          <label className="block"><div className="flex justify-between"><span className="text-[12px] text-white/55">Taille demandée</span><b className="font-mono text-[var(--mint)]">{newSize} Mo</b></div>
            <input type="range" className="range mt-1" min={1} max={Math.max(2, Math.min(userSpace, 24))} value={Math.min(newSize, userSpace)} onChange={(e) => setNewSize(Number(e.target.value))} aria-label="Taille du processus" /></label>
          <button className="btn-ghost w-full justify-center !h-10 !text-[12.5px]" onClick={create}><Plus size={15} /> Créer le processus</button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between"><span className="eyebrow">Processus</span>
            <button className="chip !py-1 hover:bg-white/10" onClick={doCompact} title={mode === 'variable' ? 'Regrouper les zones libres en déplaçant les processus' : 'Sans objet avec des partitions fixes'}>Compacter</button></div>
          <div className="space-y-1.5">
            {procs.length === 0 && <p className="text-[12.5px] text-white/40">Aucun processus : créez-en un ci-dessus.</p>}
            {procs.map((p) => {
              const b = find(mem, p.id)
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-white/10 px-2.5 py-1.5" style={{ opacity: p.done ? 0.5 : 1 }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: memColor(p.id) }} />
                  <span className="w-[74px] text-[12.5px]"><b>P{p.id}</b> <span className="text-white/50">{p.size} Mo</span></span>
                  <span className="flex-1 truncate text-[11.5px] text-white/45">{b ? `${b.start}–${b.start + b.size}` : p.done ? 'terminé' : 'en attente'}</span>
                  <button className="chip !py-0.5 hover:bg-white/10" onClick={() => doAlloc(p)} data-dim={!!b}>Allouer</button>
                  <button className="chip !py-0.5 hover:bg-white/10" onClick={() => doRelease(p)}>Libérer</button>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-white/45">Les boutons restent actifs même quand l’action est impossible : l’explication s’affiche.</p>
        </div>
      </aside>
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.035] px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-0.5 font-mono text-[17px]" style={{ color: color ?? '#fff' }}>{value}</div>
      {sub && <div className="truncate text-[10.5px] text-white/40" title={sub}>{sub}</div>}
    </div>
  )
}

/* ================================================================== */
/* Onglet 2 — comparer les stratégies sur la même séquence             */
/* ================================================================== */
type Base = 'new' | 'course'
const COURSE_OPS: Op[] = [6, 7, 8, 9].map((pid) => ({ type: 'alloc' as const, pid, size: ({ 6: 2, 7: 6, 8: 4, 9: 4 } as Record<number, number>)[pid] }))

function Compare() {
  const [base, setBase] = useState<Base>('course')
  const [cap, setCap] = useState(32)
  const [ops, setOps] = useState<Op[]>(COURSE_OPS)
  const [step, setStep] = useState(COURSE_OPS.length)
  const [size, setSize] = useState(4)
  const [seed, setSeed] = useState(1)

  const capacity = base === 'course' ? 32 : cap
  const start: Mem = useMemo(() => (base === 'course' ? M6 : makeMem('variable', capacity, OS)), [base, capacity])
  const firstPid = base === 'course' ? 6 : 1
  const runs = useMemo(() => Object.fromEntries(STRATEGIES.map((s) => [s, runOps(start, ops, s)])) as Record<Strategy, ReturnType<typeof runOps>>, [start, ops])
  const k = Math.min(step, ops.length)
  const nextPid = ops.reduce((a, o) => (o.type === 'alloc' ? Math.max(a, o.pid + 1) : a), firstPid)
  const livePids = (() => { const set = new Set<number>(base === 'course' ? [4, 5] : []); ops.forEach((o) => (o.type === 'alloc' ? set.add(o.pid) : set.delete(o.pid))); return [...set] })()

  const setAll = (o: Op[], toEnd = true) => { setOps(o); if (toEnd) setStep(o.length) }
  const addAlloc = () => setAll([...ops, { type: 'alloc', pid: nextPid, size }])
  const addFree = (pid: number) => setAll([...ops, { type: 'free', pid }])
  const random = () => {
    let x = (seed * 9301 + 49297) % 233280
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280 }
    const out: Op[] = []
    const live: number[] = base === 'course' ? [4, 5] : []
    let pid = firstPid
    for (let i = 0; i < 9; i++) {
      if (live.length > 1 && rnd() < 0.4) { const j = Math.floor(rnd() * live.length); out.push({ type: 'free', pid: live[j] }); live.splice(j, 1) }
      else { out.push({ type: 'alloc', pid, size: 2 + Math.floor(rnd() * 7) }); live.push(pid); pid++ }
    }
    setSeed(seed + 1); setAll(out)
    playSfx('appear', { pitch: 2, gain: 0.5 })
  }

  const label = (o: Op) => (o.type === 'alloc' ? `+P${o.pid} ${o.size} Mo` : `−P${o.pid}`)

  return (
    <div className="grid min-h-full gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="glass flex min-w-0 flex-col gap-3 p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Séquence</span>
          {ops.length === 0 && <span className="text-[12.5px] text-white/40">vide : ajoutez des opérations →</span>}
          {ops.map((o, i) => (
            <button key={i} onClick={() => setStep(i + 1)} className="rounded-full border px-2.5 py-0.5 text-[12px] transition-colors" style={{ borderColor: o.type === 'alloc' ? `${memColor(o.pid)}aa` : 'rgba(255,255,255,.25)', background: i < k ? (o.type === 'alloc' ? `${memColor(o.pid)}26` : 'rgba(255,255,255,.1)') : 'transparent', opacity: i < k ? 1 : 0.5 }} title={`Aller après l’opération ${i + 1}`}>{i + 1}. {label(o)}</button>
          ))}
        </div>

        <div className="grid gap-2" aria-label="Mémoire de chaque stratégie après l’opération sélectionnée">
          {STRATEGIES.map((s) => {
            const m = runs[s].mems[k]
            const st = stats(m)
            const res = runs[s].results
            const fails = res.slice(0, k).filter((r) => !r.ok && r.op.type === 'alloc').length
            const last = k > 0 ? res[k - 1] : null
            const visited = res.slice(0, k).reduce((a, r) => a + (r.visited ?? 0), 0)
            const marks = last?.ok && last.block ? [{ start: last.block.start, size: last.block.size, kind: 'pick' as const, o: 0.9 }] : []
            return (
              <div key={s} className="rounded-2xl border border-white/10 bg-white/[.025] p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <b className="font-display text-[13.5px]">{STRATEGY_LABEL[s]}</b>
                  <span className="flex flex-wrap gap-1.5 text-[11.5px]">
                    <span className="chip !py-0.5" style={{ color: fails ? BAD : FREE }}>{fails ? <Ban size={12} /> : <Check size={12} />} {fails} échec{fails > 1 ? 's' : ''}</span>
                    <span className="chip !py-0.5">plus grand trou <b className="font-mono">{st.largestFree} Mo</b></span>
                    <span className="chip !py-0.5">{st.holes} trou{st.holes > 1 ? 's' : ''}</span>
                    <span className="chip !py-0.5">frag. ext. <b className="font-mono">{Math.round(st.external * 100)} %</b></span>
                    <span className="chip !py-0.5" title="Nombre de zones libres examinées depuis le début">{visited} zones examinées</span>
                  </span>
                </div>
                <svg viewBox="0 0 1000 78" className="w-full" role="img" aria-label={`Mémoire avec ${STRATEGY_LABEL[s]}`}>
                  <MemoryBar geom={{ x: 10, y: 8, w: 980, h: 52, capacity }} blocks={blocksOfMem(m)} marks={marks} small tickO={0} />
                </svg>
                {last && !last.ok && <p className="mt-1 text-[12px]" style={{ color: BAD }}>{label(last.op)} : {last.why}</p>}
              </div>
            )
          })}
        </div>
        <p className="text-[11.5px] leading-snug text-white/45">Mêmes données de départ, mêmes opérations, quatre algorithmes : les différences viennent uniquement du choix de la zone libre. « Zones examinées » mesure le coût de recherche.</p>
      </section>

      <aside className="glass flex flex-col gap-4 p-5 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex gap-2">
          <button className="btn-primary flex-1 justify-center !h-11" onClick={() => setStep(k >= ops.length ? 0 : k + 1)} disabled={ops.length === 0}><Play size={16} /> {k >= ops.length ? 'Rejouer' : 'Opération suivante'}</button>
          <button className="icon-btn !h-11 !w-11" onClick={() => setStep(Math.max(0, k - 1))} disabled={k === 0} aria-label="Opération précédente"><Undo2 size={18} /></button>
          <button className="icon-btn !h-11 !w-11" onClick={() => setAll([])} aria-label="Vider la séquence"><RotateCcw size={18} /></button>
        </div>
        <label className="block"><div className="flex justify-between"><span className="eyebrow">Après l’opération</span><b className="font-mono text-[13px]">{k} / {ops.length}</b></div>
          <input type="range" className="range mt-2" min={0} max={Math.max(1, ops.length)} value={k} onChange={(e) => setStep(Number(e.target.value))} aria-label="Position dans la séquence" /></label>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
          <div className="eyebrow">Mémoire de départ</div>
          <div className="grid gap-1.5" role="radiogroup" aria-label="Mémoire de départ">
            <button role="radio" aria-checked={base === 'course'} className="seg" data-active={base === 'course'} onClick={() => { setBase('course'); setAll(COURSE_OPS) }}><b>Celle du cours</b><span>32 Mo, trous de 5, 9 et 4 Mo</span></button>
            <button role="radio" aria-checked={base === 'new'} className="seg" data-active={base === 'new'} onClick={() => { setBase('new'); setAll([]) }}><b>Mémoire neuve</b><span>une seule grande zone libre</span></button>
          </div>
          {base === 'new' && <label className="block"><div className="flex justify-between"><span className="text-[12px] text-white/55">Capacité</span><b className="font-mono text-[var(--mint)]">{cap} Mo</b></div>
            <input type="range" className="range mt-1" min={16} max={64} step={4} value={cap} onChange={(e) => { setCap(Number(e.target.value)); setAll([]) }} aria-label="Capacité de la mémoire" /></label>}
        </div>

        <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[.03] p-3.5">
          <div className="eyebrow">Ajouter une opération</div>
          <label className="block"><div className="flex justify-between"><span className="text-[12px] text-white/55">Demande de mémoire</span><b className="font-mono text-[var(--mint)]">{size} Mo</b></div>
            <input type="range" className="range mt-1" min={1} max={12} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Taille de la demande" /></label>
          <button className="btn-ghost w-full justify-center !h-10 !text-[12.5px]" onClick={addAlloc}><Plus size={15} /> Allouer P{nextPid} ({size} Mo)</button>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[12px] text-white/55">Libérer :</span>
            {livePids.length === 0 && <span className="text-[12px] text-white/35">aucun processus en mémoire</span>}
            {livePids.map((p) => <button key={p} className="chip !py-0.5 hover:bg-white/10" style={{ borderColor: `${memColor(p)}aa` }} onClick={() => addFree(p)}>P{p}</button>)}</div>
          <button className="btn-ghost w-full justify-center !h-10 !text-[12.5px]" onClick={random}><Dices size={15} /> Séquence aléatoire</button>
          <button className="text-[11.5px] underline text-white/50 hover:text-white" onClick={() => { setBase('course'); setAll(COURSE_OPS) }}>Rétablir la séquence du cours (P6 2 · P7 6 · P8 4 · P9 4)</button>
        </div>
        <p className="text-[11.5px] leading-snug text-white/45">Une opération impossible (libérer un processus absent, allocation refusée) est marquée dans la barre concernée avec sa raison, sans empêcher les autres stratégies de continuer.</p>
      </aside>
    </div>
  )
}

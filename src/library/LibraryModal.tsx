import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowRight, ChevronLeft, ChevronRight, Clock, FlaskConical, BookOpen, LayoutGrid, List, Lock, Search, X } from 'lucide-react'
import { lessonMeta } from '../lessons/registry'
import { Spinner } from '../components/Spinner'
import { d, reducedMotion, soften } from '../lib/motion'
import { useVisited } from '../lib/progress'
import { type FolderNode, type LessonNode, type Node, findNode, flatten } from './catalog'
import { FolderIcon } from './FolderIcon'
import { ICONS } from './icons'

interface Props {
  open: boolean
  origin: DOMRect | null
  onClose: () => void
  onOpenLesson: (lessonId: string) => void
  /** leçon en cours de chargement : les autres actions sont bloquées */
  loadingId?: string | null
  /** chemin à afficher à l'ouverture (ex. dossier de la leçon en cours) */
  startPath?: string[]
}

const durationOf = (lessonId?: string) => {
  const m = lessonId ? lessonMeta[lessonId] : undefined
  return m ? `~${m.minutes} min` : null
}

export function LibraryModal({ open, origin, onClose, onOpenLesson, loadingId = null, startPath = [] }: Props) {
  const [mounted, setMounted] = useState(false)
  const [nav, setNav] = useState<{ entries: string[][]; idx: number }>({ entries: [[]], idx: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const backdrop = useRef<HTMLDivElement>(null)
  const win = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const dir = useRef(1)
  const busy = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)

  const path = nav.entries[nav.idx]
  const chain = useMemo(() => findNode(path), [path])
  const folder = chain[chain.length - 1]
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return flatten().filter(({ node }) => (node.name + ' ' + node.description).toLowerCase().includes(q))
  }, [query])

  // ouverture / fermeture animées
  useEffect(() => { if (open) setMounted(true) }, [open])
  useLayoutEffect(() => {
    if (!mounted || !win.current || !backdrop.current) return
    gsap.killTweensOf([win.current, backdrop.current])
    const r = win.current.getBoundingClientRect()
    const ox = origin ? origin.left + origin.width / 2 - r.left : r.width / 2
    const oy = origin ? origin.top + origin.height / 2 - r.top : r.height / 2
    if (open) {
      setNav({ entries: [startPath], idx: 0 }); setSelected(null); setQuery('')
      returnFocus.current = document.activeElement as HTMLElement | null
      gsap.set(win.current, { transformOrigin: `${ox}px ${oy}px` })
      gsap.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: d(0.4), ease: 'power2.out' })
      gsap.fromTo(win.current, soften({ scale: 0.22, opacity: 0, y: 12, filter: 'blur(14px)' }), { scale: 1, opacity: 1, y: 0, filter: 'blur(0px)', duration: d(0.75), ease: 'expo.out', onComplete: () => win.current?.focus({ preventScroll: true }) })
    } else {
      gsap.set(win.current, { transformOrigin: `${ox}px ${oy}px` })
      gsap.to(backdrop.current, { opacity: 0, duration: d(0.35), ease: 'power2.in' })
      gsap.to(win.current, { ...(reducedMotion() ? {} : { scale: 0.22, filter: 'blur(10px)' }), opacity: 0, duration: d(0.42), ease: 'power3.in', onComplete: () => { setMounted(false); returnFocus.current?.focus({ preventScroll: true }) } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted])

  // apparition des éléments à chaque changement de dossier
  const pathKey = path.join('/') + '|' + (results ? 'q' : '') + view
  useLayoutEffect(() => {
    if (!mounted || !grid.current) return
    const kids = Array.from(grid.current.children)
    gsap.fromTo(kids, soften({ opacity: 0, x: 26 * dir.current, y: 10, scale: 0.94 }), { opacity: 1, x: 0, y: 0, scale: 1, duration: d(0.5), ease: 'power3.out', stagger: reducedMotion() ? 0 : 0.04, delay: nav.idx === 0 && path.length === startPath.length ? 0.2 : 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, mounted])

  const goto = useCallback((p: string[], d: number) => {
    dir.current = d; setSelected(null); setQuery('')
    setNav((n) => ({ entries: [...n.entries.slice(0, n.idx + 1), p], idx: n.idx + 1 }))
  }, [])
  const back = () => { if (nav.idx > 0) { dir.current = -1; setSelected(null); setNav((n) => ({ ...n, idx: n.idx - 1 })) } }
  const forward = () => { if (nav.idx < nav.entries.length - 1) { dir.current = 1; setSelected(null); setNav((n) => ({ ...n, idx: n.idx + 1 })) } }
  const up = () => { if (path.length) goto(path.slice(0, -1), -1) }

  const openNode = (node: Node, trail?: string[], el?: HTMLElement | null) => {
    if (busy.current || loadingId) return
    el?.setAttribute('data-opening', 'true') // retour visuel immédiat
    if (node.kind === 'lesson') { if (node.lessonId) onOpenLesson(node.lessonId); else el?.removeAttribute('data-opening'); return }
    const target = trail ? [...folderIds(trail), node.id] : [...path, node.id]
    if (!el || !grid.current) { goto(target, 1); return }
    busy.current = true
    gsap.to(Array.from(grid.current.children).filter((c) => c !== el), { opacity: 0.25, duration: d(0.25) })
    gsap.to(el, { ...(reducedMotion() ? {} : { scale: 1.18 }), opacity: 0, duration: d(0.32), ease: 'power2.in', onComplete: () => { busy.current = false; goto(target, 1) } })
  }
  // reconstitue le chemin d'ids à partir des noms de dossiers (résultats de recherche)
  const folderIds = (trail: string[]) => {
    const ids: string[] = []
    let cur: FolderNode = chain[0]
    for (const name of trail) { const f = cur.children.find((c) => c.kind === 'folder' && c.name === name) as FolderNode; ids.push(f.id); cur = f }
    return ids
  }

  // clavier
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'Backspace' && (e.target as HTMLElement).tagName !== 'INPUT') back()
      else if ((e.metaKey || e.ctrlKey) && e.key === '[') back()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // flèches du clavier : se déplacer d'une vignette à l'autre
  const arrowNav = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']
    if (!keys.includes(e.key)) return
    const kids = Array.from(e.currentTarget.children) as HTMLElement[]
    const i = kids.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    const cur = kids[i]
    let next: HTMLElement | undefined
    if (e.key === 'ArrowRight') next = kids[i + 1]
    else if (e.key === 'ArrowLeft') next = kids[i - 1]
    else {
      const down = e.key === 'ArrowDown'
      const cand = kids.filter((k) => (down ? k.offsetTop > cur.offsetTop + 4 : k.offsetTop < cur.offsetTop - 4))
      const row = cand.length ? (down ? Math.min(...cand.map((k) => k.offsetTop)) : Math.max(...cand.map((k) => k.offsetTop))) : null
      next = cand.filter((k) => k.offsetTop === row).sort((a, b) => Math.abs(a.offsetLeft - cur.offsetLeft) - Math.abs(b.offsetLeft - cur.offsetLeft))[0]
    }
    next?.focus()
  }

  if (!mounted) return null

  const items = results ? results.map((r) => ({ node: r.node, trail: r.trail })) : folder.children.map((node) => ({ node, trail: undefined as string[] | undefined }))
  const sel = items.find((i) => i.node.id === selected)?.node ?? null
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Bibliothèque de cours">
      <div ref={backdrop} className="absolute inset-0 bg-[#04050c]/70 backdrop-blur-md" onClick={onClose} />
      <div ref={win} tabIndex={-1} data-busy={!!loadingId} aria-busy={!!loadingId} className="lib-window relative outline-none flex h-[min(720px,92dvh)] w-full max-w-[1080px] flex-col overflow-hidden rounded-[26px] border border-white/15 bg-[#0e1021]/90 shadow-[0_40px_120px_-20px_rgba(0,0,0,.8),0_0_0_1px_rgba(255,255,255,.04)_inset] backdrop-blur-3xl">
        {/* Barre de titre */}
        <div className="flex items-center gap-3 border-b border-white/[.08] px-4 py-3">
          <button onClick={onClose} className="dot-close group" aria-label="Fermer la bibliothèque"><X size={9} strokeWidth={3.5} className="opacity-0 transition group-hover:opacity-100" /></button>
          <div className="ml-1 flex gap-1">
            <button className="icon-btn !h-8 !w-8" onClick={back} disabled={nav.idx === 0} aria-label="Dossier précédent"><ChevronLeft size={17} /></button>
            <button className="icon-btn !h-8 !w-8" onClick={forward} disabled={nav.idx >= nav.entries.length - 1} aria-label="Dossier suivant"><ChevronRight size={17} /></button>
          </div>
          <div className="cmd min-w-0 flex-1 truncate text-[14px]">{results ? `Résultats pour « ${query} »` : folder.name}</div>
          <div className="hidden gap-0.5 rounded-xl border border-white/10 bg-white/[.04] p-0.5 sm:flex">
            <button className="seg-icon" data-active={view === 'grid'} onClick={() => setView('grid')} aria-label="Icônes"><LayoutGrid size={15} /></button>
            <button className="seg-icon" data-active={view === 'list'} onClick={() => setView('list')} aria-label="Liste"><List size={15} /></button>
          </div>
          <label className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null) }} placeholder="Rechercher" className="h-9 w-28 rounded-xl border border-white/10 bg-white/[.05] pl-8 pr-3 text-[13px] outline-none transition-all placeholder:text-white/35 focus:w-44 focus:border-[var(--accent)]/60 sm:w-36" />
          </label>
        </div>

        {/* Contenu */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) setSelected(null) }}>
            {items.length === 0 && <div className="grid h-full place-items-center text-sm text-white/40">Aucun résultat</div>}
            {view === 'grid' ? (
              <div ref={grid} data-bg="1" onKeyDown={arrowNav} role="group" aria-label="Contenu du dossier" className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                {items.map(({ node, trail }) => (
                  <Tile key={node.id} node={node} selected={selected === node.id} loading={loadingId !== null && node.kind === 'lesson' && node.lessonId === loadingId} busy={!!loadingId}
                    onSelect={(el) => (coarse ? openNode(node, trail, el) : setSelected(node.id))}
                    onOpen={(el) => openNode(node, trail, el)} trail={trail} />
                ))}
              </div>
            ) : (
              <div ref={grid} data-bg="1" onKeyDown={arrowNav} role="group" aria-label="Contenu du dossier" className="space-y-1">
                {items.map(({ node, trail }) => (
                  <Row key={node.id} node={node} selected={selected === node.id} onSelect={() => (coarse ? openNode(node, trail) : setSelected(node.id))} onOpen={(el) => openNode(node, trail, el)} />
                ))}
              </div>
            )}
          </div>

          <Preview loadingId={loadingId} node={sel ?? (results ? null : folder)} isFolderContext={!sel} onOpen={() => sel && openNode(sel, items.find((i) => i.node === sel)?.trail, null)} />
        </div>

        {/* Barre de chemin */}
        <div className="flex items-center gap-1 border-t border-white/[.08] bg-white/[.02] px-4 py-2.5 text-[12.5px] text-white/50">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {chain.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-white/25" />}
                <button onClick={() => i !== chain.length - 1 && goto(path.slice(0, i), -1)} className={`rounded-md px-1.5 py-0.5 transition hover:bg-white/10 hover:text-white ${i === chain.length - 1 ? 'text-white/90' : ''}`}>{f.name}</button>
              </span>
            ))}
          </div>
          {path.length > 0 && <button onClick={up} className="hidden rounded-md px-2 py-0.5 hover:bg-white/10 hover:text-white sm:block">↑ Dossier parent</button>}
          <span className="font-mono">{items.length} élément{items.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------- vignettes ---------- */

function Tile({ node, selected, loading, busy, onSelect, onOpen, trail }: { node: Node; selected: boolean; loading: boolean; busy: boolean; onSelect: (el: HTMLElement) => void; onOpen: (el: HTMLElement) => void; trail?: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const visited = useVisited(node.kind === 'lesson' ? node.lessonId : undefined)
  const total = node.kind === 'lesson' && node.lessonId ? lessonMeta[node.lessonId]?.scenes ?? 0 : 0
  return (
    <div ref={ref} tabIndex={0} role="button" aria-pressed={selected} aria-busy={loading} aria-label={node.name} data-selected={selected} data-loading={loading} data-opening={loading} data-busy={busy} className="tile"
      onClick={(e) => { e.stopPropagation(); onSelect(ref.current!) }}
      onDoubleClick={() => onOpen(ref.current!)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(ref.current!); if (e.key === ' ') { e.preventDefault(); onSelect(ref.current!) } }}>
      <div className="relative w-full max-w-[132px]">
        {node.kind === 'folder'
          ? <FolderIcon color={node.color} icon={node.icon} count={node.children.length} className="w-full" />
          : <LessonIcon node={node} progress={total ? visited.length / total : 0} />}
        {loading && <span className="absolute inset-0 grid place-items-center rounded-2xl bg-[#0e1021]/55 text-white backdrop-blur-[2px]"><Spinner size={22} delayed /></span>}
      </div>
      <div className="tile-name">{node.name}</div>
      <div className="mt-0.5 text-[11px] text-white/40">{trail && trail.length ? trail.join(' › ') : node.kind === 'folder' ? `${node.children.length} éléments` : node.lessonId ? 'Leçon interactive' : 'Bientôt'}</div>
    </div>
  )
}

function LessonIcon({ node, progress }: { node: LessonNode; progress: number }) {
  const Icon = ICONS[node.icon]
  const live = !!node.lessonId
  return (
    <div className="lesson-card relative aspect-[5/4] w-full max-w-[132px] overflow-hidden rounded-2xl border border-white/15" style={{ background: `linear-gradient(150deg, ${node.color}${live ? '' : '55'} 0%, #14162c 120%)`, opacity: live ? 1 : 0.65 }}>
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, #fff 0, transparent 45%)' }} />
      <div className="absolute inset-0 grid place-items-center text-white"><Icon size={34} strokeWidth={1.6} /></div>
      {!live && <Lock size={13} className="absolute right-2 top-2 text-white/70" />}
      {live && progress > 0 && (
        <div className="absolute inset-x-3 bottom-2.5 h-1 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} /></div>
      )}
    </div>
  )
}

function Row({ node, selected, onSelect, onOpen }: { node: Node; selected: boolean; onSelect: () => void; onOpen: (el: HTMLElement) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const Icon = ICONS[node.icon]
  return (
    <div ref={ref} tabIndex={0} role="button" data-selected={selected} className="row" onClick={onSelect} onDoubleClick={() => onOpen(ref.current!)} onKeyDown={(e) => e.key === 'Enter' && onOpen(ref.current!)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: node.color + (node.kind === 'lesson' && !node.lessonId ? '44' : '') }}><Icon size={16} /></span>
      <span className="flex-1 truncate font-medium">{node.name}</span>
      <span className="hidden w-32 text-white/45 sm:block">{node.kind === 'folder' ? 'Dossier' : 'Leçon'}</span>
      <span className="w-24 text-right text-white/45">{node.kind === 'folder' ? `${node.children.length} éléments` : durationOf(node.lessonId) ?? 'Bientôt'}</span>
    </div>
  )
}

/* ---------- panneau d'aperçu (pas de navigation : informations sur la sélection) ---------- */

function Preview({ node, isFolderContext, onOpen, loadingId }: { node: Node | null; isFolderContext: boolean; onOpen: () => void; loadingId: string | null }) {
  const lessonId = node?.kind === 'lesson' ? node.lessonId : undefined
  const visited = useVisited(lessonId)
  if (!node) return null
  const lesson = lessonId ? lessonMeta[lessonId] : undefined
  const loading = !!lessonId && loadingId === lessonId
  const Icon = ICONS[node.icon]
  let body: ReactNode
  if (node.kind === 'folder') {
    body = (
      <>
        <FolderIcon color={node.color} icon={node.icon} className="mx-auto w-32" />
        <h3 className="mt-4 font-display text-[17px] leading-snug">{node.name}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-white/55">{node.description}</p>
        {isFolderContext ? <p className="mt-4 text-[12px] text-white/35">Double-cliquez sur un élément pour l’ouvrir.</p> : <button onClick={onOpen} className="btn-primary mt-5 w-full justify-center">Ouvrir le dossier <ArrowRight size={16} /></button>}
      </>
    )
  } else {
    body = (
      <>
        <div className="mx-auto grid aspect-[5/4] w-40 place-items-center overflow-hidden rounded-2xl border border-white/15" style={{ background: `linear-gradient(150deg, ${node.color}, #14162c 130%)` }}><Icon size={42} strokeWidth={1.5} /></div>
        <h3 className="mt-4 font-display text-[17px] leading-snug">{node.name}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-white/55">{node.description}</p>
        {lesson ? (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[11.5px]">
              <span className="chip"><Clock size={12} /> {durationOf(lessonId)}</span>
              <span className="chip">{lesson.scenes} scènes</span>
              <span className="chip"><BookOpen size={12} /> Explication</span>
              <span className="chip"><FlaskConical size={12} /> Exploration</span>
            </div>
            <div className="mt-4 text-[12px] text-white/45">{visited.length}/{lesson.scenes} scènes vues</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--mint)] transition-all" style={{ width: `${(visited.length / lesson.scenes) * 100}%` }} /></div>
            <button onClick={onOpen} disabled={!!loadingId} aria-busy={loading} className="btn-primary mt-5 w-full justify-center">{loading ? <><Spinner delayed /> Ouverture…</> : <>{visited.length ? 'Reprendre la leçon' : 'Ouvrir la leçon'} <ArrowRight size={16} /></>}</button>
          </>
        ) : (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-[12.5px] text-white/55"><Lock size={14} /> Bientôt disponible</div>
        )}
      </>
    )
  }
  return <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-white/[.08] bg-white/[.02] p-6 text-center md:block">{body}</aside>
}

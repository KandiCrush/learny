import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { BookText, Search } from 'lucide-react'
import type { LexiconEntry } from '../lessons/types'

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Bouton « Lexique » : popover léger listant les définitions importantes de la leçon.
 * Réutilisable : chaque leçon fournit son propre tableau `lexicon` (type LexiconEntry).
 * Même mécanique que SoundMenu : clic extérieur et Échap ferment, aucune pile de modales.
 */
export function LexiconMenu({ entries }: { entries: LexiconEntry[] }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    window.addEventListener('pointerdown', out)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', out); window.removeEventListener('keydown', esc) }
  }, [open])

  const shown = useMemo(() => {
    const n = plain(q.trim())
    if (!n) return entries
    return entries.filter((e) => plain([e.term, e.definition, ...(e.aliases ?? [])].join(' ')).includes(n))
  }, [entries, q])

  return (
    <div ref={root} className="relative">
      <button
        className="icon-btn !inline-flex !w-auto items-center gap-2 px-3" data-active={open} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)} title="Lexique : définitions de la leçon"
      >
        <BookText size={17} aria-hidden />
        <span className="hidden font-display text-[12.5px] sm:inline">Lexique</span>
      </button>
      {open && (
        <div
          id={panelId} role="dialog" aria-label="Lexique de la leçon"
          className="beat-in z-30 flex max-h-[min(70dvh,560px)] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0e1021]/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-2xl max-sm:fixed max-sm:left-4 max-sm:top-[72px] sm:absolute sm:right-0 sm:top-[calc(100%+10px)]"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
            <div className="eyebrow">Lexique · <b>{entries.length}</b> termes</div>
          </div>
          {entries.length > 5 && (
            <label className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-1.5 focus-within:border-[var(--accent)]/60">
              <Search size={14} className="text-white/45" aria-hidden />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un mot…" aria-label="Chercher dans le lexique"
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
              />
            </label>
          )}
          <dl className="scroll-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {shown.map((e) => (
              <div key={e.term} className="rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[.05]">
                <dt className="font-display text-[13px] text-[var(--mint)]">{e.term}</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-white/75">{e.definition}</dd>
              </div>
            ))}
            {shown.length === 0 && <p className="px-3 py-4 text-center text-[13px] text-white/45">Aucun terme ne correspond à « {q} ».</p>}
          </dl>
        </div>
      )}
    </div>
  )
}

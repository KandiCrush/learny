import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Ambient } from './components/Ambient'
import { Home } from './components/Home'
import { LessonView } from './components/LessonView'
import { type Lesson } from './lessons/types'
import { loadLesson } from './lessons/registry'
import { findLessonPath } from './library/catalog'
import { LibraryModal } from './library/LibraryModal'
import { d, soften } from './lib/motion'
import { readSession, writeSession } from './lib/session'

export default function App() {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  /** leçon en cours de chargement (chargement réel, import dynamique) */
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [libOpen, setLibOpen] = useState(false)
  const [origin, setOrigin] = useState<DOMRect | null>(null)
  const page = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const openLibrary = useCallback((r?: DOMRect) => { setOrigin(r ?? null); setLibOpen(true) }, [])

  const openLesson = async (id: string) => {
    if (busy.current) return // empêche les clics répétés pendant le chargement
    busy.current = true
    setLoadingId(id); setError(null)
    try {
      const l = await loadLesson(id)
      setLibOpen(false)
      if (readSession().lesson !== id) writeSession({ lesson: id, mode: 'explain', scene: 0 })
      setLesson(l)
    } catch {
      setError('Impossible de charger la leçon. Vérifiez votre connexion et réessayez.')
    } finally {
      busy.current = false
      setLoadingId(null)
    }
  }

  // reprise après rechargement : on revient dans la leçon en cours
  useEffect(() => { const s = readSession().lesson; if (s) void openLesson(s) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // fondu entre accueil et leçon
  const first = useRef(true)
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return }
    if (page.current) gsap.fromTo(page.current, soften({ opacity: 0, scale: 0.975, filter: 'blur(10px)' }), { opacity: 1, scale: 1, filter: 'blur(0px)', duration: d(0.9), ease: 'expo.out' })
  }, [lesson])

  // raccourci L
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); setOrigin(null); setLibOpen((o) => !o) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const startPath = lesson ? findLessonPath(lesson.id)?.path : undefined

  return (
    <>
      <Ambient />
      <div ref={page}>
        {lesson ? (
          <LessonView key={lesson.id} lesson={lesson} onOpenLibrary={openLibrary} onHome={() => { writeSession(null); setLesson(null) }} />
        ) : (
          <Home onOpenLibrary={openLibrary} onOpenLesson={openLesson} loadingId={loadingId} />
        )}
      </div>
      <LibraryModal open={libOpen} origin={origin} onClose={() => setLibOpen(false)} onOpenLesson={openLesson} loadingId={loadingId} startPath={startPath} />
      {error && (
        <div role="alert" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-[var(--coral)]/40 bg-[#1a0f16]/95 px-4 py-3 text-[13px] shadow-2xl">
          {error} <button className="ml-3 underline" onClick={() => setError(null)}>Fermer</button>
        </div>
      )}
    </>
  )
}

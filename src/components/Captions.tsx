import type { Timeline } from '../lib/narration'

/** Sous-titres : la phrase en cours, le mot prononcé est mis en évidence (rythme estimé + repères) */
export function Captions({ timeline, progress }: { timeline: Timeline; progress: number }) {
  const { words } = timeline
  let cursor = 0
  for (let i = 0; i < words.length; i++) { if (words[i].start <= progress) cursor = i; else break }
  const sentence = words[cursor].sentence
  const line = words.map((w, i) => ({ ...w, i })).filter((w) => w.sentence === sentence)
  return (
    <p key={sentence} className="caption-in mx-auto max-w-3xl text-center text-[15px] leading-relaxed sm:text-[17px]">
      {line.map((w) => (
        <span key={w.i} className={w.i < cursor ? 'text-white/90' : w.i === cursor ? 'text-white' : 'text-white/35'} style={{ transition: 'color .2s' }}>{w.w}{' '}</span>
      ))}
    </p>
  )
}

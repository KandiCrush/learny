/** Sous-titres : la phrase en cours, mot par mot, au rythme de la narration */
export function Captions({ text, progress }: { text: string; progress: number }) {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text]
  const words = sentences.map((s) => s.trim().split(/\s+/))
  const total = words.reduce((a, w) => a + w.length, 0)
  const cursor = Math.min(total - 1, Math.floor(progress * total))
  let acc = 0, si = 0
  for (; si < words.length - 1; si++) { if (cursor < acc + words[si].length) break; acc += words[si].length }
  const local = cursor - acc
  return (
    <p key={si} className="caption-in mx-auto max-w-3xl text-center text-[15px] leading-relaxed sm:text-[17px]">
      {words[si].map((w, i) => (
        <span key={i} className={i < local ? 'text-white/90' : i === local ? 'text-white' : 'text-white/35'} style={{ transition: 'color .25s' }}>{w}{' '}</span>
      ))}
    </p>
  )
}

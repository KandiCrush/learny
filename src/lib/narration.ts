/**
 * Rythme de la narration, sans API : on ESTIME l'instant où chaque mot est prononcé,
 * puis on corrige avec des repères mesurés (`sync`) là où la voix est connue.
 *
 *  1. Modèle : durée d'un mot ∝ nombre de lettres (≈ 14 lettres/s) + pause après la
 *     ponctuation (virgule, deux-points, point…) ; les pauses entre lignes du script sont
 *     comprises dans la pause de fin de phrase.
 *  2. Repères : `{ text: 'Cette décision', at: 13.14 }` = « ce mot commence à 13,14 s ».
 *     Entre deux repères, le temps est interpolé : l'erreur ne peut plus s'accumuler.
 */
export interface Sync { text: string; at: number }

export interface TimelineWord { w: string; start: number; sentence: number }
export interface Timeline {
  words: TimelineWord[]
  /** progression (0 → 1) à laquelle commence la phrase/expression `text`, ou null */
  phraseStart: (text: string) => number | null
}

const LETTERS_PER_SEC = 14

/**
 * « Longueur parlée » d'un mot, en lettres équivalentes. Un sigle (SJF, FCFS, PCB) est ÉPELÉ par la voix :
 * chaque lettre dure ≈ 0,35 s, soit 5 lettres ordinaires. « P1 » se dit « P un ».
 * (scripts/calibrate-sync.py applique la même règle.)
 */
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']
/** Un nombre (0–99) écrit en toutes lettres : seule sa LONGUEUR compte ici */
const frNumber = (n: number): string => {
  if (n < 17) return UNITS[n]
  if (n < 20) return `dix${UNITS[n - 10]}`
  if (n < 70) { const t = Math.floor(n / 10), u = n % 10; return TENS[t] + (u === 1 ? 'et' + 'un' : u ? UNITS[u] : '') }
  if (n < 80) return 'soixante' + frNumber(n - 60)
  if (n === 80) return 'quatrevingts'
  return 'quatrevingt' + frNumber(n - 80)
}

const spoken = (w: string) => {
  const core = w.replace(/[^\p{L}\p{N}]/gu, '')
  // nombre : « 8,75 » est lu « huit virgule soixante-quinze »
  const num = /^(\d{1,2})(?:[,.](\d{1,2}))?$/.exec(w.replace(/[^\d,.]/g, '').replace(/[,.]$/, ''))
  if (num && /^\d/.test(core) && !/[A-Za-zÀ-ÿ]/.test(core)) {
    return frNumber(Number(num[1])).length + (num[2] ? 'virgule'.length + frNumber(Number(num[2])).length : 0)
  }
  if (/^\p{Lu}{2,}$/u.test(core)) return core.length * 5
  if (/^\p{Lu}\d+$/u.test(core)) return 7
  return Math.max(2, core.length)
}
const PAUSE: Record<string, number> = { ',': 0.22, ';': 0.3, ':': 0.35, '.': 0.6, '!': 0.6, '?': 0.6, '…': 0.5 }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

/** Durée (en secondes) estimée de la lecture d'un texte : sert de durée provisoire tant que le MP3 n'existe pas */
export function estimateSeconds(text: string): number {
  let t = 0
  for (const w of text.trim().split(/\s+/)) t += spoken(w) / LETTERS_PER_SEC + (PAUSE[w.slice(-1)] ?? 0)
  return Math.round(t * 10) / 10 + 1.2
}

const cache = new Map<string, Timeline>()

export function buildTimeline(text: string, duration: number, sync: Sync[] = []): Timeline {
  const key = `${duration}|${JSON.stringify(sync)}|${text}`
  const hit = cache.get(key)
  if (hit) return hit

  // une ponctuation isolée (« terminé : il… ») fait partie du mot qui la précède, pas d'un mot à part
  const tokens: string[] = []
  for (const w of text.trim().split(/\s+/)) {
    if (tokens.length && !/[\p{L}\p{N}]/u.test(w)) tokens[tokens.length - 1] += ` ${w}`
    else tokens.push(w)
  }
  const normed = tokens.map(norm)

  // 1. estimation (en secondes « estimées »)
  const est: number[] = []
  let t = 0
  tokens.forEach((w) => {
    est.push(t)
    t += spoken(w) / LETTERS_PER_SEC + (PAUSE[w.slice(-1)] ?? 0)
  })
  const estTotal = t

  // 2. repères mesurés → points (estimé → réel), strictement croissants
  // un mot comme « c'est » compte pour deux après normalisation : on compare donc des chaînes, pas des mots
  const find = (phrase: string) => {
    const p = norm(phrase)
    for (let i = 0; i < normed.length; i++) {
      let acc = ''
      for (let j = i; j < normed.length && acc.length < p.length; j++) acc += (acc ? ' ' : '') + normed[j]
      if (acc === p) return i
    }
    return -1
  }
  const points: [number, number][] = [[0, 0]]
  for (const s of [...sync].sort((a, b) => a.at - b.at)) {
    const i = find(s.text)
    if (i < 0) { if (import.meta.env?.DEV) console.warn(`[narration] repère introuvable : « ${s.text} »`); continue }
    const last = points[points.length - 1]
    if (est[i] > last[0] && s.at > last[1] && s.at < duration) points.push([est[i], s.at])
  }
  points.push([estTotal, duration])

  const toReal = (e: number) => {
    for (let k = 1; k < points.length; k++) {
      const [e0, r0] = points[k - 1], [e1, r1] = points[k]
      if (e <= e1) return r0 + ((e - e0) / (e1 - e0 || 1)) * (r1 - r0)
    }
    return duration
  }

  let sentence = 0
  const words = tokens.map((w, i) => {
    const out = { w, start: Math.min(1, toReal(est[i]) / duration), sentence }
    if (/[.!?…]$/.test(w)) sentence++
    return out
  })

  const timeline: Timeline = {
    words,
    phraseStart: (phrase) => { const i = find(phrase); return i < 0 ? null : words[i].start },
  }
  cache.set(key, timeline)
  return timeline
}

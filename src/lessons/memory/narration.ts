/**
 * Scripts de narration de la leçon « Allocation et fragmentation de la mémoire » — SOURCE UNIQUE.
 * Leçon COURTE (≈ 2 minutes de voix) pour économiser les crédits ElevenLabs : phrases brèves, rien de ce que
 * l'animation montre déjà ; les détails sont dans le mode Exploration et le Lexique.
 * - `npm run audio:scripts -- memory` écrit docs/audio-scripts-memory.md (UN texte, longueur affichée) ;
 * - un seul MP3 : `public/audio/memory/cours-memoire.mp3` ;
 * - ensuite `python3 scripts/calibrate-sync.py --lesson=memory`.
 * Les animations peuvent durer plus longtemps que la voix : `PAUSES` ajoute une pause LONGUE après certaines lignes
 * (laisse le temps d'observer le mécanisme, sans coûter de caractères en plus).
 */
export type SceneKey = 'share' | 'fixed' | 'variable' | 'compact' | 'track' | 'strategies' | 'verdict'

/** Ordre des scènes = ordre de lecture dans le MP3 */
export const SCENE_ORDER: SceneKey[] = ['share', 'fixed', 'variable', 'compact', 'track', 'strategies', 'verdict']

export const AUDIO_FILE = 'cours-memoire.mp3'
export const AUDIO_URL = `/audio/memory/${AUDIO_FILE}`

export const LINES: Record<SceneKey, string[]> = {
  share: [
    "Un seul programme en mémoire : quand il attend le disque, le processeur ne fait rien.",
    "Alors on en charge plusieurs : c'est la multiprogrammation. Mais il faut partager la RAM.",
    "Le gestionnaire de mémoire suit les zones libres et occupées. Chaque processus reste dans sa zone, grâce à un registre de base et un registre limite.",
  ],
  fixed: [
    "Première idée : des partitions fixes, découpées à l'avance. Une partition, un processus.",
    "Mais un processus ne remplit pas toute sa partition : cet espace perdu, c'est la fragmentation interne.",
    "Et trois partitions, c'est trois processus au maximum : le quatrième attend.",
  ],
  variable: [
    "Deuxième idée : des partitions variables. Chacun reçoit exactement sa taille.",
    "Mais quand un processus termine, il laisse un trou.",
    "Le quatrième aurait de la place au total, mais pas d'un seul tenant : l'allocation échoue. C'est la fragmentation externe.",
  ],
  compact: [
    "Le compactage déplace les processus pour regrouper les trous. Cette fois, le quatrième entre.",
    "Mais copier la mémoire prend du temps, pendant lequel rien ne s'exécute : on ne le fait pas à la légère.",
  ],
  track: [
    "Pour retrouver les trous, le système utilise une table de bits, un bit par case, ou une liste chaînée : l'adresse et la taille de chaque zone.",
    "La table est simple, mais chercher une suite de cases libres est lent. La liste suit mieux des zones de tailles variables.",
  ],
  strategies: [
    "Le temps passe : de nouveaux trous apparaissent. Quand plusieurs conviennent, lequel choisir ? Mêmes demandes, quatre stratégies.",
    "First Fit prend le premier trou assez grand.",
    "Next Fit pareil, mais en reprenant là où il s'est arrêté.",
    "Best Fit prend le plus petit qui convient.",
    "Worst Fit prend le plus grand.",
  ],
  verdict: [
    "Best Fit gaspille peu à chaque demande, mais laisse de minuscules trous. Worst Fit entame toujours le plus grand. First Fit est rapide, Next Fit répartit.",
    "Ici, Best et First Fit échouent sur la dernière demande, pas Worst Fit. Avec d'autres demandes, ce serait l'inverse.",
    "Aucune stratégie n'est toujours la meilleure. À vous d'expérimenter !",
  ],
}

/** Pause plus longue après certaines lignes (clé = numéro de ligne) : le temps d'observer l'animation */
export const PAUSES: Partial<Record<SceneKey, Record<number, string>>> = {
  share: { 2: '[long pause]' },
  fixed: { 1: '[long pause]', 2: '[long pause]' },
  variable: { 1: '[long pause]', 2: '[long pause]' },
  compact: { 0: '[long pause]', 1: '[long pause]' },
  track: { 1: '[long pause]' },
  strategies: { 1: '[long pause]', 2: '[long pause]', 3: '[long pause]', 4: '[long pause]' },
  verdict: { 1: '[long pause]' },
}

/** Audio Tags (Eleven v3) — direction vocale, jamais affichés. Peu nombreux ([excited] est volontairement absent). */
export const TAGS: Partial<Record<SceneKey, Record<number, string>>> = {
  share: { 0: '[curious]' },
  variable: { 2: '[thoughtful]' },
  strategies: { 0: '[curious]' },
  verdict: { 2: '[calm]' },
}

export const INLINE_TAGS: [SceneKey, number, string, string][] = []

export const narrationOf = (k: SceneKey) => LINES[k].join(' ')

/** Pause par défaut entre deux lignes */
export const V3_PAUSE = '[short pause]'

export const taggedLines = (k: SceneKey): string[] =>
  LINES[k].map((line, i) => {
    let t = line
    for (const [sk, li, phrase, tag] of INLINE_TAGS) if (sk === k && li === i) t = t.replace(phrase, `${tag} ${phrase}`)
    const tag = TAGS[k]?.[i]
    return `${tag ? tag + ' ' : ''}${t}`
  })

/** Lignes d'une scène suivies de leur pause (la dernière ligne de chaque scène reçoit la pause de la ligne suivante dans le flux) */
const withPause = (k: SceneKey) => taggedLines(k).map((l, i) => ({ l, p: PAUSES[k]?.[i] ?? V3_PAUSE }))

/** LE texte du cours : toutes les scènes, dans l'ordre, à coller en une seule fois dans ElevenLabs */
export const courseScript = () => {
  const all = SCENE_ORDER.flatMap(withPause)
  return all.map((x, i) => (i < all.length - 1 ? `${x.l} ${x.p}\n` : x.l)).join('')
}

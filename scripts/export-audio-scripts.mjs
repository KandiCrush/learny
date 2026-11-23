// Génère docs/audio-scripts-generated.md : LE texte du cours à coller en une fois dans ElevenLabs (Eleven v3).
//   npm run audio:scripts
import { writeFileSync } from 'node:fs'
//   npm run audio:scripts -- lifecycle     (autre cours : docs/audio-scripts-<cours>.md ; « scheduling » par défaut)
const LESSON = process.argv[2] ?? 'scheduling'
const { AUDIO_FILE, LINES, SCENE_ORDER, courseScript, narrationOf, taggedLines } = await import(`../src/lessons/${LESSON}/narration.ts`)

// Garde-fou : les tags ne doivent jamais modifier le contenu de la narration
const strip = (s) => s.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim()
for (const k of SCENE_ORDER) {
  if (strip(taggedLines(k).join(' ')) !== narrationOf(k)) throw new Error(`Le texte balisé de « ${k} » diffère de la narration`)
}

const script = courseScript()
const LIMIT = 5000
if (script.length > LIMIT) throw new Error(`Le script fait ${script.length} caractères : limite ElevenLabs de ${LIMIT} dépassée`)

const out = [
  '# Texte du cours à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)', '',
  `Source : \`src/lessons/${LESSON}/narration.ts\`. Procédure : voir le README, section « Voix ».`, '',
  `- **Un seul texte, un seul MP3** : \`public/audio/${LESSON}/${AUDIO_FILE}\``,
  `- Longueur : **${script.length} caractères** (limite ElevenLabs : ${LIMIT})`,
  `- Après génération : \`python3 scripts/calibrate-sync.py${LESSON === 'scheduling' ? '' : ' --lesson=' + LESSON}\``, '',
  '## Texte à coller', '', '```', script, '```', '',
  '## Scènes (début de chaque scène dans le texte)', '',
  '| # | Scène | Première phrase |', '|---|---|---|',
  ...SCENE_ORDER.map((k, i) => `| ${i + 1} | ${k} | ${LINES[k][0]} |`), '',
]
const file = LESSON === 'scheduling' ? 'audio-scripts-generated.md' : `audio-scripts-${LESSON}.md`
writeFileSync(new URL(`../docs/${file}`, import.meta.url), out.join('\n'))
console.log(`docs/${file} écrit — ${script.length} caractères (contenu vérifié)`)

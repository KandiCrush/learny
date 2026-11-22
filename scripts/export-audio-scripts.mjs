// Génère docs/audio-scripts-generated.md : LE texte du cours à coller en une fois dans ElevenLabs (Eleven v3).
//   npm run audio:scripts
import { writeFileSync } from 'node:fs'
import { AUDIO_FILE, LINES, SCENE_ORDER, courseScript, narrationOf, taggedLines } from '../src/lessons/scheduling/narration.ts'

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
  'Source : `src/lessons/scheduling/narration.ts`. Procédure : voir le README, section « Voix ».', '',
  `- **Un seul texte, un seul MP3** : \`public/audio/scheduling/${AUDIO_FILE}\``,
  `- Longueur : **${script.length} caractères** (limite ElevenLabs : ${LIMIT})`,
  '- Après génération : `python3 scripts/calibrate-sync.py`', '',
  '## Texte à coller', '', '```', script, '```', '',
  '## Scènes (début de chaque scène dans le texte)', '',
  '| # | Scène | Première phrase |', '|---|---|---|',
  ...SCENE_ORDER.map((k, i) => `| ${i + 1} | ${k} | ${LINES[k][0]} |`), '',
]
writeFileSync(new URL('../docs/audio-scripts-generated.md', import.meta.url), out.join('\n'))
console.log(`docs/audio-scripts-generated.md écrit — ${script.length} caractères (contenu vérifié)`)

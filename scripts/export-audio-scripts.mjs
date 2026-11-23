// Génère docs/audio-scripts-generated.md : LE texte du cours à coller en une fois dans ElevenLabs (Eleven v3).
//   npm run audio:scripts
import { writeFileSync } from 'node:fs'
//   npm run audio:scripts -- lifecycle     (autre cours : docs/audio-scripts-<cours>.md ; « scheduling » par défaut)
const LESSON = process.argv[2] ?? 'scheduling'
const N = await import(`../src/lessons/${LESSON}/narration.ts`)
const { AUDIO_FILE, LINES, SCENE_ORDER, narrationOf, taggedLines } = N
// Un cours peut avoir plusieurs MP3 (PARTS : [{ file, scenes }]) quand son texte dépasse la limite d'ElevenLabs
const PARTS = N.PARTS ?? [{ file: AUDIO_FILE, scenes: SCENE_ORDER }]
const V3_PAUSE = N.V3_PAUSE

// Garde-fou : les tags ne doivent jamais modifier le contenu de la narration
const strip = (s) => s.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim()
for (const k of SCENE_ORDER) {
  if (strip(taggedLines(k).join(' ')) !== narrationOf(k)) throw new Error(`Le texte balisé de « ${k} » diffère de la narration`)
}

const LIMIT = 5000
// si la leçon fournit courseScript() (pauses variables par ligne), on l'utilise pour un cours à un seul MP3
const scripts = PARTS.length === 1 && N.courseScript ? [N.courseScript()] : PARTS.map((p) => p.scenes.flatMap(taggedLines).join(` ${V3_PAUSE}\n`))
scripts.forEach((s, i) => { if (s.length > LIMIT) throw new Error(`Le texte « ${PARTS[i].file} » fait ${s.length} caractères : limite ElevenLabs de ${LIMIT} dépassée`) })
const calib = `python3 scripts/calibrate-sync.py${LESSON === 'scheduling' ? '' : ' --lesson=' + LESSON}`

const out = [
  '# Texte du cours à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)', '',
  `Source : \`src/lessons/${LESSON}/narration.ts\`. Procédure : voir le README, section « Voix ».`, '',
  PARTS.length === 1
    ? `- **Un seul texte, un seul MP3** : \`public/audio/${LESSON}/${AUDIO_FILE}\``
    : `- **${PARTS.length} textes, ${PARTS.length} MP3** (le cours dépasse ${LIMIT} caractères) : générez-les séparément, dans l'ordre, sous les noms indiqués ci-dessous, dans \`public/audio/${LESSON}/\``,
  `- Après génération : \`${calib}\``, '',
  ...PARTS.flatMap((p, i) => [
    `## ${PARTS.length === 1 ? 'Texte à coller' : `Partie ${i + 1} — \`${p.file}\``}`, '',
    `Longueur : **${scripts[i].length} caractères** (limite : ${LIMIT}) · scènes : ${p.scenes.join(', ')}`, '',
    '```', scripts[i], '```', '',
  ]),
  '## Scènes (début de chaque scène dans le texte)', '',
  '| # | Scène | Première phrase |', '|---|---|---|',
  ...SCENE_ORDER.map((k, i) => `| ${i + 1} | ${k} | ${LINES[k][0]} |`), '',
]
const file = LESSON === 'scheduling' ? 'audio-scripts-generated.md' : `audio-scripts-${LESSON}.md`
writeFileSync(new URL(`../docs/${file}`, import.meta.url), out.join('\n'))
console.log(`docs/${file} écrit — ${scripts.map((s) => s.length).join(' + ')} caractères (contenu vérifié)`)

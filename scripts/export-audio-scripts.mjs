// Génère docs/audio-scripts-generated.md : texte à coller dans ElevenLabs (modèle Eleven v3), scène par scène.
//   npm run audio:scripts
import { writeFileSync } from 'node:fs'
import { FILES, LINES, ttsV3Of } from '../src/lessons/scheduling/narration.ts'

// Garde-fou : les tags ne doivent jamais modifier le contenu de la narration
const strip = (s) => s.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim()
for (const k of Object.keys(FILES)) {
  if (strip(ttsV3Of(k)) !== LINES[k].join(' ')) throw new Error(`Le texte balisé de « ${k} » diffère de la narration`)
}

const out = ['# Textes à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)', '',
  'Source : `src/lessons/scheduling/narration.ts`. Procédure : voir le README, section « Voix ».', '']
Object.keys(FILES).forEach((k, i) => {
  out.push(`## Scène ${i + 1} — \`${FILES[k]}\``, '', `Fichier : \`public/audio/scheduling/${FILES[k]}\``, '', '```', ttsV3Of(k), '```', '')
})
writeFileSync(new URL('../docs/audio-scripts-generated.md', import.meta.url), out.join('\n'))
console.log('docs/audio-scripts-generated.md écrit (contenu des narrations vérifié)')

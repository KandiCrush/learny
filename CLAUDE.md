# Learny — guide pour continuer le développement

Application web de cours interactifs et animés (React + TypeScript + Tailwind v4 + GSAP + SVG + Lucide).
Utilisatrice : parle français, valide au résultat (écoute/regarde), commit et push elle-même sur GitHub
(`KandiCrush/learny`). **Ne jamais commiter ni pousser, ne pas faire `git add`.** Répondre en français.

Voir aussi : `README.md` (architecture, voix, calibration), `docs/nouveau-cours.md` (procédure pas à pas pour
un nouveau cours + modèle de prompt), `docs/sound-effects.md` (effets sonores).

## Principes de conception (à conserver)
- Une scène = **fonction pure de `progress` (0 → 1)**. Le MP3 est l'horloge (sinon GSAP). Rien ne « tourne » seul.
- Les animations lisent le **calcul** (`src/lib/scheduling.ts`), elles ne le simulent pas.
- Tout ce qui est synchronisé s'exprime par des **expressions de la narration** (`on: 'Quand P2'`, `anchors`, `cues`),
  jamais par des pourcentages ou des secondes écrites à la main.
- Design : sombre, verre dépoli, police technique (IBM Plex Mono) pour titres/commandes + Geist pour le texte.
  Pas de sidebar de navigation : bibliothèque en fenêtre modale façon Finder (bouton dossier, touche `L`).
- Respecter `prefers-reduced-motion`, clavier, tactile ; états de chargement seulement pour l'asynchrone réel
  (leçons et simulation chargées à la demande).

## Voix : règles apprises (ElevenLabs, modèle Eleven v3, voix « Tony »)
- Un seul texte et un seul MP3 par cours (limite 5 000 caractères ; au-delà, plusieurs MP3 : `scene.audio.src`).
- Source unique du texte : `src/lessons/<cours>/narration.ts` → `npm run audio:scripts` → coller dans ElevenLabs.
- v3 : pas de `<break>` ; pauses `[short pause]` (durée non réglable) ; Audio Tags `[curious]` `[thoughtful]`
  `[excited]` `[calm]` avec parcimonie. La voix change légèrement à chaque génération → un seul fichier.
- **La voix épelle les sigles** (SJF, FCFS, PCB…), dit « P un » pour P1 et **lit les nombres en toutes lettres**
  (« 8,75 » = « huit virgule soixante-quinze »). Le modèle de rythme en tient compte (`spoken()` dans
  `src/lib/narration.ts` ET `scripts/calibrate-sync.py` — garder les deux identiques).
- Après CHAQUE (re)génération du MP3 ou changement de texte : `python3 scripts/calibrate-sync.py` (macOS).
  Il écrit `sync.generated.ts` (plages par scène + repères). Lire la ligne « contrôle de plausibilité » : doit dire
  « alignement cohérent » (parole réelle / attendue entre ≈ ×0,6 et ×1,6). Sinon NE PAS faire confiance.
- Vérifier à la main les zones douteuses avec les silences bruts (`scripts/silences.py`) : un silence court (≤ 0,2 s)
  est souvent une hésitation, pas une ponctuation.

## Pièges rencontrés (ne pas refaire)
- Ne JAMAIS avancer l'animation avant la voix (décalages négatifs) : perçu comme « l'audio est en retard ».
  Un léger retard (≤ ~1 s, 3e élément d'un repère `anchors`) est toléré pour ralentir un processus.
- La vraie solution aux animations trop rapides : **allonger/réordonner le texte** puis régénérer le MP3.
- Tester dans le navigateur (preview) ; le panneau ralentit l'affichage (pas fiable pour les durées en direct).
- Vite : `dist/` est ignoré par le watcher (sinon chaque build rechargeait la page). L'état (leçon, mode, scène) est
  sauvegardé en `sessionStorage` (`src/lib/session.ts`).
- Les phrases utilisées en `on`/`anchors`/`cues` doivent exister dans la narration de LEUR scène (première
  occurrence) : vérifier après tout changement de texte.
- La reconnaissance vocale macOS (Speech) est inutilisable en ligne de commande (autorisation système) : ne pas insister.

## Commandes
```bash
npm run dev                 # http://localhost:5173
npm run audio:scripts       # texte du cours → docs/audio-scripts-generated.md
python3 scripts/calibrate-sync.py [--report]
npx tsc -b && npx vite build
```

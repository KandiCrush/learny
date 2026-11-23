# Créer un nouveau cours — procédure

Le cours « Ordonnancement des processus » (`src/lessons/scheduling/`) sert de modèle.

## 1. Ce que l'utilisatrice fournit (modèle de prompt)
- **Objectifs** : ce que l'élève doit savoir expliquer à la fin.
- **Scènes découpées** : pour chacune, le texte lu **et** l'événement visuel au même moment.
- **Chiffres et exemples précis** (les animations doivent être exactes).
- **Interactions** : prédire avant de voir, quiz, action dans l'exploration.
- **Paramètres du mode Exploration** : ce que l'élève peut modifier.
- **Longueur par scène** (éviter les animations qui s'accélèrent : prévoir une phrase par étape visuelle).
- Dossier de la bibliothèque où le ranger.

## 2. Étapes de développement
1. `src/lessons/<id>/` : `narration.ts` (LINES, TAGS, SCENE_ORDER, AUDIO_FILE), `scenes.tsx`, `Explore.tsx`, `index.tsx`.
2. Moteur pur (calcul) dans `src/lib/` ; composants SVG réutilisables dans `src/components/`.
3. `src/lessons/registry.ts` (chargeur dynamique + métadonnées) et `src/library/catalog.ts` (`lessonId`).
4. Scènes : `render({ progress, at })` ; bulles `beats` avec `on` ; sons `cues` ; horloge de simulation `makeClock(anchors)`.
5. Vérifier toutes les expressions dans la narration ; `npx tsc -b`.
6. `npm run audio:scripts` → l'utilisatrice génère UN MP3 (Eleven v3) → `public/audio/<id>/…mp3`.
7. `python3 scripts/calibrate-sync.py` → contrôler la plausibilité → tester chaque scène dans le navigateur
   (surlignage des sous-titres, états de l'animation aux mots clés, enchaînement sans coupure).
8. Écoute par l'utilisatrice → retours (scène, mot, avance/retard) → corrections ponctuelles.

## 3. Plusieurs cours : scripts paramétrés
`npm run audio:scripts -- <id>` et `python3 scripts/calibrate-sync.py --lesson=<id>` ciblent `src/lessons/<id>/` et
`public/audio/<id>/` (par défaut : `scheduling`). Le cours « Cycle de vie d'un processus » (`lifecycle`) est le 2e modèle :
narration écrite, scripts prêts (`docs/audio-scripts-lifecycle.md`), MP3 pas encore généré (`sync.generated.ts` provisoire,
durées estimées par `estimateSeconds`). Si le cours contient d'autres sigles ou nombres, vérifier `spoken()`.

## 4. Lexique
Ajouter `lexicon: LexiconEntry[]` à l'objet `Lesson` (modèle : `src/lessons/lifecycle/lexicon.ts`) : le bouton « Lexique »
apparaît tout seul. Définitions courtes, sans mot qui en demande lui-même une autre.

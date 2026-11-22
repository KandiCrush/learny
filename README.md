# Learny — cours interactifs et animés (prototype)

React + TypeScript + Tailwind CSS v4 + GSAP + SVG + Lucide.

```bash
npm install
npm run dev      # http://localhost:5173
```

Raccourcis : `L` bibliothèque · `Espace` lecture/pause · `←` `→` scènes · `R` recommencer · `Échap` fermer.

## Architecture

```
src/
  lessons/
    types.ts            Lesson, Scene, Beat (le « contrat » d'une leçon)
    registry.ts         liste des leçons disponibles
    scheduling/         leçon de démonstration (données, scènes, mode Exploration)
  lib/scheduling.ts     moteur FCFS / SJF / Round Robin (les animations lisent ce calcul)
  library/              catalogue (catalog.ts) + fenêtre « Finder » (LibraryModal.tsx)
  hooks/useScenePlayer  lecteur de scènes piloté par GSAP (+ branchement audio)
  components/           LessonView, SchedulerMachine, GanttChart, Home, …
```

Une scène est une **fonction pure de `progress` (0 → 1)** : lecture, pause, retour,
scrubbing et vitesse reviennent à piloter une seule valeur.

## Ajouter une leçon

1. Créer `src/lessons/<ma-lecon>/index.tsx` exportant un objet `Lesson`
   (`scenes: Scene[]` + un composant `Explore`).
2. Déclarer son chargeur (import dynamique) et ses métadonnées dans `src/lessons/registry.ts`.
3. La référencer dans `src/library/catalog.ts` avec `lessonId` : elle apparaît dans son dossier.

## Voix (ElevenLabs, modèle Eleven v3)

Chaque `Scene` a un champ `audioSrc` (ex. `/audio/scheduling/02-fcfs.mp3`, fichier dans `public/`). Dès qu'il est
renseigné, `useScenePlayer` utilise le MP3 comme horloge : animation, sous-titres, bulles et sons suivent la voix.
Sans fichier, la scène se joue en silence avec sa durée simulée.

1. **Texte** : la source unique est `src/lessons/scheduling/narration.ts` (lignes de narration + Audio Tags).
   `npm run audio:scripts` écrit le texte à coller dans ElevenLabs : `docs/audio-scripts-generated.md`.
2. **Génération** : mêmes réglages de voix pour toutes les scènes ; export MP3 ; fichier à enregistrer sous le nom indiqué
   dans `public/audio/scheduling/`. Si une voix prononce un tag à voix haute, retirez-le dans `TAGS` (`narration.ts`).
3. **Calibration** (à relancer à chaque (re)génération d'un MP3) :
   ```bash
   python3 scripts/calibrate-sync.py            # écrit src/lessons/scheduling/sync.generated.ts
   python3 scripts/calibrate-sync.py --report   # diagnostic seul
   ```
   L'outil mesure les silences de chaque MP3 et les aligne sur les ponctuations du script (macOS, `afconvert`). Chaque
   silence reconnu donne un repère « ce mot commence à tant de secondes » ; entre deux repères, l'application interpole.
   Ne modifiez pas `sync.generated.ts` à la main. (`scripts/silences.py` liste les silences bruts.)
4. **Animations de simulation** : `anchors` dans `scenes.tsx` associent une expression de la narration à un instant simulé ;
   les bulles (`on`) et les effets sonores utilisent les mêmes expressions.

## Effets sonores

Synthétisés par Web Audio, déclenchés par des `cues` dans les scènes : voir [docs/sound-effects.md](docs/sound-effects.md).

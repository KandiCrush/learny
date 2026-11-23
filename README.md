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
    scheduling/         leçon « Ordonnancement des processus » (données, scènes, mode Exploration)
    lifecycle/          leçon « Cycle de vie d'un processus » (scènes, simulation, lexique, narration, MP3 calibré)
    memory/             leçon « Allocation et fragmentation de la mémoire » (une seule histoire de RAM, moteur d'allocation, laboratoire ; MP3 à générer)
    mutex/              leçon « Exclusion mutuelle… sémaphores » (scènes pilotées par le moteur, laboratoire, lexique ; MP3 à générer)
  lib/scheduling.ts     moteur FCFS / SJF / Round Robin (les animations lisent ce calcul)
  lib/memory.ts         moteur d'allocation contiguë (partitions fixes/variables, 4 stratégies, compactage) : scènes ET laboratoire
  lib/concurrency.ts    moteur de concurrence (race, spinlock TAS, mutex bloquant, sémaphores) : scènes ET laboratoire le rejouent
  lib/lifecycle.ts      moteur du cycle de vie (états, transitions, refus argumentés) du mode Exploration
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

## Lexique (réutilisable)

Chaque leçon peut exposer `lexicon: LexiconEntry[]` (`{ term, definition, aliases? }`, voir `src/lessons/types.ts`).
Si le tableau est renseigné, le bouton « Lexique » apparaît dans l'en-tête, en mode Explication comme en Exploration
(`src/components/LexiconMenu.tsx`, popover avec recherche au-delà de 5 termes). Exemple : `src/lessons/lifecycle/lexicon.ts`.

## Voix (ElevenLabs, modèle Eleven v3)

**Un seul MP3 pour tout le cours** : `public/audio/scheduling/cours-ordonnancement.mp3`. Chaque `Scene` en occupe une
plage de temps (`scene.audio = { src, from, to }`, calculée automatiquement). Le MP3 est l'horloge : animation, sous-titres,
bulles et sons suivent la voix. Passer d'une scène à la suivante ne coupe pas la voix, et un clic sur un chapitre saute à sa
seconde dans le fichier. Sans MP3, le cours se joue en silence avec des durées simulées.

1. **Texte** : la source unique est `src/lessons/<cours>/narration.ts` (lignes de narration + Audio Tags).
   `npm run audio:scripts` (ou `npm run audio:scripts -- lifecycle` pour un autre cours) écrit **le texte du cours entier** à coller en une fois dans ElevenLabs
   (`docs/audio-scripts-generated.md`, limite de 5 000 caractères vérifiée).
2. **Génération** : un seul export MP3, à enregistrer sous le nom ci-dessus. Si la voix prononce un tag à voix haute,
   retirez-le dans `TAGS` (`narration.ts`).
3. **Calibration** (à relancer à chaque (re)génération du MP3 ou changement de texte) :
   ```bash
   python3 scripts/calibrate-sync.py            # écrit src/lessons/scheduling/sync.generated.ts
   python3 scripts/calibrate-sync.py --report   # diagnostic seul
   python3 scripts/calibrate-sync.py --lesson=lifecycle   # autre cours (src/lessons/<id>/, public/audio/<id>/)
   ```
   L'outil mesure les silences du MP3 et les aligne sur les ponctuations du script (macOS, `afconvert`). Il en déduit la plage
   de chaque scène et des repères « ce mot commence à tant de secondes ». Ne modifiez pas `sync.generated.ts` à la main.
   Le modèle de rythme sait que la voix **épelle les sigles** (SJF, FCFS, PCB), dit « P un » pour P1 et lit les nombres en toutes
   lettres (« 8,75 » = « huit virgule soixante-quinze ») : en ajoutant un sigle ou un nombre, vérifiez `--report`.
      Si le MP3 change sans recalibration, l'application l'ignore (avertissement en dev) au lieu de se désynchroniser.
4. **Animations de simulation** : `anchors` dans `scenes.tsx` associent une expression de la narration à un instant simulé
   (ou à une phase, pour le changement de contexte) ; les bulles (`on`) et les effets sonores utilisent les mêmes expressions.
   Un 3e élément facultatif décale l'animation par rapport au mot (`['Puis vient P3', 11, -0.8]` : l'image précède la voix
   de 0,8 s) pour lisser la vitesse ; garder ce décalage autour de ±1 s.
5. **Plus de 5 000 caractères ?** Un cours plus long se découpe en plusieurs MP3 : `narration.ts` exporte alors `PARTS`
   (`[{ file, scenes }]`) ; `audio:scripts` écrit un texte par partie et `calibrate-sync.py` calibre chaque fichier
   (le `sync.generated.ts` indique alors `file` pour chaque scène). Une narration peut aussi exporter `PAUSES` et
   `courseScript()` pour des pauses longues après certaines lignes (laisser durer une animation).

## Effets sonores

Synthétisés par Web Audio, déclenchés par des `cues` dans les scènes : voir [docs/sound-effects.md](docs/sound-effects.md).

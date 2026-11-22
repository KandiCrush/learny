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

## Brancher les voix ElevenLabs

Chaque `Scene` a un champ optionnel `audioSrc` (ex. `/audio/scheduling/02-fcfs.mp3`, fichier à
placer dans `public/`). Dès qu'il est renseigné, `useScenePlayer` joue le MP3 en parallèle et
utilise sa durée réelle pour l'animation. Le texte de `narration` sert déjà aux sous-titres et à
la transcription : c'est le script à envoyer à ElevenLabs.

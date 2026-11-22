# Effets sonores

Synthétisés en direct (Web Audio API) : aucun fichier à charger, aucun poids ajouté.
Code : `src/audio/sfx.ts` (sons), `src/audio/settings.ts` (volumes), `src/hooks/useSoundCues.ts` (déclenchement).

## Sons disponibles

| Nom      | Rôle pédagogique                    | Caractère                                   |
|----------|-------------------------------------|---------------------------------------------|
| `appear` | un élément apparaît (processus)     | note douce de bulle ; `pitch` = degré de la gamme |
| `move`   | transition, déplacement             | souffle filtré qui glisse                   |
| `enter`  | entrée/allumage du processeur       | battement grave + micro-tic                 |
| `done`   | fin d'exécution, confirmation       | deux notes montantes                        |

Tous sont accordés sur la gamme de ré majeur pentatonique : ils s'accumulent sans fausse note.

## Ajouter des effets à une scène

```ts
cues: [
  { at: 0.12, sound: 'appear', pitch: 0 },          // à 12 % de la scène
  { on: 'Cette décision', sound: 'move', gain: 0.8 }, // quand la voix dit ces mots
],
```

- `on` suit la voix (même mécanisme que les bulles, avec `sync`) ; `at` suit la progression.
- Sonoriser seulement ce qui aide à comprendre : un repère = un événement pédagogique.

## Comportement

- Un effet joue quand la progression **franchit** son repère, en lecture uniquement.
- Pause, retour arrière, déplacement sur la barre, redémarrage et changement de scène ne rejouent rien.
- La vitesse de lecture est suivie automatiquement (les repères sont liés à la progression).
- Réglages (bouton haut-parleur) : volume de la narration, interrupteur et volume des effets, mémorisés.

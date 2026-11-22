# Scripts de narration (ElevenLabs)

Procédure : générer le MP3 dans ElevenLabs, l'enregistrer sous le nom indiqué dans
`public/audio/scheduling/`, c'est tout. `audioSrc` est déjà renseigné dans la scène.

## Réglages conseillés

- Langue : français — modèle multilingue (Eleven Multilingual v2)
- Voix : posée, chaleureuse, rythme calme (voix « narration / pédagogique »)
- Stability ≈ 50–60 % · Similarity ≈ 75 % · Style ≈ 0–15 % · Speaker boost activé
- Format d'export : MP3 44,1 kHz, 128 kbps
- Une scène = un fichier (pas de silence au début ni à la fin)

## Scène 1 — `01-intro.mp3`

Fichier attendu : `public/audio/scheduling/01-intro.mp3`

Texte à coller dans ElevenLabs (les balises `<break>` créent de courtes pauses) :

```
Imaginez un seul guichet et quatre clients pressés. <break time="0.6s" />
Dans un ordinateur, le guichet, c'est le processeur. Les clients, ce sont les processus. <break time="0.6s" />
Un seul peut être servi à la fois : il faut donc décider de l'ordre. <break time="0.6s" />
Cette décision, c'est le travail de l'ordonnanceur.
```

Durée attendue : 17 à 20 secondes. Le lecteur utilise la durée réelle du fichier pour
l'animation ; les annotations (bulles) restent proportionnelles à la scène.

Texte des sous-titres (sans balises) : voir `narration` dans `src/lessons/scheduling/scenes.tsx`.
Si vous modifiez le script, gardez les deux textes identiques pour que les sous-titres
correspondent à la voix.

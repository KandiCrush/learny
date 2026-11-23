# Texte du cours à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)

Source : `src/lessons/lifecycle/narration.ts`. Procédure : voir le README, section « Voix ».

- **Un seul texte, un seul MP3** : `public/audio/lifecycle/cours-cycle-de-vie.mp3`
- Longueur : **4114 caractères** (limite ElevenLabs : 5000)
- Après génération : `python3 scripts/calibrate-sync.py --lesson=lifecycle`

## Texte à coller

```
[curious] Sur votre disque, un programme dort : c'est un fichier, une liste d'instructions. [short pause]
Il ne fait rien. Un programme est passif. [short pause]
Double-cliquez : le système le charge en mémoire, lui réserve de la place, et lui ouvre une fiche d'identité, le PCB. [short pause]
[excited] Un processus est un programme en cours d'exécution. [short pause]
Lancez-le une deuxième fois : un seul programme, mais deux processus, chacun avec sa propre vie. [short pause]
Le programme, c'est la recette. Le processus, c'est le cuisinier qui la prépare, en ce moment même. [short pause]
Votre ordinateur fait tourner un navigateur, de la musique, un éditeur de texte et une messagerie. [short pause]
Tous veulent le processeur, en même temps. [short pause]
[thoughtful] Mais un processeur à un seul cœur ne peut exécuter qu'un seul processus à la fois. [short pause]
Les autres ne sont pas tous dans la même situation. [short pause]
Certains sont prêts : ils ont tout ce qu'il leur faut, et n'attendent que le processeur. C'est l'état Prêt. [short pause]
Un seul utilise le processeur, à cet instant précis. C'est l'état Élu, ou en exécution. [short pause]
Et un autre ne peut même pas avancer : il attend une donnée du réseau. C'est l'état Bloqué. [short pause]
[calm] Trois états, parce que ce sont trois situations vraiment différentes. [short pause]
[curious] Assemblons le diagramme : trois états, et quatre transitions. [short pause]
Première transition, de Prêt vers Élu : l'ordonnanceur sélectionne le navigateur, et lui donne le processeur. [short pause]
Deuxième, d'Élu vers Prêt : le temps est écoulé, et le système retire le processeur au navigateur. Il n'a pas fini, il retourne dans la file. C'est la préemption. [short pause]
Troisième, d'Élu vers Bloqué : le navigateur demande une page au réseau. Sans elle, il ne peut rien faire. Il libère le processeur et attend. [short pause]
Quatrième, de Bloqué vers Prêt : la page arrive. L'attente est finie, mais le navigateur n'a pas encore le processeur : il se remet en file. [short pause]
[thoughtful] Remarquez ce qui manque : aucune flèche ne relie Bloqué à Élu. [short pause]
[curious] Qui décide de ces élections ? L'ordonnanceur. [short pause]
Chaque fois que le processeur se libère, il regarde la file des processus prêts, et en choisit un. Ici, le premier arrivé. [short pause]
[thoughtful] Attention : être prêt, ce n'est pas utiliser le processeur. Prêt veut dire : j'attends mon tour. Élu veut dire : je calcule, maintenant. [short pause]
Et le processus bloqué ? Quand sa page arrive, il ne saute pas sur le processeur. [short pause]
D'abord, le processeur est peut-être occupé. Ensuite, seul l'ordonnanceur décide qui l'obtient. [short pause]
Le processus réveillé rejoint donc la file des prêts, et attend son tour, comme les autres. [short pause]
[calm] Reprenons tout dans un exemple complet : le navigateur, la musique et l'éditeur sont prêts. [short pause]
L'ordonnanceur élit le navigateur. Il passe sur le processeur. [short pause]
Le navigateur demande une page au réseau. Il doit attendre : il est bloqué, et le processeur se libère. [short pause]
Aussitôt, l'ordonnanceur élit la musique. [short pause]
Pendant ce temps, la page arrive. Le navigateur n'est pas relancé : il rejoint la file des prêts, derrière l'éditeur. [short pause]
Le temps de la musique est écoulé : le système lui retire le processeur, et elle retourne dans la file. [short pause]
L'éditeur est élu. Le navigateur, lui, est le suivant. [short pause]
[excited] Prêt, élu, bloqué, prêt : à chaque étape, il y avait une raison. [short pause]
Résumons. Un processus est un programme en cours d'exécution. [short pause]
Il est Prêt quand il attend le processeur, Élu quand il l'utilise, Bloqué quand il attend un événement. [short pause]
Quatre transitions : l'ordonnanceur élit, le système préempte, le processus se bloque, l'événement le réveille. [short pause]
[thoughtful] Et la règle d'or : un processus bloqué repasse toujours par l'état Prêt. [short pause]
[excited] À vous de jouer : en mode Exploration, créez des processus et faites-les vivre.
```

## Scènes (début de chaque scène dans le texte)

| # | Scène | Première phrase |
|---|---|---|
| 1 | what | Sur votre disque, un programme dort : c'est un fichier, une liste d'instructions. |
| 2 | why | Votre ordinateur fait tourner un navigateur, de la musique, un éditeur de texte et une messagerie. |
| 3 | transitions | Assemblons le diagramme : trois états, et quatre transitions. |
| 4 | scheduler | Qui décide de ces élections ? L'ordonnanceur. |
| 5 | example | Reprenons tout dans un exemple complet : le navigateur, la musique et l'éditeur sont prêts. |
| 6 | recap | Résumons. Un processus est un programme en cours d'exécution. |

# Textes à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)

Source : `src/lessons/scheduling/narration.ts`. Procédure : voir le README, section « Voix ».

## Scène 1 — `01-intro.mp3`

Fichier : `public/audio/scheduling/01-intro.mp3`

```
[curious] Imaginez un seul guichet et quatre clients pressés. [short pause]
Dans un ordinateur, le guichet, c'est le processeur. Les clients, ce sont les processus. [short pause]
[thoughtful] Un seul peut être servi à la fois : il faut donc décider de l'ordre. [short pause]
[excited] Cette décision, c'est le travail de l'ordonnanceur.
```

## Scène 2 — `02-fcfs.mp3`

Fichier : `public/audio/scheduling/02-fcfs.mp3`

```
Premier algorithme : FCFS, premier arrivé, premier servi. [short pause]
[curious] C'est la file d'attente de la boulangerie : on passe dans l'ordre. [short pause]
P1 prend le processeur. Il en a besoin pendant 8 unités, et personne ne peut le doubler. Pendant ce temps, P2, qui n'a besoin que de 3 unités, patiente. [short pause]
Quand P1 termine, P2 passe. Puis vient P3, 5 unités. Et enfin P4, 2 unités. [short pause]
[thoughtful] Voici l'effet de convoi : un long processus au début retarde tous les autres. [short pause]
Ici, l'attente moyenne est de 8,75 unités.
```

## Scène 3 — `03-sjf.mp3`

Fichier : `public/audio/scheduling/03-sjf.mp3`

```
Deuxième algorithme : SJF, le plus court d'abord. [short pause]
[curious] L'ordonnanceur regarde la durée de chaque processus, et choisit toujours le plus court. [short pause]
La file se trie : P4, 2 unités, passe en premier. Puis P2, 3 unités. Puis P3, 5 unités. [short pause]
Et P1, le plus long, passe en dernier. Dans la version non préemptive, un processus lancé n'est jamais interrompu. [short pause]
[excited] Résultat : l'attente moyenne chute à 4,25 unités. [thoughtful] Mais attention : un gros processus peut attendre très longtemps. C'est la famine.
```

## Scène 4 — `04-round-robin.mp3`

Fichier : `public/audio/scheduling/04-round-robin.mp3`

```
Troisième algorithme : Round Robin, le tourniquet. [short pause]
Chaque processus reçoit le processeur pour un quantum de 3 unités au maximum. [short pause]
P1 s'exécute 3 unités. Son travail n'est pas terminé : il est interrompu et replacé à la fin de la file. P2 passe à son tour, puis P3. [short pause]
P4 n'a besoin que de 2 unités : il rend le processeur plus tôt. [short pause]
Ensuite, P1 et P3 repassent pour finir leur travail. [short pause]
[excited] Personne n'attend longtemps avant de démarrer : le temps de réponse moyen est de 4,5 unités, contre 8,75 en FCFS.
```

## Scène 5 — `05-quantum.mp3`

Fichier : `public/audio/scheduling/05-quantum.mp3`

```
[curious] Le quantum est un réglage délicat. [short pause]
[thoughtful] Avec un quantum de 1 unité, les processus alternent sans cesse : le système perd beaucoup de temps à changer de contexte. [short pause]
Avec un quantum de 3, l'équilibre est bon. [short pause]
Avec un quantum de 8, plus aucun processus n'est interrompu : Round Robin se comporte comme FCFS. [short pause]
[calm] Un bon quantum se situe entre les deux.
```

## Scène 6 — `06-comparaison.mp3`

Fichier : `public/audio/scheduling/06-comparaison.mp3`

```
Comparons les trois approches. [short pause]
SJF obtient la plus faible attente moyenne. [short pause]
Round Robin offre le meilleur temps de réponse. [short pause]
FCFS reste le plus simple, mais il est sensible à l'effet de convoi. [short pause]
[thoughtful] Aucun algorithme n'est le meilleur partout : tout dépend de ce que l'on cherche à optimiser. [short pause]
[excited] À vous de jouer : passez en mode Exploration pour modifier les durées et le quantum.
```

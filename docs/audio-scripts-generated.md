# Texte du cours à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)

Source : `src/lessons/scheduling/narration.ts`. Procédure : voir le README, section « Voix ».

- **Un seul texte, un seul MP3** : `public/audio/scheduling/cours-ordonnancement.mp3`
- Longueur : **4279 caractères** (limite ElevenLabs : 5000)
- Après génération : `python3 scripts/calibrate-sync.py`

## Texte à coller

```
[curious] Imaginez un seul guichet et quatre clients pressés. [short pause]
Dans un ordinateur, le guichet, c'est le processeur. Les clients, ce sont les processus. [short pause]
[thoughtful] Un seul peut être servi à la fois : il faut donc décider de l'ordre. [short pause]
[excited] Cette décision, c'est le travail de l'ordonnanceur. [short pause]
Premier algorithme : FCFS, premier arrivé, premier servi. [short pause]
[curious] C'est la file d'attente de la boulangerie : on passe dans l'ordre. [short pause]
P1 prend le processeur. Il en a besoin pendant 8 unités, et personne ne peut le doubler. Pendant ce temps, P2, qui n'a besoin que de 3 unités, patiente. [short pause]
Quand P1 termine, P2 passe. Puis vient P3, 5 unités. Et enfin P4, 2 unités. [short pause]
[thoughtful] Voici l'effet de convoi : un long processus au début retarde tous les autres. [short pause]
Ici, l'attente moyenne est de 8,75 unités. [short pause]
Deuxième algorithme : SJF, le plus court d'abord. [short pause]
[curious] L'ordonnanceur regarde la durée de chaque processus, et choisit toujours le plus court. [short pause]
La file se trie : P4, 2 unités, passe en premier. Puis P2, 3 unités. Puis P3, 5 unités. [short pause]
Et P1, le plus long, passe en dernier. Dans la version non préemptive, un processus lancé n'est jamais interrompu. [short pause]
[excited] Résultat : l'attente moyenne chute à 4,25 unités. [thoughtful] Mais attention : un gros processus peut attendre très longtemps. C'est la famine. [short pause]
Troisième algorithme : Round Robin, le tourniquet. [short pause]
Chaque processus reçoit le processeur pour un quantum de 3 unités au maximum. [short pause]
P1 s'exécute 3 unités. Son travail n'est pas terminé : il est interrompu, son contexte est sauvegardé, et il est replacé à la fin de la file. P2 passe à son tour, puis P3. [short pause]
P4 n'a besoin que de 2 unités : il rend le processeur plus tôt. [short pause]
Ensuite, P1 et P3 repassent pour finir leur travail. Chacun retrouve son contexte et reprend où il s'était arrêté. [short pause]
[excited] Personne n'attend longtemps avant de démarrer : le temps de réponse moyen est de 4,5 unités, contre 8,75 en FCFS. [short pause]
[curious] Que se passe-t-il vraiment quand le processeur interrompt un processus ? [short pause]
Regardons P1 s'exécuter. Le processeur suit son avancement grâce à des registres : le compteur de programme, qui désigne la prochaine instruction, le pointeur de pile, et un registre de calcul. [short pause]
Les données de P1, ses variables, restent dans sa mémoire. Le processeur les charge, calcule, puis les range. [short pause]
[thoughtful] Le quantum est écoulé. L'horloge déclenche une interruption : le système reprend la main. [short pause]
Première étape : il sauvegarde le contexte de P1, c'est-à-dire ses registres, dans son bloc de contrôle, le PCB, en mémoire. [short pause]
Deuxième étape : il charge le contexte de P2, et P2 peut s'exécuter. [short pause]
Quand P2 se termine, le système restaure le contexte de P1 : mêmes valeurs, même instruction. [short pause]
[excited] P1 repart exactement là où il s'était arrêté, sans rien remarquer. [short pause]
[thoughtful] Cette opération est précieuse, mais elle a un coût : pendant le transfert, le processeur ne fait aucun travail utile. C'est pourquoi changer trop souvent de contexte fait perdre du temps. [short pause]
[curious] Le quantum est un réglage délicat. [short pause]
[thoughtful] Avec un quantum de 1 unité, les processus alternent sans cesse : le système perd beaucoup de temps à changer de contexte. [short pause]
Avec un quantum de 3, l'équilibre est bon. [short pause]
Avec un quantum de 8, plus aucun processus n'est interrompu : Round Robin se comporte comme FCFS. [short pause]
[calm] Un bon quantum se situe entre les deux. [short pause]
Comparons les trois approches. [short pause]
SJF obtient la plus faible attente moyenne. [short pause]
Round Robin offre le meilleur temps de réponse. [short pause]
FCFS reste le plus simple, mais il est sensible à l'effet de convoi. [short pause]
[thoughtful] Aucun algorithme n'est le meilleur partout : tout dépend de ce que l'on cherche à optimiser. [short pause]
[excited] À vous de jouer : passez en mode Exploration pour modifier les durées et le quantum.
```

## Scènes (début de chaque scène dans le texte)

| # | Scène | Première phrase |
|---|---|---|
| 1 | intro | Imaginez un seul guichet et quatre clients pressés. |
| 2 | fcfs | Premier algorithme : FCFS, premier arrivé, premier servi. |
| 3 | sjf | Deuxième algorithme : SJF, le plus court d'abord. |
| 4 | rr | Troisième algorithme : Round Robin, le tourniquet. |
| 5 | context | Que se passe-t-il vraiment quand le processeur interrompt un processus ? |
| 6 | quantum | Le quantum est un réglage délicat. |
| 7 | compare | Comparons les trois approches. |

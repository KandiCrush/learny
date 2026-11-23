# Texte du cours à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)

Source : `src/lessons/mutex/narration.ts`. Procédure : voir le README, section « Voix ».

- **Un seul texte, un seul MP3** : `public/audio/mutex/cours-exclusion-mutuelle.mp3`
- Longueur : **4970 caractères** (limite ElevenLabs : 5000)
- Après génération : `python3 scripts/calibrate-sync.py --lesson=mutex`

## Texte à coller

```
[curious] Un compte partagé : cent dollars. P1 retire trente dollars, P2 en retire cinquante. Le bon résultat : vingt dollars. [short pause]
Mais retirer, c'est lire, calculer, écrire : trois étapes non atomiques. Un autre processus peut s'intercaler. [short pause]
P1 lit : cent. P2 lit aussi : cent. [short pause]
P1 calcule soixante-dix, P2 cinquante. P1 écrit soixante-dix, puis P2 écrit cinquante. [short pause]
Solde final : cinquante dollars, au lieu de vingt. Le retrait de P1 est perdu : c'est une condition de concurrence. [short pause]
Le compte est une ressource partagée : plusieurs processus s'en servent. Le code qui y accède est une section critique : à deux en même temps, il y a conflit. [short pause]
L'exclusion mutuelle garantit qu'un seul processus y entre. L'autre attend devant la porte. [short pause]
[calm] Quatre propriétés. Un seul processus à la fois dans la section critique. [short pause]
Un processus qui n'utilise pas la ressource ne bloque pas les autres. [short pause]
Si la section est libre, quelqu'un peut y entrer : le système progresse. Et personne n'a de privilège arbitraire. [short pause]
Schéma constant : entrée, section critique, sortie. [short pause]
[curious] Première idée : une variable commune indique si la ressource est occupée. On la teste : à zéro, on la met à un et on entre. [short pause]
Mais tester puis écrire, ce sont deux instructions : l'autre s'intercale, tous deux voient zéro, tous deux entrent. [short pause]
Il faut une opération atomique : Test and Set lit et modifie le verrou d'un seul bloc, sans interruption. [short pause]
P1 exécute Test and Set et obtient le verrou. P2 essaie : le verrou est occupé. [short pause]
P2 recommence, encore et encore : c'est l'attente active, ou spinlock. Le processeur travaille pour rien. [short pause]
Quand P1 libère le verrou, P2 réussit enfin. Acceptable pour une attente très courte, gaspillé pour une attente longue. [short pause]
Autre approche : masquer les interruptions. Le processeur ignore l'horloge : aucun changement de processus. [short pause]
[thoughtful] Mais c'est dangereux pour un programme utilisateur : s'il oublie de les réactiver, le système se fige. [short pause]
Avec plusieurs processeurs, cela ne suffit pas : un autre cœur accède à la ressource. C'est un outil réservé au noyau, pour de très courts instants. [short pause]
Le verrou, ou mutex, est libre ou occupé. P1 le demande : il est libre, P1 l'obtient et entre dans la section critique. [short pause]
P2 le demande : occupé. Il ne boucle pas : il est bloqué, dans une file d'attente. [short pause]
Un processus bloqué n'utilise pas le processeur : P1 avance librement. [short pause]
Quand P1 libère le verrou, P2 est réveillé : il passe à l'état Prêt, et le verrou lui est transmis. [short pause]
Prêt n'est pas Élu : P2 attend encore le processeur. Contrairement au spinlock, l'attente ne coûte presque rien. [short pause]
[curious] Le sémaphore est plus général : un entier qui compte les autorisations disponibles, et une file d'attente. [short pause]
Il démarre à une valeur positive ou nulle : prenons deux autorisations. Deux opérations atomiques. P, ou wait : demander une autorisation. [short pause]
S'il en reste, la valeur diminue d'un et le processus continue. Sinon, il est bloqué dans la file. [short pause]
V, ou signal : rendre une autorisation. Si un processus attend, il est réveillé et la reçoit. Sinon, la valeur augmente d'un. [short pause]
Rien n'est créé ni perdu : valeur plus autorisations détenues égale le total. [short pause]
Le sémaphore binaire démarre à un : une seule autorisation. Chaque processus fait P, entre dans la section critique, puis fait V. [short pause]
P1 fait P : il passe, la valeur tombe à zéro. P2 fait P : il attend. [short pause]
Quand P1 fait V, l'autorisation passe à P2. Un seul processus à la fois : l'exclusion mutuelle est assurée. [short pause]
Attention, ce n'est pas tout à fait un mutex : le mutex a un propriétaire, qui seul peut le libérer. [short pause]
[thoughtful] Un sémaphore n'en a pas : tout processus peut faire V. Plus souple, mais plus risqué. [short pause]
Trois imprimantes, quatre processus : le sémaphore démarre à trois. [short pause]
Les trois premiers font P : chacun obtient une imprimante, la valeur tombe à zéro. Le quatrième fait P : il attend. [short pause]
Quand un processus a fini, il fait V : une autorisation revient, et le quatrième continue. [short pause]
Le sémaphore de comptage gère plusieurs exemplaires d'une ressource : jamais plus de trois à la fois. [short pause]
Comparons les cinq approches. Sans protection : simple, mais le résultat est faux. [short pause]
Spinlock : correct, mais l'attente consomme du processeur. Mutex bloquant : correct, et l'attente est économe. [short pause]
Sémaphore binaire : même effet, sans propriétaire. Sémaphore de comptage : plusieurs exemplaires d'une ressource. [short pause]
À vous de jouer : le laboratoire vous attend en mode Exploration.
```

## Scènes (début de chaque scène dans le texte)

| # | Scène | Première phrase |
|---|---|---|
| 1 | race | Un compte partagé : cent dollars. P1 retire trente dollars, P2 en retire cinquante. Le bon résultat : vingt dollars. |
| 2 | critical | Le compte est une ressource partagée : plusieurs processus s'en servent. Le code qui y accède est une section critique : à deux en même temps, il y a conflit. |
| 3 | spin | Première idée : une variable commune indique si la ressource est occupée. On la teste : à zéro, on la met à un et on entre. |
| 4 | irq | Autre approche : masquer les interruptions. Le processeur ignore l'horloge : aucun changement de processus. |
| 5 | mutex | Le verrou, ou mutex, est libre ou occupé. P1 le demande : il est libre, P1 l'obtient et entre dans la section critique. |
| 6 | sem | Le sémaphore est plus général : un entier qui compte les autorisations disponibles, et une file d'attente. |
| 7 | binary | Le sémaphore binaire démarre à un : une seule autorisation. Chaque processus fait P, entre dans la section critique, puis fait V. |
| 8 | counting | Trois imprimantes, quatre processus : le sémaphore démarre à trois. |
| 9 | compare | Comparons les cinq approches. Sans protection : simple, mais le résultat est faux. |

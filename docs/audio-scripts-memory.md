# Texte du cours à coller dans ElevenLabs — Eleven v3 (généré — ne pas modifier)

Source : `src/lessons/memory/narration.ts`. Procédure : voir le README, section « Voix ».

- **Un seul texte, un seul MP3** : `public/audio/memory/cours-memoire.mp3`
- Après génération : `python3 scripts/calibrate-sync.py --lesson=memory`

## Texte à coller

Longueur : **2269 caractères** (limite : 5000) · scènes : share, fixed, variable, compact, track, strategies, verdict

```
[curious] Un seul programme en mémoire : quand il attend le disque, le processeur ne fait rien. [short pause]
Alors on en charge plusieurs : c'est la multiprogrammation. Mais il faut partager la RAM. [short pause]
Le gestionnaire de mémoire suit les zones libres et occupées. Chaque processus reste dans sa zone, grâce à un registre de base et un registre limite. [long pause]
Première idée : des partitions fixes, découpées à l'avance. Une partition, un processus. [short pause]
Mais un processus ne remplit pas toute sa partition : cet espace perdu, c'est la fragmentation interne. [long pause]
Et trois partitions, c'est trois processus au maximum : le quatrième attend. [long pause]
Deuxième idée : des partitions variables. Chacun reçoit exactement sa taille. [short pause]
Mais quand un processus termine, il laisse un trou. [long pause]
[thoughtful] Le quatrième aurait de la place au total, mais pas d'un seul tenant : l'allocation échoue. C'est la fragmentation externe. [long pause]
Le compactage déplace les processus pour regrouper les trous. Cette fois, le quatrième entre. [long pause]
Mais copier la mémoire prend du temps, pendant lequel rien ne s'exécute : on ne le fait pas à la légère. [long pause]
Pour retrouver les trous, le système utilise une table de bits, un bit par case, ou une liste chaînée : l'adresse et la taille de chaque zone. [short pause]
La table est simple, mais chercher une suite de cases libres est lent. La liste suit mieux des zones de tailles variables. [long pause]
[curious] Le temps passe : de nouveaux trous apparaissent. Quand plusieurs conviennent, lequel choisir ? Mêmes demandes, quatre stratégies. [short pause]
First Fit prend le premier trou assez grand. [long pause]
Next Fit pareil, mais en reprenant là où il s'est arrêté. [long pause]
Best Fit prend le plus petit qui convient. [long pause]
Worst Fit prend le plus grand. [long pause]
Best Fit gaspille peu à chaque demande, mais laisse de minuscules trous. Worst Fit entame toujours le plus grand. First Fit est rapide, Next Fit répartit. [short pause]
Ici, Best et First Fit échouent sur la dernière demande, pas Worst Fit. Avec d'autres demandes, ce serait l'inverse. [long pause]
[calm] Aucune stratégie n'est toujours la meilleure. À vous d'expérimenter !
```

## Scènes (début de chaque scène dans le texte)

| # | Scène | Première phrase |
|---|---|---|
| 1 | share | Un seul programme en mémoire : quand il attend le disque, le processeur ne fait rien. |
| 2 | fixed | Première idée : des partitions fixes, découpées à l'avance. Une partition, un processus. |
| 3 | variable | Deuxième idée : des partitions variables. Chacun reçoit exactement sa taille. |
| 4 | compact | Le compactage déplace les processus pour regrouper les trous. Cette fois, le quatrième entre. |
| 5 | track | Pour retrouver les trous, le système utilise une table de bits, un bit par case, ou une liste chaînée : l'adresse et la taille de chaque zone. |
| 6 | strategies | Le temps passe : de nouveaux trous apparaissent. Quand plusieurs conviennent, lequel choisir ? Mêmes demandes, quatre stratégies. |
| 7 | verdict | Best Fit gaspille peu à chaque demande, mais laisse de minuscules trous. Worst Fit entame toujours le plus grand. First Fit est rapide, Next Fit répartit. |

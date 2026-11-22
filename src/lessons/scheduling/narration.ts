/**
 * Scripts de narration de la leçon — SOURCE UNIQUE.
 * Chaque ligne = une phrase (ou deux) suivie d'une courte pause dans la voix.
 * - sous-titres et transcription : lignes d'une scène collées avec un espace ;
 * - ElevenLabs (Eleven v3) : UN SEUL texte pour tout le cours — `npm run audio:scripts` le produit (tags + pauses).
 *   Un seul MP3 : `public/audio/scheduling/cours-ordonnancement.mp3`. Chaque scène en occupe une plage de temps,
 *   mesurée par `python3 scripts/calibrate-sync.py` (sync.generated.ts).
 * Pour changer un texte, modifiez-le ici, régénérez le MP3 entier, puis relancez la calibration.
 * (Les chiffres 8,75 / 4,25 / 4,5 sont ceux calculés par le moteur pour DEMO_PROCS.)
 */
export type SceneKey = 'intro' | 'fcfs' | 'sjf' | 'rr' | 'context' | 'quantum' | 'compare'

/** Ordre des scènes = ordre de lecture dans le MP3 */
export const SCENE_ORDER: SceneKey[] = ['intro', 'fcfs', 'sjf', 'rr', 'context', 'quantum', 'compare']

export const AUDIO_FILE = 'cours-ordonnancement.mp3'
export const AUDIO_URL = `/audio/scheduling/${AUDIO_FILE}`

export const LINES: Record<SceneKey, string[]> = {
  intro: [
    'Imaginez un seul guichet et quatre clients pressés.',
    "Dans un ordinateur, le guichet, c'est le processeur. Les clients, ce sont les processus.",
    "Un seul peut être servi à la fois : il faut donc décider de l'ordre.",
    "Cette décision, c'est le travail de l'ordonnanceur.",
  ],
  fcfs: [
    'Premier algorithme : FCFS, premier arrivé, premier servi.',
    "C'est la file d'attente de la boulangerie : on passe dans l'ordre.",
    "P1 prend le processeur. Il en a besoin pendant 8 unités, et personne ne peut le doubler. Pendant ce temps, P2, qui n'a besoin que de 3 unités, patiente.",
    'Quand P1 termine, P2 passe. Puis vient P3, 5 unités. Et enfin P4, 2 unités.',
    "Voici l'effet de convoi : un long processus au début retarde tous les autres.",
    "Ici, l'attente moyenne est de 8,75 unités.",
  ],
  sjf: [
    "Deuxième algorithme : SJF, le plus court d'abord.",
    "L'ordonnanceur regarde la durée de chaque processus, et choisit toujours le plus court.",
    'La file se trie : P4, 2 unités, passe en premier. Puis P2, 3 unités. Puis P3, 5 unités.',
    "Et P1, le plus long, passe en dernier. Dans la version non préemptive, un processus lancé n'est jamais interrompu.",
    "Résultat : l'attente moyenne chute à 4,25 unités. Mais attention : un gros processus peut attendre très longtemps. C'est la famine.",
  ],
  rr: [
    'Troisième algorithme : Round Robin, le tourniquet.',
    'Chaque processus reçoit le processeur pour un quantum de 3 unités au maximum.',
    "P1 s'exécute 3 unités. Son travail n'est pas terminé : il est interrompu, son contexte est sauvegardé, et il est replacé à la fin de la file. P2 passe à son tour, puis P3.",
    "P4 n'a besoin que de 2 unités : il rend le processeur plus tôt.",
    'Ensuite, P1 et P3 repassent pour finir leur travail. Chacun retrouve son contexte et reprend où il s\'était arrêté.',
    "Personne n'attend longtemps avant de démarrer : le temps de réponse moyen est de 4,5 unités, contre 8,75 en FCFS.",
  ],
  context: [
    'Que se passe-t-il vraiment quand le processeur interrompt un processus ?',
    "Regardons P1 s'exécuter. Le processeur suit son avancement grâce à des registres : le compteur de programme, qui désigne la prochaine instruction, le pointeur de pile, et un registre de calcul.",
    'Les données de P1, ses variables, restent dans sa mémoire. Le processeur les charge, calcule, puis les range.',
    "Le quantum est écoulé. L'horloge déclenche une interruption : le système reprend la main.",
    'Première étape : il sauvegarde le contexte de P1, c\'est-à-dire ses registres, dans son bloc de contrôle, le PCB, en mémoire.',
    'Deuxième étape : il charge le contexte de P2, et P2 peut s\'exécuter.',
    'Quand P2 se termine, le système restaure le contexte de P1 : mêmes valeurs, même instruction.',
    "P1 repart exactement là où il s'était arrêté, sans rien remarquer.",
    "Cette opération est précieuse, mais elle a un coût : pendant le transfert, le processeur ne fait aucun travail utile. C'est pourquoi changer trop souvent de contexte fait perdre du temps.",
  ],
  quantum: [
    'Le quantum est un réglage délicat.',
    'Avec un quantum de 1 unité, les processus alternent sans cesse : le système perd beaucoup de temps à changer de contexte.',
    "Avec un quantum de 3, l'équilibre est bon.",
    "Avec un quantum de 8, plus aucun processus n'est interrompu : Round Robin se comporte comme FCFS.",
    'Un bon quantum se situe entre les deux.',
  ],
  compare: [
    'Comparons les trois approches.',
    'SJF obtient la plus faible attente moyenne.',
    'Round Robin offre le meilleur temps de réponse.',
    "FCFS reste le plus simple, mais il est sensible à l'effet de convoi.",
    "Aucun algorithme n'est le meilleur partout : tout dépend de ce que l'on cherche à optimiser.",
    "À vous de jouer : passez en mode Exploration pour modifier les durées et le quantum.",
  ],
}

/**
 * Audio Tags (Eleven v3) — couche de direction vocale, SANS effet sur le texte :
 * ils n'apparaissent ni dans les sous-titres ni dans la transcription.
 * Parcimonie : curiosité pour les amorces, ton posé pour l'analyse, léger enthousiasme pour les trouvailles.
 * Tags utilisés (documentés par ElevenLabs) : [curious] [thoughtful] [excited] [calm].
 * Clé = numéro de ligne (à partir de 0) ; le tag est placé en début de ligne.
 */
export const TAGS: Partial<Record<SceneKey, Record<number, string>>> = {
  intro: { 0: '[curious]', 2: '[thoughtful]', 3: '[excited]' },
  fcfs: { 1: '[curious]', 4: '[thoughtful]' },
  sjf: { 1: '[curious]', 4: '[excited]' },
  rr: { 5: '[excited]' },
  context: { 0: '[curious]', 3: '[thoughtful]', 7: '[excited]', 8: '[thoughtful]' },
  quantum: { 0: '[curious]', 1: '[thoughtful]', 4: '[calm]' },
  compare: { 4: '[thoughtful]', 5: '[excited]' },
}

/** Tags insérés au milieu d'une ligne : [scène, ligne, début de l'expression, tag] */
export const INLINE_TAGS: [SceneKey, number, string, string][] = [['sjf', 4, 'Mais attention', '[thoughtful]']]

export const narrationOf = (k: SceneKey) => LINES[k].join(' ')

/** Pause entre les lignes : '[pause]', '[short pause]' ou '[long pause]' (durée non réglable, à comparer à l'écoute) */
export const V3_PAUSE = '[short pause]'

/** Lignes d'une scène, avec leurs tags (texte à coller dans ElevenLabs, Eleven v3) */
export const taggedLines = (k: SceneKey): string[] =>
  LINES[k].map((line, i) => {
    let t = line
    for (const [sk, li, phrase, tag] of INLINE_TAGS) if (sk === k && li === i) t = t.replace(phrase, `${tag} ${phrase}`)
    const tag = TAGS[k]?.[i]
    return `${tag ? tag + ' ' : ''}${t}`
  })

/** LE texte du cours : toutes les scènes, dans l'ordre, à coller en une seule fois dans ElevenLabs */
export const courseScript = () => SCENE_ORDER.flatMap(taggedLines).join(` ${V3_PAUSE}\n`)

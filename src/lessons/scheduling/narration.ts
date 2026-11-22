/**
 * Scripts de narration de la leçon — SOURCE UNIQUE.
 * Chaque ligne = une phrase (ou deux) suivie d'une courte pause dans la voix.
 * - sous-titres et transcription : lignes collées avec un espace ;
 * - ElevenLabs (Eleven v3) : `npm run audio:scripts` produit le texte à coller (tags + pauses).
 * Pour changer un texte, modifiez-le ici : si le MP3 est déjà généré, régénérez-le puis
 * relancez `python3 scripts/silences.py` pour remettre à jour `sync`.
 * (Les chiffres 8,75 / 4,25 / 4,5 sont ceux calculés par le moteur pour DEMO_PROCS.)
 */
export type SceneKey = 'intro' | 'fcfs' | 'sjf' | 'rr' | 'quantum' | 'compare'

export const FILES: Record<SceneKey, string> = {
  intro: '01-intro.mp3',
  fcfs: '02-fcfs.mp3',
  sjf: '03-sjf.mp3',
  rr: '04-round-robin.mp3',
  quantum: '05-quantum.mp3',
  compare: '06-comparaison.mp3',
}

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
    "P1 s'exécute 3 unités. Son travail n'est pas terminé : il est interrompu et replacé à la fin de la file. P2 passe à son tour, puis P3.",
    "P4 n'a besoin que de 2 unités : il rend le processeur plus tôt.",
    'Ensuite, P1 et P3 repassent pour finir leur travail.',
    "Personne n'attend longtemps avant de démarrer : le temps de réponse moyen est de 4,5 unités, contre 8,75 en FCFS.",
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
  quantum: { 0: '[curious]', 1: '[thoughtful]', 4: '[calm]' },
  compare: { 4: '[thoughtful]', 5: '[excited]' },
}

/** Tags insérés au milieu d'une ligne : [scène, ligne, début de l'expression, tag] */
export const INLINE_TAGS: [SceneKey, number, string, string][] = [['sjf', 4, 'Mais attention', '[thoughtful]']]

export const narrationOf = (k: SceneKey) => LINES[k].join(' ')
export const audioOf = (k: SceneKey) => `/audio/scheduling/${FILES[k]}`

/** Pause entre les lignes : '[pause]', '[short pause]' ou '[long pause]' (durée non réglable, à comparer à l'écoute) */
export const V3_PAUSE = '[short pause]'

/** Texte à coller dans ElevenLabs (modèle Eleven v3) : Audio Tags + pauses entre les lignes */
export const ttsV3Of = (k: SceneKey) =>
  LINES[k]
    .map((line, i) => {
      let t = line
      for (const [sk, li, phrase, tag] of INLINE_TAGS) if (sk === k && li === i) t = t.replace(phrase, `${tag} ${phrase}`)
      const tag = TAGS[k]?.[i]
      return `${tag ? tag + ' ' : ''}${t}`
    })
    .join(` ${V3_PAUSE}\n`)

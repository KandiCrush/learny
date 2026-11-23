/**
 * Scripts de narration de la leçon « Cycle de vie d'un processus » — SOURCE UNIQUE.
 * Même principe que la leçon d'ordonnancement (voir src/lessons/scheduling/narration.ts) :
 * - chaque ligne = une phrase (ou deux) suivie d'une courte pause dans la voix ;
 * - sous-titres et transcription : lignes d'une scène collées avec un espace ;
 * - ElevenLabs (Eleven v3) : UN SEUL texte pour tout le cours — `npm run audio:scripts -- lifecycle`
 *   (écrit docs/audio-scripts-lifecycle.md). Un seul MP3 : `public/audio/lifecycle/cours-cycle-de-vie.mp3`.
 *   Aucun MP3 n'existe encore : la leçon se joue en silence avec des durées estimées ; aucune voix n'a été générée.
 * - après génération : `python3 scripts/calibrate-sync.py --lesson=lifecycle` (remplit sync.generated.ts).
 *
 * Règles de rédaction (la voix épelle les sigles et lit les nombres en toutes lettres) :
 * les nombres sont écrits en lettres, les noms de processus sont des applications (navigateur, musique…)
 * et le seul sigle est « PCB » (épelé : déjà vu dans la leçon d'ordonnancement).
 */
export type SceneKey = 'what' | 'why' | 'transitions' | 'scheduler' | 'example' | 'recap'

/** Ordre des scènes = ordre de lecture dans le MP3 */
export const SCENE_ORDER: SceneKey[] = ['what', 'why', 'transitions', 'scheduler', 'example', 'recap']

export const AUDIO_FILE = 'cours-cycle-de-vie.mp3'
export const AUDIO_URL = `/audio/lifecycle/${AUDIO_FILE}`

export const LINES: Record<SceneKey, string[]> = {
  what: [
    "Sur votre disque, un programme dort : c'est un fichier, une liste d'instructions.",
    'Il ne fait rien. Un programme est passif.',
    "Double-cliquez : le système le charge en mémoire, lui réserve de la place, et lui ouvre une fiche d'identité, le PCB.",
    "Un processus est un programme en cours d'exécution.",
    'Lancez-le une deuxième fois : un seul programme, mais deux processus, chacun avec sa propre vie.',
    "Le programme, c'est la recette. Le processus, c'est le cuisinier qui la prépare, en ce moment même.",
  ],
  why: [
    'Votre ordinateur fait tourner un navigateur, de la musique, un éditeur de texte et une messagerie.',
    'Tous veulent le processeur, en même temps.',
    "Mais un processeur à un seul cœur ne peut exécuter qu'un seul processus à la fois.",
    "Les autres ne sont pas tous dans la même situation.",
    "Certains sont prêts : ils ont tout ce qu'il leur faut, et n'attendent que le processeur. C'est l'état Prêt.",
    "Un seul utilise le processeur, à cet instant précis. C'est l'état Élu, ou en exécution.",
    "Et un autre ne peut même pas avancer : il attend une donnée du réseau. C'est l'état Bloqué.",
    'Trois états, parce que ce sont trois situations vraiment différentes.',
  ],
  transitions: [
    'Assemblons le diagramme : trois états, et quatre transitions.',
    "Première transition, de Prêt vers Élu : l'ordonnanceur sélectionne le navigateur, et lui donne le processeur.",
    "Deuxième, d'Élu vers Prêt : le temps est écoulé, et le système retire le processeur au navigateur. Il n'a pas fini, il retourne dans la file. C'est la préemption.",
    "Troisième, d'Élu vers Bloqué : le navigateur demande une page au réseau. Sans elle, il ne peut rien faire. Il libère le processeur et attend.",
    "Quatrième, de Bloqué vers Prêt : la page arrive. L'attente est finie, mais le navigateur n'a pas encore le processeur : il se remet en file.",
    'Remarquez ce qui manque : aucune flèche ne relie Bloqué à Élu.',
  ],
  scheduler: [
    "Qui décide de ces élections ? L'ordonnanceur.",
    "Chaque fois que le processeur se libère, il regarde la file des processus prêts, et en choisit un. Ici, le premier arrivé.",
    "Attention : être prêt, ce n'est pas utiliser le processeur. Prêt veut dire : j'attends mon tour. Élu veut dire : je calcule, maintenant.",
    "Et le processus bloqué ? Quand sa page arrive, il ne saute pas sur le processeur.",
    "D'abord, le processeur est peut-être occupé. Ensuite, seul l'ordonnanceur décide qui l'obtient.",
    'Le processus réveillé rejoint donc la file des prêts, et attend son tour, comme les autres.',
  ],
  example: [
    "Reprenons tout dans un exemple complet : le navigateur, la musique et l'éditeur sont prêts.",
    "L'ordonnanceur élit le navigateur. Il passe sur le processeur.",
    'Le navigateur demande une page au réseau. Il doit attendre : il est bloqué, et le processeur se libère.',
    "Aussitôt, l'ordonnanceur élit la musique.",
    "Pendant ce temps, la page arrive. Le navigateur n'est pas relancé : il rejoint la file des prêts, derrière l'éditeur.",
    'Le temps de la musique est écoulé : le système lui retire le processeur, et elle retourne dans la file.',
    "L'éditeur est élu. Le navigateur, lui, est le suivant.",
    'Prêt, élu, bloqué, prêt : à chaque étape, il y avait une raison.',
  ],
  recap: [
    "Résumons. Un processus est un programme en cours d'exécution.",
    "Il est Prêt quand il attend le processeur, Élu quand il l'utilise, Bloqué quand il attend un événement.",
    "Quatre transitions : l'ordonnanceur élit, le système préempte, le processus se bloque, l'événement le réveille.",
    "Et la règle d'or : un processus bloqué repasse toujours par l'état Prêt.",
    'À vous de jouer : en mode Exploration, créez des processus et faites-les vivre.',
  ],
}

/**
 * Audio Tags (Eleven v3) — couche de direction vocale, SANS effet sur le texte (jamais affichés).
 * Parcimonie : [curious] pour les questions, [thoughtful] pour les nuances, [excited] pour les moments clés.
 * Clé = numéro de ligne (à partir de 0) ; le tag est placé en début de ligne.
 */
export const TAGS: Partial<Record<SceneKey, Record<number, string>>> = {
  what: { 0: '[curious]', 3: '[excited]' },
  why: { 2: '[thoughtful]', 7: '[calm]' },
  transitions: { 0: '[curious]', 5: '[thoughtful]' },
  scheduler: { 0: '[curious]', 2: '[thoughtful]' },
  example: { 0: '[calm]', 7: '[excited]' },
  recap: { 3: '[thoughtful]', 4: '[excited]' },
}

/** Tags insérés au milieu d'une ligne : [scène, ligne, début de l'expression, tag] */
export const INLINE_TAGS: [SceneKey, number, string, string][] = []

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

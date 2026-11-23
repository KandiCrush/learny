/**
 * Scripts de narration de la leçon « Exclusion mutuelle, attente active, verrous et sémaphores » — SOURCE UNIQUE.
 * Même principe que les autres leçons (voir src/lessons/lifecycle/narration.ts) :
 * - `npm run audio:scripts -- mutex` écrit docs/audio-scripts-mutex.md : UN texte à coller dans ElevenLabs (Eleven v3) ;
 * - un seul MP3 : `public/audio/mutex/cours-exclusion-mutuelle.mp3` (limite 5 000 caractères, vérifiée par le script) ;
 * - ensuite `python3 scripts/calibrate-sync.py --lesson=mutex` (remplit sync.generated.ts). Aucun MP3 n'existe encore :
 *   la leçon se joue en silence avec des durées estimées.
 * Les nombres sont écrits en lettres ; « P1 » est dit « P un » ; les opérations P et V sont dites « P » et « V ».
 */
export type SceneKey = 'race' | 'critical' | 'spin' | 'irq' | 'mutex' | 'sem' | 'binary' | 'counting' | 'compare'

/** Ordre des scènes = ordre de lecture dans le MP3 */
export const SCENE_ORDER: SceneKey[] = ['race', 'critical', 'spin', 'irq', 'mutex', 'sem', 'binary', 'counting', 'compare']

export const AUDIO_FILE = 'cours-exclusion-mutuelle.mp3'
export const AUDIO_URL = `/audio/mutex/${AUDIO_FILE}`

export const LINES: Record<SceneKey, string[]> = {
  race: [
    "Un compte partagé : cent dollars. P1 retire trente dollars, P2 en retire cinquante. Le bon résultat : vingt dollars.",
    "Mais retirer, c'est lire, calculer, écrire : trois étapes non atomiques. Un autre processus peut s'intercaler.",
    "P1 lit : cent. P2 lit aussi : cent.",
    "P1 calcule soixante-dix, P2 cinquante. P1 écrit soixante-dix, puis P2 écrit cinquante.",
    "Solde final : cinquante dollars, au lieu de vingt. Le retrait de P1 est perdu : c'est une condition de concurrence.",
  ],
  critical: [
    "Le compte est une ressource partagée : plusieurs processus s'en servent. Le code qui y accède est une section critique : à deux en même temps, il y a conflit.",
    "L'exclusion mutuelle garantit qu'un seul processus y entre. L'autre attend devant la porte.",
    "Quatre propriétés. Un seul processus à la fois dans la section critique.",
    "Un processus qui n'utilise pas la ressource ne bloque pas les autres.",
    "Si la section est libre, quelqu'un peut y entrer : le système progresse. Et personne n'a de privilège arbitraire.",
    "Schéma constant : entrée, section critique, sortie.",
  ],
  spin: [
    "Première idée : une variable commune indique si la ressource est occupée. On la teste : à zéro, on la met à un et on entre.",
    "Mais tester puis écrire, ce sont deux instructions : l'autre s'intercale, tous deux voient zéro, tous deux entrent.",
    "Il faut une opération atomique : Test and Set lit et modifie le verrou d'un seul bloc, sans interruption.",
    "P1 exécute Test and Set et obtient le verrou. P2 essaie : le verrou est occupé.",
    "P2 recommence, encore et encore : c'est l'attente active, ou spinlock. Le processeur travaille pour rien.",
    "Quand P1 libère le verrou, P2 réussit enfin. Acceptable pour une attente très courte, gaspillé pour une attente longue.",
  ],
  irq: [
    "Autre approche : masquer les interruptions. Le processeur ignore l'horloge : aucun changement de processus.",
    "Mais c'est dangereux pour un programme utilisateur : s'il oublie de les réactiver, le système se fige.",
    "Avec plusieurs processeurs, cela ne suffit pas : un autre cœur accède à la ressource. C'est un outil réservé au noyau, pour de très courts instants.",
  ],
  mutex: [
    "Le verrou, ou mutex, est libre ou occupé. P1 le demande : il est libre, P1 l'obtient et entre dans la section critique.",
    "P2 le demande : occupé. Il ne boucle pas : il est bloqué, dans une file d'attente.",
    "Un processus bloqué n'utilise pas le processeur : P1 avance librement.",
    "Quand P1 libère le verrou, P2 est réveillé : il passe à l'état Prêt, et le verrou lui est transmis.",
    "Prêt n'est pas Élu : P2 attend encore le processeur. Contrairement au spinlock, l'attente ne coûte presque rien.",
  ],
  sem: [
    "Le sémaphore est plus général : un entier qui compte les autorisations disponibles, et une file d'attente.",
    "Il démarre à une valeur positive ou nulle : prenons deux autorisations. Deux opérations atomiques. P, ou wait : demander une autorisation.",
    "S'il en reste, la valeur diminue d'un et le processus continue. Sinon, il est bloqué dans la file.",
    "V, ou signal : rendre une autorisation. Si un processus attend, il est réveillé et la reçoit. Sinon, la valeur augmente d'un.",
    "Rien n'est créé ni perdu : valeur plus autorisations détenues égale le total.",
  ],
  binary: [
    "Le sémaphore binaire démarre à un : une seule autorisation. Chaque processus fait P, entre dans la section critique, puis fait V.",
    "P1 fait P : il passe, la valeur tombe à zéro. P2 fait P : il attend.",
    "Quand P1 fait V, l'autorisation passe à P2. Un seul processus à la fois : l'exclusion mutuelle est assurée.",
    "Attention, ce n'est pas tout à fait un mutex : le mutex a un propriétaire, qui seul peut le libérer.",
    "Un sémaphore n'en a pas : tout processus peut faire V. Plus souple, mais plus risqué.",
  ],
  counting: [
    "Trois imprimantes, quatre processus : le sémaphore démarre à trois.",
    "Les trois premiers font P : chacun obtient une imprimante, la valeur tombe à zéro. Le quatrième fait P : il attend.",
    "Quand un processus a fini, il fait V : une autorisation revient, et le quatrième continue.",
    "Le sémaphore de comptage gère plusieurs exemplaires d'une ressource : jamais plus de trois à la fois.",
  ],
  compare: [
    "Comparons les cinq approches. Sans protection : simple, mais le résultat est faux.",
    "Spinlock : correct, mais l'attente consomme du processeur. Mutex bloquant : correct, et l'attente est économe.",
    "Sémaphore binaire : même effet, sans propriétaire. Sémaphore de comptage : plusieurs exemplaires d'une ressource.",
    "À vous de jouer : le laboratoire vous attend en mode Exploration.",
  ],
}

/**
 * Audio Tags (Eleven v3) — direction vocale, jamais affichés. Parcimonie : [curious] questions et amorces,
 * [thoughtful] nuances et limites ([excited] n'est plus utilisé). Clé = numéro de ligne (à partir de 0).
 */
export const TAGS: Partial<Record<SceneKey, Record<number, string>>> = {
  race: { 0: '[curious]' },
  critical: { 2: '[calm]' },
  spin: { 0: '[curious]' },
  irq: { 1: '[thoughtful]' },
  sem: { 0: '[curious]' },
  binary: { 4: '[thoughtful]' },
}

export const INLINE_TAGS: [SceneKey, number, string, string][] = []

export const narrationOf = (k: SceneKey) => LINES[k].join(' ')

/** Pause entre les lignes : '[pause]', '[short pause]' ou '[long pause]' */
export const V3_PAUSE = '[short pause]'

export const taggedLines = (k: SceneKey): string[] =>
  LINES[k].map((line, i) => {
    let t = line
    for (const [sk, li, phrase, tag] of INLINE_TAGS) if (sk === k && li === i) t = t.replace(phrase, `${tag} ${phrase}`)
    const tag = TAGS[k]?.[i]
    return `${tag ? tag + ' ' : ''}${t}`
  })

/** LE texte du cours : toutes les scènes, dans l'ordre, à coller en une seule fois dans ElevenLabs */
export const courseScript = () => SCENE_ORDER.flatMap(taggedLines).join(` ${V3_PAUSE}\n`)

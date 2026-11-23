import type { LexiconEntry } from '../types'

/** Lexique de la leçon : affiché par le bouton « Lexique » (components/LexiconMenu.tsx) */
export const LEXICON: LexiconEntry[] = [
  { term: 'Programme', definition: "Ensemble d'instructions que l'ordinateur peut exécuter. Il dort sur le disque tant qu'on ne le lance pas.", aliases: ['fichier', 'application'] },
  { term: 'Processus', definition: 'Programme en cours d’exécution : il a sa mémoire, sa place dans les files et son état.', aliases: ['process', 'tâche'] },
  { term: 'État prêt', definition: 'Le processus peut s’exécuter, mais il attend que le CPU lui soit attribué.', aliases: ['ready', 'prêt'] },
  { term: 'État élu', definition: 'Le processus utilise le processeur en ce moment. Sur un cœur, il n’y en a qu’un à la fois.', aliases: ['en exécution', 'running', 'élu'] },
  { term: 'État bloqué', definition: 'Le processus attend une donnée ou un événement (disque, réseau, clavier) avant de pouvoir continuer.', aliases: ['blocked', 'attente', 'bloqué'] },
  { term: 'Ordonnanceur', definition: 'Composant du système d’exploitation qui décide quel processus prêt utilise le CPU.', aliases: ['scheduler'] },
  { term: 'CPU', definition: 'Composant de l’ordinateur qui exécute les instructions des programmes.', aliases: ['processeur', 'cœur'] },
  { term: 'Transition d’état', definition: 'Passage d’un état à un autre après un événement (par exemple Élu → Bloqué).', aliases: ['transition', 'changement d’état'] },
  { term: 'Préemption', definition: 'Retrait du processeur à un processus par le système d’exploitation, sans que le processus l’ait demandé.', aliases: ['préempter', 'préempté'] },
]

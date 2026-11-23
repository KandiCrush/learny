import type { LexiconEntry } from '../types'

/** Lexique de la leçon : affiché par le bouton « Lexique » (components/LexiconMenu.tsx) */
export const LEXICON: LexiconEntry[] = [
  { term: 'Ressource partagée', definition: 'Ce que plusieurs processus utilisent en même temps : une variable, un fichier, une imprimante, un compte bancaire.', aliases: ['partagé', 'variable commune'] },
  { term: 'Section critique', definition: 'Partie du programme qui accède à une ressource partagée. Si deux processus l’exécutent en même temps, le résultat peut être faux.', aliases: ['zone critique'] },
  { term: 'Exclusion mutuelle', definition: 'Règle qui garantit qu’un seul processus à la fois est dans la section critique protégée par le même mécanisme.', aliases: ['mutual exclusion', 'mutex'] },
  { term: 'Condition de concurrence (race condition)', definition: 'Le résultat dépend de l’ordre dans lequel les processus s’entrecroisent. Avec un mauvais ordre, une mise à jour peut être perdue.', aliases: ['race condition', 'perte de mise à jour', 'concurrence'] },
  { term: 'Opération atomique', definition: 'Opération qui se déroule d’un seul bloc : aucun autre processus ne peut s’intercaler au milieu.', aliases: ['atomique', 'atomicité'] },
  { term: 'Attente active', definition: 'Le processus reste sur le CPU et teste la condition en boucle jusqu’à ce qu’elle soit vraie. Il occupe le processeur pour rien.', aliases: ['busy waiting', 'boucle'] },
  { term: 'Test and Set (TAS)', definition: 'Instruction atomique : elle lit la valeur du verrou et la met à 1 en une seule fois. Si l’ancienne valeur était 0, le verrou est obtenu.', aliases: ['TAS', 'test-and-set'] },
  { term: 'Spinlock', definition: 'Verrou à attente active : le processus qui attend répète Test and Set. Convient aux attentes très courtes.', aliases: ['verrou tournant'] },
  { term: 'Mutex', definition: 'Verrou à deux états, libre ou occupé. Celui qui le prend doit le rendre. Un processus qui attend est bloqué, pas en train de boucler.', aliases: ['verrou', 'lock', 'verrou bloquant'] },
  { term: 'File d’attente', definition: 'Liste des processus bloqués qui attendent un verrou ou un sémaphore. Au réveil, le premier de la liste passe en premier.', aliases: ['queue', 'fifo'] },
  { term: 'Sémaphore', definition: 'Un entier qui compte les autorisations disponibles, plus une file d’attente. On le manipule avec P et V.', aliases: ['semaphore'] },
  { term: 'Sémaphore binaire', definition: 'Sémaphore initialisé à 1 : une seule autorisation, donc un seul processus à la fois. Il n’a pas de propriétaire.', aliases: ['binaire'] },
  { term: 'Sémaphore de comptage', definition: 'Sémaphore initialisé à N : il autorise jusqu’à N processus en même temps, par exemple pour N imprimantes identiques.', aliases: ['comptage', 'compteur'] },
  { term: 'P / Wait', definition: 'Demande une autorisation. S’il y en a une, la valeur baisse de 1 et on continue ; sinon, on est bloqué dans la file.', aliases: ['P', 'wait', 'down', 'proberen'] },
  { term: 'V / Signal', definition: 'Rend une autorisation. Si un processus attend, il est réveillé et la reçoit ; sinon, la valeur augmente de 1.', aliases: ['V', 'signal', 'up', 'verhogen'] },
]

import type { LexiconEntry } from '../types'

/** Lexique de la leçon : affiché par le bouton « Lexique » (components/LexiconMenu.tsx) */
export const LEXICON: LexiconEntry[] = [
  { term: 'Mémoire vive (RAM)', definition: 'Mémoire rapide où se trouvent les programmes en cours d’exécution et leurs données. Sa taille est limitée et elle se vide à l’arrêt.', aliases: ['RAM', 'mémoire principale'] },
  { term: 'Gestionnaire de mémoire', definition: 'Partie du système d’exploitation qui sait quelles zones de la RAM sont libres ou occupées, les attribue aux processus et les récupère.', aliases: ['memory manager'] },
  { term: 'Allocation mémoire', definition: 'Attribution à un processus d’une zone de la RAM de la taille demandée. Avec l’allocation contiguë, cette zone est d’un seul tenant.', aliases: ['allouer', 'allocation contiguë'] },
  { term: 'Partition', definition: 'Zone de la RAM réservée à un processus.', aliases: ['zone'] },
  { term: 'Partition fixe', definition: 'Partition dont la taille est décidée à l’avance et ne change pas. Un processus occupe toute une partition, même s’il est plus petit.', aliases: ['partitions fixes'] },
  { term: 'Partition variable', definition: 'Partition créée à la taille exacte demandée par le processus, puis rendue libre quand il termine.', aliases: ['partitions variables'] },
  { term: 'Fragmentation interne', definition: 'Espace réservé à un processus mais inutilisé, à l’intérieur de sa partition (typique des partitions fixes).', aliases: ['gaspillage interne'] },
  { term: 'Fragmentation externe', definition: 'La mémoire libre est répartie en petits trous séparés : il y en a assez au total, mais aucun trou n’est assez grand pour une demande.', aliases: ['trous', 'morcellement'] },
  { term: 'Zone libre', definition: 'Morceau de RAM contigu qui n’est attribué à personne. On l’appelle aussi un trou.', aliases: ['trou', 'hole', 'espace libre'] },
  { term: 'Compactage', definition: 'Déplacer les processus pour regrouper tous les trous en une seule grande zone libre. Coûteux : il faut copier la mémoire, et rien ne s’exécute pendant ce temps.', aliases: ['compaction', 'défragmentation'] },
  { term: 'First Fit', definition: 'Premier ajustement : choisit la première zone libre assez grande, en partant du début de la mémoire.', aliases: ['premier ajustement'] },
  { term: 'Next Fit', definition: 'Ajustement suivant : comme First Fit, mais la recherche reprend là où la précédente s’est arrêtée, avec retour au début si besoin.', aliases: ['ajustement suivant'] },
  { term: 'Best Fit', definition: 'Meilleur ajustement : choisit la plus petite zone libre qui suffit. Il laisse souvent de minuscules trous inutilisables.', aliases: ['meilleur ajustement'] },
  { term: 'Worst Fit', definition: 'Pire ajustement : choisit la plus grande zone libre, en espérant que le reste serve encore. Il entame les grands trous.', aliases: ['pire ajustement'] },
  { term: 'Table de bits', definition: 'Un bit par unité de mémoire : 0 si elle est libre, 1 si elle est occupée. Simple, mais trouver une longue suite de 0 prend du temps.', aliases: ['bitmap'] },
  { term: 'Liste chaînée', definition: 'Une liste de zones, chacune avec son état (occupée ou libre), son adresse de départ et sa taille. Elle s’adapte aux zones de tailles variables.', aliases: ['linked list', 'liste de zones'] },
]

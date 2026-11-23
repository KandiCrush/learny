/**
 * Catalogue de la bibliothèque (données locales de démonstration).
 * Pour rendre une leçon ouvrable : renseigner `lessonId` (clé de src/lessons/registry.ts).
 * Sans `lessonId`, la leçon apparaît comme « Bientôt ».
 */
export type IconKey = 'cpu' | 'network' | 'binary' | 'database' | 'layers' | 'memory' | 'timer' | 'branch' | 'shield' | 'disk' | 'boxes' | 'workflow'

export interface FolderNode {
  kind: 'folder'
  id: string
  name: string
  description: string
  color: string
  icon: IconKey
  children: Node[]
}

export interface LessonNode {
  kind: 'lesson'
  id: string
  name: string
  description: string
  color: string
  icon: IconKey
  lessonId?: string
}

export type Node = FolderNode | LessonNode

const lesson = (id: string, name: string, description: string, color: string, icon: IconKey, lessonId?: string): LessonNode =>
  ({ kind: 'lesson', id, name, description, color, icon, lessonId })

export const catalog: FolderNode = {
  kind: 'folder', id: 'root', name: 'Bibliothèque', description: 'Tous vos cours', color: '#8b7bff', icon: 'layers',
  children: [
    {
      kind: 'folder', id: 'os', name: 'Systèmes d’exploitation', description: 'Processus, mémoire, fichiers : ce que fait le noyau pour vous.', color: '#8b7bff', icon: 'cpu',
      children: [
        {
          kind: 'folder', id: 'os-proc', name: 'Gestion des processus', description: 'Vie, mort et ordonnancement des processus.', color: '#ff6b6b', icon: 'workflow',
          children: [
            lesson('lifecycle', 'Cycle de vie d’un processus', 'Prêt, Élu, Bloqué : comment un processus partage le processeur.', '#5eead4', 'workflow', 'lifecycle'),
            lesson('sched', 'Ordonnancement des processus', 'FCFS, SJF et Round Robin : qui passe sur le processeur, et pourquoi ?', '#ff6b6b', 'timer', 'scheduling'),
            lesson('mutex', 'Exclusion mutuelle, attente active, verrous et sémaphores', 'Protéger une ressource partagée : spinlock, mutex, sémaphores.', '#f472b6', 'shield', 'mutex'),
            lesson('threads', 'Processus et threads', 'Ce que partagent (ou non) les flux d’exécution.', '#ffb84d', 'branch'),
            lesson('deadlock', 'Interblocages', 'Quand tout le monde attend tout le monde.', '#f472b6', 'shield'),
          ],
        },
        {
          kind: 'folder', id: 'os-mem', name: 'Mémoire', description: 'Pagination, segmentation, mémoire virtuelle.', color: '#ffb84d', icon: 'memory',
          children: [
            lesson('paging', 'Pagination', 'Découper la mémoire en pages de taille fixe.', '#ffb84d', 'memory'),
            lesson('virt', 'Mémoire virtuelle', 'Faire croire à chaque programme qu’il est seul.', '#5eead4', 'layers'),
          ],
        },
        lesson('fs', 'Systèmes de fichiers', 'Du bloc disque au dossier.', '#60a5fa', 'disk'),
      ],
    },
    {
      kind: 'folder', id: 'net', name: 'Réseaux', description: 'Comment les machines se parlent.', color: '#60a5fa', icon: 'network',
      children: [
        lesson('tcp', 'TCP et la fiabilité', 'Accusés de réception, fenêtres, retransmissions.', '#60a5fa', 'network'),
        lesson('dns', 'Résolution DNS', 'De « exemple.fr » à une adresse IP.', '#5eead4', 'network'),
        lesson('routing', 'Routage', 'Choisir le chemin d’un paquet.', '#a78bfa', 'branch'),
      ],
    },
    {
      kind: 'folder', id: 'algo', name: 'Algorithmique', description: 'Structures de données et algorithmes classiques.', color: '#5eead4', icon: 'binary',
      children: [
        lesson('sort', 'Algorithmes de tri', 'Fusion, rapide, tas : comparer leurs mouvements.', '#5eead4', 'binary'),
        lesson('graphs', 'Parcours de graphes', 'Largeur, profondeur et plus courts chemins.', '#60a5fa', 'branch'),
      ],
    },
    {
      kind: 'folder', id: 'db', name: 'Bases de données', description: 'Stocker, indexer, garantir la cohérence.', color: '#f472b6', icon: 'database',
      children: [
        lesson('btree', 'Index B-arbre', 'Pourquoi les recherches restent rapides.', '#f472b6', 'database'),
        lesson('acid', 'Transactions ACID', 'Atomicité, cohérence, isolation, durabilité.', '#ffb84d', 'shield'),
      ],
    },
    {
      kind: 'folder', id: 'arch', name: 'Architecture', description: 'Du transistor au cache.', color: '#ffb84d', icon: 'boxes',
      children: [lesson('cache', 'Hiérarchie de caches', 'Pourquoi la mémoire est organisée en étages.', '#ffb84d', 'memory')],
    },
  ],
}

export function findNode(path: string[]): FolderNode[] {
  const chain: FolderNode[] = [catalog]
  for (const id of path) {
    const next = chain[chain.length - 1].children.find((c) => c.id === id && c.kind === 'folder') as FolderNode | undefined
    if (!next) break
    chain.push(next)
  }
  return chain
}

export function flatten(node: FolderNode = catalog, trail: string[] = []): { node: Node; trail: string[] }[] {
  return node.children.flatMap((c) => [
    { node: c, trail },
    ...(c.kind === 'folder' ? flatten(c, [...trail, c.name]) : []),
  ])
}

export function findLessonPath(lessonId: string, node: FolderNode = catalog, path: string[] = []): { path: string[]; node: LessonNode } | null {
  for (const c of node.children) {
    if (c.kind === 'lesson' && c.lessonId === lessonId) return { path, node: c }
    if (c.kind === 'folder') {
      const r = findLessonPath(lessonId, c, [...path, c.id])
      if (r) return r
    }
  }
  return null
}

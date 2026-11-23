import { lazy } from 'react'
import type { Lesson } from '../types'
import { LEXICON } from './lexicon'
import { scenes } from './scenes'

// Le laboratoire est chargé à la demande : première ouverture du mode Exploration
const Explore = lazy(() => import('./Explore').then((m) => ({ default: m.Explore })))

export const memoryLesson: Lesson = {
  id: 'memory',
  title: 'Allocation et fragmentation de la mémoire',
  subtitle: 'Partitions fixes et variables, fragmentation, compactage et stratégies d’allocation.',
  scenes,
  Explore,
  lexicon: LEXICON,
}

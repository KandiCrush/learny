import { lazy } from 'react'
import type { Lesson } from '../types'
import { LEXICON } from './lexicon'
import { scenes } from './scenes'

// La simulation est chargée à la demande : première ouverture du mode Exploration
const Explore = lazy(() => import('./Explore').then((m) => ({ default: m.Explore })))

export const lifecycleLesson: Lesson = {
  id: 'lifecycle',
  title: 'Cycle de vie d’un processus',
  subtitle: 'Prêt, Élu, Bloqué : comment un processus partage le processeur avec les autres.',
  scenes,
  Explore,
  lexicon: LEXICON,
}

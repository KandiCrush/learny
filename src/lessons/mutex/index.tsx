import { lazy } from 'react'
import type { Lesson } from '../types'
import { LEXICON } from './lexicon'
import { scenes } from './scenes'

// Le laboratoire est chargé à la demande : première ouverture du mode Exploration
const Explore = lazy(() => import('./Explore').then((m) => ({ default: m.Explore })))

export const mutexLesson: Lesson = {
  id: 'mutex',
  title: 'Exclusion mutuelle, attente active, verrous et sémaphores',
  subtitle: 'Protéger une ressource partagée : spinlock, mutex, sémaphores binaire et de comptage.',
  scenes,
  Explore,
  lexicon: LEXICON,
}

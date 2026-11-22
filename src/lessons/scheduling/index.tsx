import { lazy } from 'react'
import type { Lesson } from '../types'
import { scenes } from './scenes'

// La simulation est chargée à la demande : première ouverture du mode Exploration
const Explore = lazy(() => import('./Explore').then((m) => ({ default: m.Explore })))

export const schedulingLesson: Lesson = {
  id: 'scheduling',
  title: 'Ordonnancement des processus',
  subtitle: 'FCFS, SJF et Round Robin : qui passe sur le processeur, et pourquoi ?',
  scenes,
  Explore,
}

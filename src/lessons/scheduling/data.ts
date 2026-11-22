import { computeSchedule, makeProcs } from '../../lib/scheduling'

/** Jeu de processus utilisé par les scènes d'explication (tous arrivent à t = 0) */
export const DEMO_PROCS = makeProcs([8, 3, 5, 2])
export const DEMO_Q = 3

export const fcfs = computeSchedule('fcfs', DEMO_PROCS)
export const sjf = computeSchedule('sjf', DEMO_PROCS)
export const rr = computeSchedule('rr', DEMO_PROCS, DEMO_Q)
export const rr1 = computeSchedule('rr', DEMO_PROCS, 1)
export const rr8 = computeSchedule('rr', DEMO_PROCS, 8)

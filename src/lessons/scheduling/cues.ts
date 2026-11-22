import type { Clock } from '../../lib/clock'
import type { Schedule } from '../../lib/scheduling'
import type { SoundCue } from '../types'

/**
 * Effets sonores déduits du calcul d'ordonnancement (donc toujours fidèles à l'animation) :
 *  - `enter`  : un processus entre dans le processeur (≈ la fin de son déplacement)
 *  - `done`   : un processus a terminé son exécution
 *  - `move`   : première préemption (Round Robin) ou tri de la file (SJF)
 * On ne sonorise que ces événements, pas chaque déplacement.
 */
export function scheduleCues(sch: Schedule, clock: Clock, opts: { sort?: boolean; firstPreemption?: boolean } = {}): SoundCue[] {
  const cues: SoundCue[] = []
  const lastSlice = new Map<number, number>()
  sch.slices.forEach((s, i) => lastSlice.set(s.pid, i))

  if (opts.sort) cues.push({ at: clock.progress(-0.9), sound: 'move', gain: 0.8 }) // le tri a lieu avant t = 0 (voir SchedulerMachine)
  let preempted = false
  sch.slices.forEach((s, i) => {
    cues.push({ at: clock.progress(s.start + 0.35), sound: 'enter', gain: i === 0 ? 0.8 : 0.55 })
    const finished = lastSlice.get(s.pid) === i
    if (finished) cues.push({ at: clock.progress(s.end + 0.1), sound: 'done', gain: 0.8 })
    else if (opts.firstPreemption && !preempted) { preempted = true; cues.push({ at: clock.progress(s.end + 0.05), sound: 'move', gain: 0.8 }) }
  })
  return cues
}

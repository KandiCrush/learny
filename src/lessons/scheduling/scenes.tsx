import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { GanttChart } from '../../components/GanttChart'
import { SchedulerMachine } from '../../components/SchedulerMachine'
import { type Anchors, makeClock } from '../../lib/clock'
import { clamp, easeOut } from '../../lib/math'
import { fmt, type Schedule } from '../../lib/scheduling'
import type { Scene, SoundCue } from '../types'
import { DEMO_PROCS as procs, DEMO_Q, fcfs, rr, rr1, rr8, sjf } from './data'
import { scheduleCues } from './cues'
import { audioOf, narrationOf } from './narration'
import { SYNC } from './sync.generated'

/**
 * Les scènes animées par le temps simulé (FCFS, SJF, Round Robin) suivent la VOIX :
 * `anchors` associe une expression de la narration à un instant simulé t.
 * Les bulles (`on`) et les effets sonores utilisent les mêmes expressions.
 */

function Stack({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full flex-col items-center justify-center gap-3 sm:gap-5">{children}</div>
}

function Stats({ sch, show }: { sch: Schedule; show: number }) {
  const o = easeOut(clamp(show))
  const m = sch.metrics
  const items = [
    ['Attente moyenne', fmt(m.avgWaiting)],
    ['Réponse moyenne', fmt(m.avgResponse)],
    ['Changements de contexte', String(m.switches)],
  ]
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3" style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
      {items.map(([k, v]) => (
        <div key={k} className="chip">
          <span className="text-white/55">{k}</span>
          <b className="font-mono text-white">{v}</b>
        </div>
      ))}
    </div>
  )
}

/** Scène de simulation : machine + Gantt + bilan, pilotés par l'horloge calée sur la voix */
function Algorithm({ sch, anchors, statsOn, progress, at }: { sch: Schedule; anchors: Anchors; statsOn: string; progress: number; at: (p: string) => number | null }) {
  const clock = makeClock(anchors, at, -1, sch.total)
  const t = clock.t(progress)
  const s = at(statsOn) ?? 0.9
  return (
    <Stack>
      <SchedulerMachine procs={procs} schedule={sch} t={t} className="min-h-0 w-full flex-1" />
      <GanttChart procs={procs} schedule={sch} t={t} className="w-full max-h-[22%] shrink-0" />
      <Stats sch={sch} show={(progress - s) / 0.04} />
    </Stack>
  )
}

const mFcfs = fcfs.metrics, mSjf = sjf.metrics, mRr = rr.metrics
const T = 18 // durée simulée de la démo

/** Scène 1 : durée d'apparition des processus = jusqu'à la fin de la 1re phrase de la voix */
const INTRO_REVEAL = (at: (p: string) => number | null) => at('Dans un ordinateur') ?? 0.22
/** Début du fondu du diagramme de Gantt = quand la voix dit « Cette décision » (légèrement avant) */
const INTRO_GANTT = (at: (p: string) => number | null) => (at('Cette décision') ?? 0.8) - 0.02

/* ------------------------------------------------------------------ */
/* 1 — Introduction                                                    */
/* ------------------------------------------------------------------ */
const intro: Scene = {
  id: 'intro',
  title: 'Un processeur, plusieurs candidats',
  duration: 14, // durée provisoire : remplacée par celle du MP3 dès qu'il est chargé
  audioSrc: audioOf('intro'),
  sync: SYNC.intro, // repères mesurés : python3 scripts/calibrate-sync.py
  narration: narrationOf('intro'),
  // Effets sonores — seulement les moments qui aident à comprendre.
  // L'animation d'apparition dure jusqu'à la fin de la 1re phrase (« …clients pressés. »), puis
  // le diagramme se dévoile quand la voix dit « Cette décision » : tout est donc lié à la voix.
  cues: (at) => {
    const r = INTRO_REVEAL(at)
    const g = INTRO_GANTT(at)
    return [
      { at: r * 0.05, sound: 'appear', pitch: 0 }, // P1 apparaît
      { at: r * 0.133, sound: 'appear', pitch: 1 }, // P2
      { at: r * 0.25, sound: 'appear', pitch: 2 }, // P3
      { at: r * 0.367, sound: 'appear', pitch: 3 }, // P4 : la gamme monte, « quatre processus »
      { at: r * 0.5, sound: 'enter', gain: 0.8 }, // le processeur s'allume
      { on: 'Un seul peut', sound: 'enter', gain: 0.55 }, // « un seul » : on rappelle le CPU unique
      { at: g + 0.01, sound: 'move', gain: 0.8 }, // le diagramme de Gantt se dévoile
    ]
  },
  beats: [
    { at: 0, text: '4 processus sont prêts à s’exécuter' },
    { at: 0.38, on: 'Un seul peut', text: 'Mais il n’y a qu’un seul processeur' },
    { at: 0.68, on: 'Cette décision', text: 'L’ordonnanceur décide qui passe, quand, et pour combien de temps' },
  ],
  render: ({ progress, at }) => (
    <Stack>
      <SchedulerMachine procs={procs} schedule={fcfs} t={-1} reveal={clamp(progress / INTRO_REVEAL(at))} className="min-h-0 w-full flex-1" />
      <div style={{ opacity: easeOut(clamp((progress - INTRO_GANTT(at)) / 0.1)) }} className="w-full max-h-[22%]">
        <GanttChart procs={procs} schedule={fcfs} t={0} className="w-full" label="Diagramme de Gantt" sublabel="se remplira au fil de l’exécution" />
      </div>
    </Stack>
  ),
}

/* ------------------------------------------------------------------ */
/* 2 — FCFS                                                            */
/* ------------------------------------------------------------------ */
const FCFS_A: Anchors = [
  ['P1 prend', 0],
  ['Quand P1 termine', 8],
  ['Puis vient P3', 11],
  ['Et enfin P4', 16],
  ["Voici l'effet", 18],
]
const fcfsScene: Scene = {
  id: 'fcfs',
  title: 'FCFS — premier arrivé, premier servi',
  duration: 34,
  audioSrc: audioOf('fcfs'),
  sync: SYNC.fcfs,
  narration: narrationOf('fcfs'),
  beats: [
    { on: 'Premier algorithme', text: 'La file est servie dans l’ordre d’arrivée' },
    { on: 'P1 prend', text: 'P1 garde le CPU jusqu’au bout : personne ne peut le doubler' },
    { on: 'Quand P1 termine', text: 'P2 n’a besoin que de 3… mais il a attendu 8 unités' },
    { on: "Voici l'effet", text: 'Effet de convoi : les petits processus sont coincés derrière un gros' },
    { on: "Ici, l'attente", text: `Attente moyenne : ${fmt(mFcfs.avgWaiting)} unités` },
  ],
  cues: (at) => scheduleCues(fcfs, makeClock(FCFS_A, at, -1, T)),
  render: ({ progress, at }) => <Algorithm sch={fcfs} anchors={FCFS_A} statsOn="Ici, l'attente" progress={progress} at={at} />,
}

/* ------------------------------------------------------------------ */
/* 3 — SJF                                                             */
/* ------------------------------------------------------------------ */
const SJF_A: Anchors = [
  ['La file se trie', 0],
  ['Puis P2', 2],
  ['Puis P3', 5],
  ['Et P1', 10],
  ['Résultat', 18],
]
const sjfScene: Scene = {
  id: 'sjf',
  title: 'SJF — le plus court d’abord',
  duration: 32,
  audioSrc: audioOf('sjf'),
  sync: SYNC.sjf,
  narration: narrationOf('sjf'),
  beats: [
    { on: 'Deuxième algorithme', text: 'SJF choisit toujours le plus court travail' },
    { on: 'La file se trie', text: 'La file est triée : le plus court se place devant' },
    { on: 'Puis P2', text: 'P2 (3) passe avant P3 (5) et P1 (8)' },
    { on: 'Dans la version', text: 'Non préemptif : une fois lancé, un processus va jusqu’au bout' },
    { on: 'Résultat', text: `Attente moyenne : ${fmt(mSjf.avgWaiting)} — presque deux fois mieux que FCFS` },
    { on: 'Mais attention', text: 'Le gros P1 passe en dernier — risque de famine' },
  ],
  cues: (at) => scheduleCues(sjf, makeClock(SJF_A, at, -1, T), { sort: true }),
  render: ({ progress, at }) => <Algorithm sch={sjf} anchors={SJF_A} statsOn="Résultat" progress={progress} at={at} />,
}

/* ------------------------------------------------------------------ */
/* 4 — Round Robin                                                     */
/* ------------------------------------------------------------------ */
const RR_A: Anchors = [
  ["P1 s'exécute", 0],
  ['il est interrompu', 3],
  ['puis P3', 6],
  ["P4 n'a besoin", 9],
  ['Ensuite', 11],
  ["Personne n'attend", 18],
]
const rrScene: Scene = {
  id: 'rr',
  title: 'Round Robin — le tourniquet',
  duration: 36,
  audioSrc: audioOf('rr'),
  sync: SYNC.rr,
  narration: narrationOf('rr'),
  beats: [
    { on: 'Chaque processus', text: `Chaque processus reçoit au plus ${DEMO_Q} unités de CPU (le quantum)` },
    { on: 'il est interrompu', text: 'Quantum écoulé : P1 est interrompu et repart en fin de file' },
    { on: "P4 n'a besoin", text: 'P4 n’avait besoin que de 2 : il rend le CPU avant la fin de son quantum' },
    { on: 'Ensuite', text: 'Les restes de P1 et P3 repassent à tour de rôle' },
    { on: "Personne n'attend", text: `Réponse moyenne : ${fmt(mRr.avgResponse)} contre ${fmt(mFcfs.avgResponse)} en FCFS` },
  ],
  cues: (at) => scheduleCues(rr, makeClock(RR_A, at, -1, T), { firstPreemption: true }),
  render: ({ progress, at }) => <Algorithm sch={rr} anchors={RR_A} statsOn="Personne n'attend" progress={progress} at={at} />,
}

/* ------------------------------------------------------------------ */
/* 5 — Le quantum : trois diagrammes révélés l'un après l'autre         */
/* ------------------------------------------------------------------ */
const Q_STARTS = ['Avec un quantum de 1', 'Avec un quantum de 3', 'Avec un quantum de 8', 'Un bon quantum']
const quantumScene: Scene = {
  id: 'quantum',
  title: 'Le quantum, un réglage délicat',
  duration: 30,
  audioSrc: audioOf('quantum'),
  sync: SYNC.quantum,
  narration: narrationOf('quantum'),
  beats: [
    { on: 'Le quantum', text: 'Même processus, trois quanta différents' },
    { on: 'Avec un quantum de 1', text: `q = 1 : ${rr1.metrics.switches} changements de contexte — le CPU passe son temps à jongler` },
    { on: 'Avec un quantum de 3', text: `q = ${DEMO_Q} : ${rr.metrics.switches} changements, un bon équilibre` },
    { on: 'Avec un quantum de 8', text: 'q = 8 : plus aucune interruption, on retombe sur FCFS' },
    { on: 'Un bon quantum', text: 'Un bon quantum se trouve entre les deux' },
  ],
  cues: (at) => Q_STARTS.slice(0, 3).map((p, i): SoundCue => ({ at: at(p) ?? 0.1 + i * 0.25, sound: 'appear', pitch: [0, 2, 4][i], gain: 0.9 })),
  render: ({ progress, at }) => {
    const rows: [string, Schedule][] = [['q = 1', rr1], [`q = ${DEMO_Q}`, rr], ['q = 8', rr8]]
    const end = at('Un bon quantum') ?? 0.9
    const o = easeOut(clamp((progress - end) / 0.05))
    return (
      <div className="flex h-full w-full flex-col justify-center gap-4 sm:gap-6">
        {rows.map(([lab, s], i) => {
          const clock = makeClock([[Q_STARTS[i], 0], [Q_STARTS[i + 1], T]], at, 0, T)
          return (
            <div key={lab} className="grid items-center gap-x-4 rounded-2xl border border-white/10 bg-white/[.03] px-3 py-2 sm:px-4 md:grid-cols-[110px_minmax(0,1fr)]">
              <div><div className="text-[13px] font-semibold">Round Robin</div><div className="font-mono text-[15px] text-[var(--mint)]">{lab}</div><div className="mt-0.5 text-[11px] text-white/45">{s.metrics.switches} changements de contexte</div></div>
              <GanttChart procs={procs} schedule={s} t={clock.t(progress)} scaleTotal={T} compact className="w-full" />
            </div>
          )
        })}
        <p className="text-center text-sm text-white/55" style={{ opacity: o }}>Plus il y a de changements de contexte, plus le système perd de temps utile.</p>
      </div>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 6 — Comparaison                                                     */
/* ------------------------------------------------------------------ */
const compareScene: Scene = {
  id: 'compare',
  title: 'Comparer les trois approches',
  duration: 30,
  audioSrc: audioOf('compare'),
  sync: SYNC.compare,
  narration: narrationOf('compare'),
  beats: [
    { on: 'Comparons', text: 'Mêmes processus, trois façons de les servir' },
    { on: 'SJF obtient', text: 'SJF minimise l’attente moyenne' },
    { on: 'Round Robin offre', text: 'Round Robin offre la meilleure réactivité' },
    { on: "FCFS reste", text: 'FCFS : simple, mais sensible au convoi' },
    { on: 'Aucun algorithme', text: 'Aucun algorithme n’est le meilleur partout' },
  ],
  cues: (at) => [
    { at: (at('SJF obtient') ?? 0.2) + 0.07, sound: 'done', gain: 0.8 }, // le meilleur est mis en évidence
    { at: (at('Round Robin offre') ?? 0.4) + 0.02, sound: 'appear', pitch: 3, gain: 0.9 },
    { at: at('À vous de jouer') ?? 0.9, sound: 'appear', pitch: 5, gain: 0.9 }, // l'invitation à explorer
  ],
  render: ({ progress, at, actions }) => {
    const rows = [
      { name: 'FCFS', s: fcfs },
      { name: 'SJF', s: sjf },
      { name: 'Round Robin', s: rr },
    ]
    const clock = makeClock([['Comparons', 0], ['Round Robin offre', T]], at, 0, T)
    const t = clock.t(progress)
    const growAt = at('SJF obtient') ?? 0.4
    const grow = easeOut(clamp((progress - growAt) / 0.1))
    const maxW = Math.max(...rows.map((r) => r.s.metrics.avgWaiting))
    const maxR = Math.max(...rows.map((r) => r.s.metrics.avgResponse))
    const bestW = Math.min(...rows.map((r) => r.s.metrics.avgWaiting))
    const bestR = Math.min(...rows.map((r) => r.s.metrics.avgResponse))
    const cta = easeOut(clamp((progress - (at('À vous de jouer') ?? 0.88)) / 0.06))
    return (
      <div className="flex h-full w-full flex-col justify-center gap-2.5 sm:gap-3">
        {rows.map(({ name, s }) => {
          const m = s.metrics
          return (
            <div key={name} className="grid items-center gap-x-5 gap-y-1 rounded-2xl border border-white/10 bg-white/[.03] px-3 py-2 sm:px-4 md:grid-cols-[84px_minmax(0,1fr)_230px]">
              <div className="text-[13px] font-semibold text-white">{name}</div>
              <GanttChart procs={procs} schedule={s} t={t} scaleTotal={T} compact className="w-full" />
              <div className="space-y-2.5 font-mono text-[11.5px]">
                {([['Attente moy.', m.avgWaiting, maxW, bestW], ['Réponse moy.', m.avgResponse, maxR, bestR]] as const).map(([k, v, mx, best]) => (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-white/55"><span>{k}</span><b className={v === best && grow > 0.9 ? 'text-[var(--mint)]' : 'text-white'}>{fmt(v)}</b></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full" style={{ width: `${(v / mx) * 100 * grow}%`, background: v === best ? 'var(--mint)' : 'linear-gradient(90deg,#8b7bff,#a78bfa)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div className="flex justify-center" style={{ opacity: cta, transform: `translateY(${(1 - cta) * 10}px)`, pointerEvents: cta > 0.5 ? 'auto' : 'none' }}>
          <button onClick={actions.goExplore} className="btn-primary">
            Essayer en mode Exploration <ArrowRight size={18} />
          </button>
        </div>
      </div>
    )
  },
}

export const scenes: Scene[] = [intro, fcfsScene, sjfScene, rrScene, quantumScene, compareScene]

import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { GanttChart } from '../../components/GanttChart'
import { SchedulerMachine } from '../../components/SchedulerMachine'
import { clamp, easeOut } from '../../lib/math'
import { fmt, type Schedule } from '../../lib/scheduling'
import type { Scene } from '../types'
import { DEMO_PROCS as procs, DEMO_Q, fcfs, rr, rr1, rr8, sjf } from './data'

/** Temps simulé : la simulation occupe les 88 % de la scène, le reste sert à lire le bilan */
const RUN = 0.88
const tOf = (progress: number, total: number) => clamp(progress / RUN) * total
const at = (t: number, total: number) => (t / total) * RUN

function Stack({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full flex-col items-center justify-center gap-3 sm:gap-5">{children}</div>
}

function Stats({ sch, progress }: { sch: Schedule; progress: number }) {
  const o = easeOut(clamp((progress - RUN) / 0.08))
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

function Algorithm({ sch, progress }: { sch: Schedule; progress: number }) {
  const t = tOf(progress, sch.total)
  return (
    <Stack>
      <SchedulerMachine procs={procs} schedule={sch} t={t} className="min-h-0 w-full flex-1" />
      <GanttChart procs={procs} schedule={sch} t={t} className="w-full max-h-[22%] shrink-0" />
      <Stats sch={sch} progress={progress} />
    </Stack>
  )
}

const mFcfs = fcfs.metrics, mSjf = sjf.metrics, mRr = rr.metrics

/* ------------------------------------------------------------------ */

const intro: Scene = {
  id: 'intro',
  title: 'Un processeur, plusieurs candidats',
  duration: 14,
  narration:
    "Imaginez un seul guichet et quatre clients pressés. Dans un ordinateur, le guichet, c'est le processeur ; les clients, ce sont les processus. Un seul peut être servi à la fois : il faut donc décider de l'ordre. Cette décision, c'est le travail de l'ordonnanceur.",
  beats: [
    { at: 0, text: '4 processus sont prêts à s’exécuter' },
    { at: 0.38, text: 'Mais il n’y a qu’un seul processeur' },
    { at: 0.68, text: 'L’ordonnanceur décide qui passe, quand, et pour combien de temps' },
  ],
  render: ({ progress }) => (
    <Stack>
      <SchedulerMachine procs={procs} schedule={fcfs} t={-1} reveal={clamp(progress / 0.5)} className="min-h-0 w-full flex-1" />
      <div style={{ opacity: easeOut(clamp((progress - 0.65) / 0.2)) }} className="w-full max-h-[22%]">
        <GanttChart procs={procs} schedule={fcfs} t={0} className="w-full" label="Diagramme de Gantt" sublabel="se remplira au fil de l’exécution" />
      </div>
    </Stack>
  ),
}

const fcfsScene: Scene = {
  id: 'fcfs',
  title: 'FCFS — premier arrivé, premier servi',
  duration: 26,
  narration:
    "Premier algorithme : FCFS, premier arrivé, premier servi. C'est la file d'attente de la boulangerie : on passe dans l'ordre. P1 prend le processeur et le garde pendant huit unités. Pendant ce temps, P2, qui n'a besoin que de trois unités, patiente. Quand P1 termine, P2 passe, puis P3 et P4. Simple en apparence, mais un long processus au début retarde tous les autres : c'est l'effet de convoi.",
  beats: [
    { at: 0, text: 'La file est servie dans l’ordre d’arrivée' },
    { at: at(1.4, fcfs.total), text: 'P1 garde le CPU jusqu’au bout : personne ne peut le doubler' },
    { at: at(8.6, fcfs.total), text: 'P2 n’a besoin que de 3… mais il a attendu 8 unités' },
    { at: at(16.5, fcfs.total), text: 'Effet de convoi : les petits processus sont coincés derrière un gros' },
    { at: RUN + 0.02, text: `Attente moyenne : ${fmt(mFcfs.avgWaiting)} unités` },
  ],
  render: ({ progress }) => <Algorithm sch={fcfs} progress={progress} />,
}

const sjfScene: Scene = {
  id: 'sjf',
  title: 'SJF — le plus court d’abord',
  duration: 24,
  narration:
    "Deuxième algorithme : SJF, le plus court d'abord. L'ordonnanceur regarde la durée de chaque processus et choisit toujours le plus court. P4 passe en premier, puis P2, P3 et enfin P1, le plus long. Dans la version non préemptive, un processus lancé n'est jamais interrompu. Résultat : l'attente moyenne chute fortement. Mais attention, un gros processus peut attendre très longtemps : c'est la famine.",
  beats: [
    { at: 0, text: 'La file est triée : le plus court se place devant' },
    { at: at(2.3, sjf.total), text: 'P4 (2) a filé ; P2 (3) passe avant P3 (5) et P1 (8)' },
    { at: at(5.5, sjf.total), text: 'Non préemptif : une fois lancé, un processus va jusqu’au bout' },
    { at: at(11, sjf.total), text: 'Le gros P1 passe en dernier — risque de famine' },
    { at: RUN + 0.02, text: `Attente moyenne : ${fmt(mSjf.avgWaiting)} — presque deux fois mieux que FCFS` },
  ],
  render: ({ progress }) => <Algorithm sch={sjf} progress={progress} />,
}

const rrScene: Scene = {
  id: 'rr',
  title: 'Round Robin — le tourniquet',
  duration: 28,
  narration:
    "Troisième algorithme : Round Robin, le tourniquet. Chaque processus reçoit le processeur pour un quantum de trois unités au maximum. Si le travail n'est pas terminé, il est interrompu et replacé à la fin de la file. P1 s'exécute trois unités, puis cède sa place. P4 n'a besoin que de deux unités : il rend le processeur plus tôt. Personne n'attend longtemps avant de démarrer, ce qui rend le système très réactif.",
  beats: [
    { at: 0, text: `Chaque processus reçoit au plus ${DEMO_Q} unités de CPU (le quantum)` },
    { at: at(3.5, rr.total), text: 'Quantum écoulé : P1 est interrompu et repart en fin de file' },
    { at: at(9.6, rr.total), text: 'P4 n’avait besoin que de 2 : il rend le CPU avant la fin de son quantum' },
    { at: at(12, rr.total), text: 'Les restes de P1 et P3 repassent à tour de rôle' },
    { at: RUN + 0.02, text: `Réponse moyenne : ${fmt(mRr.avgResponse)} contre ${fmt(mFcfs.avgResponse)} en FCFS` },
  ],
  render: ({ progress }) => <Algorithm sch={rr} progress={progress} />,
}

const quantumScene: Scene = {
  id: 'quantum',
  title: 'Le quantum, un réglage délicat',
  duration: 22,
  narration:
    "Le quantum est un réglage délicat. Avec un quantum de une unité, les processus alternent sans cesse : le système perd beaucoup de temps à changer de contexte. Avec un quantum de huit, plus aucun processus n'est interrompu et Round Robin se comporte comme FCFS. Un bon quantum se situe entre les deux.",
  beats: [
    { at: 0, text: 'Même processus, trois quanta différents' },
    { at: 0.2, text: `q = 1 : ${rr1.metrics.switches} changements de contexte — le CPU passe son temps à jongler` },
    { at: 0.55, text: 'q = 8 : plus aucune interruption, on retombe sur FCFS' },
    { at: RUN + 0.02, text: 'Un bon quantum se trouve entre les deux' },
  ],
  render: ({ progress }) => {
    const rows: [string, Schedule][] = [
      ['q = 1', rr1],
      [`q = ${DEMO_Q}`, rr],
      ['q = 8', rr8],
    ]
    const T = rr.total
    const t = tOf(progress, T)
    const o = easeOut(clamp((progress - RUN) / 0.08))
    return (
      <div className="flex h-full w-full flex-col justify-center gap-4 sm:gap-6">
        {rows.map(([lab, s]) => (
          <div key={lab} className="grid items-center gap-x-4 rounded-2xl border border-white/10 bg-white/[.03] px-3 py-2 sm:px-4 md:grid-cols-[110px_minmax(0,1fr)]">
            <div><div className="text-[13px] font-semibold">Round Robin</div><div className="font-mono text-[15px] text-[var(--mint)]">{lab}</div><div className="mt-0.5 text-[11px] text-white/45">{s.metrics.switches} changements de contexte</div></div>
            <GanttChart procs={procs} schedule={s} t={t} scaleTotal={T} compact className="w-full" />
          </div>
        ))}
        <p className="text-center text-sm text-white/55" style={{ opacity: o }}>Plus il y a de changements de contexte, plus le système perd de temps utile.</p>
      </div>
    )
  },
}

const compareScene: Scene = {
  id: 'compare',
  title: 'Comparer les trois approches',
  duration: 24,
  narration:
    "Comparons les trois approches. SJF obtient la plus faible attente moyenne. Round Robin offre le meilleur temps de réponse. FCFS reste le plus simple, mais il est sensible à l'effet de convoi. Aucun algorithme n'est le meilleur partout : tout dépend de ce que l'on cherche à optimiser. À vous de jouer : passez en mode Exploration pour modifier les durées et le quantum.",
  beats: [
    { at: 0, text: 'Mêmes processus, trois façons de les servir' },
    { at: 0.45, text: 'SJF minimise l’attente moyenne' },
    { at: 0.62, text: 'Round Robin offre la meilleure réactivité' },
    { at: 0.8, text: 'Aucun algorithme n’est le meilleur partout' },
  ],
  render: ({ progress, actions }) => {
    const rows = [
      { name: 'FCFS', s: fcfs, tone: 'text-white/80' },
      { name: 'SJF', s: sjf, tone: '' },
      { name: 'Round Robin', s: rr, tone: '' },
    ]
    const T = 18
    const t = clamp(progress / 0.45) * T
    const grow = easeOut(clamp((progress - 0.4) / 0.3))
    const maxW = Math.max(...rows.map((r) => r.s.metrics.avgWaiting))
    const maxR = Math.max(...rows.map((r) => r.s.metrics.avgResponse))
    const bestW = Math.min(...rows.map((r) => r.s.metrics.avgWaiting))
    const bestR = Math.min(...rows.map((r) => r.s.metrics.avgResponse))
    const cta = easeOut(clamp((progress - 0.88) / 0.08))
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

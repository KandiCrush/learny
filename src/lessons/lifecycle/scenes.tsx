import { ArrowRight, Eye, FileText, Globe, Mail, Music } from 'lucide-react'
import { LifecycleStage, STATE_COLOR, placePose, mixPose, type StageToken } from '../../components/LifecycleStage'
import { StateDiagram } from '../../components/StateDiagram'
import type { PhraseAt } from '../../lib/clock'
import { clamp, easeOut } from '../../lib/math'
import { reducedMotion } from '../../lib/motion'
import { estimateSeconds } from '../../lib/narration'
import type { Scene, SceneAudio, SoundCue } from '../types'
import { type Actor, type Layout, buildTokens, resolveFrames } from './frames'
import { AUDIO_URL, type SceneKey, narrationOf } from './narration'
import { ProgramVsProcess } from './ProgramVsProcess'
import { FILE_DURATION, SEGMENTS, SYNC } from './sync.generated'

/**
 * Les scènes sont des fonctions pures de `progress`. Tout ce qui est synchronisé s'exprime par une EXPRESSION
 * de la narration (`at('Première transition')`) : quand le MP3 existera, la calibration recalera tout seule
 * (python3 scripts/calibrate-sync.py --lesson=lifecycle). Aucune expression n'est écrite en secondes ou en pourcentage,
 * sauf de petits délais APRÈS une expression (jamais avant : l'image ne devance pas la voix).
 */
const audio = (k: SceneKey): SceneAudio | undefined => {
  const seg = SEGMENTS[k]
  return seg ? { src: AUDIO_URL, from: seg.from, to: seg.to, fileDuration: FILE_DURATION ?? undefined } : undefined
}
/** Durée provisoire (aucun MP3 encore) : le temps de lecture estimé de la narration */
const dur = (k: SceneKey) => estimateSeconds(narrationOf(k))

/** Effet sonore à une expression (ignoré si l'expression n'existe pas) */
const cue = (at: PhraseAt, on: string, offsetSec: number, sound: SoundCue['sound'], extra: Partial<SoundCue> = {}): SoundCue[] => {
  const p = at(on, offsetSec)
  return p == null ? [] : [{ at: p, sound, ...extra }]
}
/** Apparition progressive (0 → 1) à partir d'une expression */
const fade = (progress: number, at: PhraseAt, on: string, offsetSec = 0, lenSec = 0.8) => {
  const a = at(on, offsetSec), b = at(on, offsetSec + lenSec)
  if (a == null || b == null) return 0
  return easeOut(clamp((progress - a) / Math.max(1e-4, b - a)))
}

const NAV: Actor = { id: 'nav', name: 'Navigateur', glyph: Globe, color: '#ffb84d' }
const MUS: Actor = { id: 'mus', name: 'Musique', glyph: Music, color: '#f472b6' }
const EDI: Actor = { id: 'edi', name: 'Éditeur', glyph: FileText, color: '#a78bfa' }
const MAIL: Actor = { id: 'mail', name: 'Messagerie', glyph: Mail, color: '#c4f06b' }

function Pill({ x, y, w: minW, text, color, o = 1, icon }: { x: number; y: number; w: number; text: string; color: string; o?: number; icon?: boolean }) {
  const w = Math.max(minW, text.length * 9.2 + (icon ? 56 : 36)) // largeur adaptée au texte
  return (
    <g transform={`translate(${x} ${y + (1 - o) * 8})`} opacity={o}>
      <rect x={-w / 2} y={-15} width={w} height={30} rx={15} fill="#12142a" stroke={color} strokeOpacity=".8" />
      {icon && <Eye x={-w / 2 + 12} y={-8} width={16} height={16} color={color} />}
      <text x={icon ? 8 : 0} y={4.5} textAnchor="middle" fontSize="11.5" letterSpacing="1.4" fontWeight="600" fontFamily="Geist Mono, monospace" fill={color}>{text}</text>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* 1 — Qu'est-ce qu'un processus ?                                     */
/* ------------------------------------------------------------------ */
const what: Scene = {
  id: 'what',
  title: 'Programme ou processus ?',
  duration: dur('what'),
  audio: audio('what'),
  sync: SYNC.what,
  narration: narrationOf('what'),
  beats: [
    { on: 'Sur votre disque', text: 'Un programme est un fichier : des instructions écrites sur le disque' },
    { on: 'Il ne fait rien', text: 'Programme = passif. Il n’utilise ni mémoire, ni processeur' },
    { on: 'Double-cliquez', text: 'Au lancement, le système charge le programme en mémoire' },
    { on: 'Un processus est', text: 'Processus = programme en cours d’exécution' },
    { on: 'Lancez-le', text: 'Un programme, deux processus : chacun avance à son rythme' },
    { on: "Le programme, c'est", text: 'Recette (programme) ≠ cuisinier au travail (processus)' },
  ],
  cues: (at) => [
    ...cue(at, 'Sur votre disque', 0.4, 'appear', { pitch: 0 }),
    ...cue(at, 'Double-cliquez', 0.5, 'move', { gain: 0.8 }),
    ...cue(at, 'Un processus est', 0.2, 'enter', { gain: 0.8 }),
    ...cue(at, 'Lancez-le', 0.6, 'appear', { pitch: 3, gain: 0.9 }),
  ],
  render: ({ progress, at }) => (
    <div className="flex h-full w-full items-center justify-center"><ProgramVsProcess progress={progress} at={at} /></div>
  ),
}

/* ------------------------------------------------------------------ */
/* 2 — Pourquoi plusieurs états ?                                      */
/* ------------------------------------------------------------------ */
const WHY_ACTORS = [NAV, MUS, EDI, MAIL]
const WHY_INIT: Layout = {}
const WHY_FRAMES = [
  { on: 'Votre ordinateur', delay: 0.3, len: 1.4, layout: { nav: { zone: 'free', x: 120, y: 150 }, mus: { zone: 'free', x: 270, y: 300 }, edi: { zone: 'free', x: 430, y: 130 }, mail: { zone: 'free', x: 560, y: 320 } } as Layout },
  { on: 'Tous veulent', delay: 0.2, len: 1.6, layout: { nav: { zone: 'free', x: 630, y: 62 }, mus: { zone: 'free', x: 630, y: 206 }, edi: { zone: 'free', x: 925, y: 62 }, mail: { zone: 'free', x: 925, y: 206 } } as Layout },
  { on: 'ne peut exécuter', delay: 0.4, layout: { nav: { zone: 'cpu' } } as Layout },
  { on: 'Certains sont prêts', delay: 1.2, len: 1.3, layout: { mus: { zone: 'queue', i: 0 }, edi: { zone: 'queue', i: 1 } } as Layout },
  { on: 'Et un autre', delay: 0.5, len: 1.3, layout: { mail: { zone: 'blocked', i: 0 } } as Layout },
]

const why: Scene = {
  id: 'why',
  title: 'Un seul CPU, plusieurs candidats',
  duration: dur('why'),
  audio: audio('why'),
  sync: SYNC.why,
  narration: narrationOf('why'),
  beats: [
    { on: 'Votre ordinateur', text: 'Quatre processus actifs sur la même machine' },
    { on: 'Tous veulent', text: 'Tous réclament le processeur en même temps' },
    { on: 'Mais un processeur', text: 'Un seul cœur : un seul processus exécuté à la fois' },
    { on: 'Certains sont prêts', text: 'Prêt : tout est là, il ne manque que le processeur' },
    { on: 'Un seul utilise', text: 'Élu : c’est lui qui calcule, maintenant' },
    { on: 'Et un autre', text: 'Bloqué : il attend une donnée (ici, le réseau)' },
    { on: 'Trois états', text: 'Trois situations → trois états' },
  ],
  cues: (at) => [
    ...[0, 1, 2, 3].flatMap((i) => cue(at, 'Votre ordinateur', 0.5 + i * 0.25, 'appear', { pitch: i, gain: 0.8 })),
    ...cue(at, 'Tous veulent', 0.4, 'enter', { gain: 0.55 }),
    ...cue(at, 'ne peut exécuter', 1.2, 'enter', { gain: 0.85 }),
    ...cue(at, 'Certains sont prêts', 1.9, 'move', { gain: 0.7 }),
    ...cue(at, 'Et un autre', 1.3, 'move', { gain: 0.7 }),
  ],
  render: ({ progress, at }) => {
    const frames = resolveFrames(WHY_FRAMES, at)
    const appear = (i: number) => fade(progress, at, 'Votre ordinateur', 0.3 + i * 0.25, 0.7)
    const showState = (progress >= (at('Certains sont prêts') ?? 2))
    const tokens = buildTokens(WHY_ACTORS, WHY_INIT, frames, progress, {
      showState,
      extra: (id, p) => {
        const i = WHY_ACTORS.findIndex((a) => a.id === id)
        // avant son apparition, un jeton est invisible ; ensuite il suit ses déplacements
        const o = p.zone === 'off' ? appear(i) : Math.min(p.pose.o, appear(i) * 1)
        return { pose: { ...p.pose, o, s: p.pose.s * (0.7 + 0.3 * appear(i)) } }
      },
    })
    const crowd = fade(progress, at, 'Tous veulent', 0, 0.6) * (1 - fade(progress, at, 'ne peut exécuter', 0.6, 0.6))
    const one = fade(progress, at, 'Mais un processeur', 0.3, 0.7)
    const cpuBusy = progress >= (at('ne peut exécuter', 1.2) ?? 2)
    return (
      <LifecycleStage
        className="h-full w-full" tokens={tokens} cpuBusy={cpuBusy} cpuColor={NAV.color}
        reveal={{ lane: fade(progress, at, 'Certains sont prêts', 0, 0.9), cpu: fade(progress, at, 'Tous veulent', 0, 0.8), blocked: fade(progress, at, 'Et un autre', 0, 0.9) }}
        focus={null}
        under={(
          <g opacity={crowd}>
            {tokens.filter((t) => t.id !== 'nav' || crowd > 0).map((t) => (
              <path key={t.id} d={`M${t.pose.x} ${t.pose.y} L${708} ${134}`} stroke="#fff" strokeOpacity=".28" strokeWidth="2" strokeDasharray="3 6" fill="none" className="flow-arrows" />
            ))}
          </g>
        )}
      >
        <Pill x={780} y={26} w={236} text="1 CŒUR = 1 PROCESSUS À LA FOIS" color={STATE_COLOR.running} o={one} />
      </LifecycleStage>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 3 — Les quatre transitions                                          */
/* ------------------------------------------------------------------ */
const TRANS_STARTS = ['Première transition', 'Deuxième', 'Troisième', 'Quatrième']
const DEST: ('running' | 'ready' | 'blocked' | 'ready')[] = ['running', 'ready', 'blocked', 'ready']

const transitions: Scene = {
  id: 'transitions',
  title: 'Les quatre transitions',
  duration: dur('transitions'),
  audio: audio('transitions'),
  sync: SYNC.transitions,
  narration: narrationOf('transitions'),
  beats: [
    { on: 'Assemblons', text: 'Trois états · quatre transitions' },
    { on: 'Première transition', text: 'Prêt → Élu : l’ordonnanceur choisit le navigateur parmi les prêts' },
    { on: 'Deuxième', text: 'Élu → Prêt : quantum écoulé, le système reprend le CPU (préemption)' },
    { on: 'Troisième', text: 'Élu → Bloqué : le navigateur attend sa page, il libère le CPU' },
    { on: 'Quatrième', text: 'Bloqué → Prêt : la page est là, retour dans la file (pas sur le CPU)' },
    { on: 'Remarquez', text: 'Bloqué → Élu n’existe pas : on passe toujours par Prêt' },
  ],
  cues: (at) => [
    ...[0, 0.6, 1.2].flatMap((o, i) => cue(at, 'Assemblons', o + 0.3, 'appear', { pitch: i, gain: 0.8 })),
    ...cue(at, 'Première transition', 1.4, 'enter', { gain: 0.8 }),
    ...cue(at, 'Deuxième', 1.4, 'move', { gain: 0.8 }),
    ...cue(at, 'Troisième', 1.4, 'move', { gain: 0.8 }),
    ...cue(at, 'Quatrième', 1.6, 'appear', { pitch: 3, gain: 0.9 }),
    ...cue(at, 'Remarquez', 0.5, 'move', { gain: 0.5 }),
  ],
  render: ({ progress, at }) => {
    const nodes: [number, number, number] = [fade(progress, at, 'Assemblons', 0.2, 0.6), fade(progress, at, 'Assemblons', 0.8, 0.6), fade(progress, at, 'Assemblons', 1.4, 0.6)]
    const edges = TRANS_STARTS.map((p) => fade(progress, at, p, 0.1, 0.6)) as [number, number, number, number]
    const labels = TRANS_STARTS.map((p) => fade(progress, at, p, 0.5, 0.6)) as [number, number, number, number]
    // transition « en cours » : la dernière dont la voix a commencé à parler ; jeton qui la parcourt
    let k = -1
    TRANS_STARTS.forEach((p, i) => { if (progress >= (at(p) ?? 9)) k = i })
    const hasEnd = progress >= (at('Remarquez') ?? 9)
    let dot: { edge: number; t: number; color: string; text: string } | null = null
    let current: 'ready' | 'running' | 'blocked' | null = k < 0 ? null : null
    if (k >= 0 && !hasEnd) {
      const a = at(TRANS_STARTS[k], 0.9), b = at(TRANS_STARTS[k], 2.6)
      if (a != null && b != null) {
        const u = clamp((progress - a) / (b - a))
        if (progress >= a) dot = { edge: k, t: easeOut(u), color: NAV.color, text: 'N' }
        if (u >= 1) current = DEST[k]
      }
    }
    return (
      <div className="relative h-full w-full">
        <StateDiagram
          className="h-full w-full" nodes={nodes} edges={edges} labels={labels}
          active={hasEnd ? null : k >= 0 ? k : null} dot={dot} current={hasEnd ? null : current}
          forbidden={fade(progress, at, 'Remarquez ce qui manque', 0.3, 0.8)}
        />
        <div className="pointer-events-none absolute left-0 top-0 flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[12px] text-white/65">
          <span className="grid h-5 w-5 place-items-center rounded-full border" style={{ borderColor: NAV.color, background: `${NAV.color}33` }}><Globe size={11} /></span>
          exemple suivi : le navigateur
        </div>
      </div>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 4 — L'ordonnanceur                                                  */
/* ------------------------------------------------------------------ */
const SCH_ACTORS = [NAV, MUS, EDI, MAIL]
const SCH_INIT: Layout = { mus: { zone: 'queue', i: 0 }, edi: { zone: 'queue', i: 1 }, mail: { zone: 'queue', i: 2 }, nav: { zone: 'blocked', i: 0 } }
const SCH_FRAMES = [
  { on: 'Ici, le premier arrivé', delay: 0.15, layout: { mus: { zone: 'cpu' }, edi: { zone: 'queue', i: 0 }, mail: { zone: 'queue', i: 1 } } as Layout },
  { on: 'Le processus réveillé', delay: 0.15, len: 1.3, layout: { nav: { zone: 'queue', i: 2 } } as Layout },
]

const scheduler: Scene = {
  id: 'scheduler',
  title: 'Le rôle de l’ordonnanceur',
  duration: dur('scheduler'),
  audio: audio('scheduler'),
  sync: SYNC.scheduler,
  narration: narrationOf('scheduler'),
  beats: [
    { on: 'Qui décide', text: 'L’ordonnanceur choisit qui utilise le CPU' },
    { on: 'Chaque fois que', text: 'CPU libre → il examine la file des prêts' },
    { on: 'Ici, le premier arrivé', text: 'Ici : premier arrivé, premier servi. Le premier de la file est élu' },
    { on: 'Attention', text: 'Prêt ≠ Élu : prêt, c’est attendre ; élu, c’est calculer' },
    { on: 'Et le processus bloqué', text: 'La page du navigateur arrive : il n’est plus bloqué…' },
    { on: "D'abord", text: '… mais le CPU est occupé par la musique' },
    { on: 'Ensuite, seul', text: 'Seul l’ordonnanceur attribue le CPU' },
    { on: 'Le processus réveillé', text: 'Bloqué → Prêt : retour dans la file, derrière les autres' },
  ],
  cues: (at) => [
    ...cue(at, 'Qui décide', 0.5, 'appear', { pitch: 2, gain: 0.7 }),
    ...cue(at, 'Ici, le premier arrivé', 0.9, 'enter', { gain: 0.85 }),
    ...cue(at, 'Quand sa page arrive', 0.6, 'appear', { pitch: 4, gain: 0.8 }),
    ...cue(at, 'il ne saute pas', 1.4, 'move', { gain: 0.5 }),
    ...cue(at, 'Le processus réveillé', 0.9, 'move', { gain: 0.8 }),
  ],
  render: ({ progress, at }) => {
    const frames = resolveFrames(SCH_FRAMES, at)
    const woke = at('Quand sa page arrive', 0.3), tryStart = at('il ne saute pas', 0.3), tryEnd = at('il ne saute pas', 1.6), back = at('Le processus réveillé', 0.1)
    const arrived = woke != null && progress >= woke
    const glow = woke == null ? 0 : easeOut(clamp((progress - woke) / 0.05)) * (back != null && progress < back ? 1 : 0)

    // le « fantôme » du navigateur essaie d'atteindre le CPU : refus
    const g = tryStart != null && tryEnd != null ? clamp((progress - tryStart) / (tryEnd - tryStart)) : 0
    const ghostOn = tryStart != null && progress >= tryStart && (back == null || progress < back)
    const ghost: StageToken | null = ghostOn ? {
      id: 'ghost', name: 'Navigateur', glyph: Globe, color: NAV.color,
      pose: { ...mixPose(placePose({ zone: 'blocked', i: 0 }), placePose({ zone: 'free', x: 610, y: 230 }), easeOut(g), -10), o: 0.55 },
      mark: g > 0.9 ? 'cross' : null, markOpacity: easeOut(clamp((g - 0.9) / 0.1)),
    } : null

    const tokens = buildTokens(SCH_ACTORS, SCH_INIT, frames, progress, {
      showState: true,
      extra: (id) => (id === 'nav' && arrived ? { glow, mark: back != null && progress >= back ? null : 'check' } : {}),
    })
    if (ghost) tokens.push(ghost)

    // balayage de l'ordonnanceur sur la file (de la dernière place vers la première)
    const s0 = at('Chaque fois que', 0.5), s1 = at('et en choisit un', 0.1), s2 = at('Ici, le premier arrivé', 0.15)
    const scan = s0 != null && s1 != null && s2 != null && progress >= s0 && progress < s2 + 0.003
    const sweep = s0 != null && s1 != null ? clamp((progress - s0) / (s1 - s0)) : 0
    const bx = 520 - 168 + (1 - sweep) * 168 // 3e place → 1re place (x = 520 - i*84)
    const pulse = fade(progress, at, 'Qui décide', 0, 0.8)
    const occupied = progress >= (at("D'abord") ?? 9) && progress < (at('Le processus réveillé') ?? 9)
    const cpuColor = MUS.color

    return (
      <LifecycleStage
        className="h-full w-full" tokens={tokens} cpuBusy={progress >= (at('Ici, le premier arrivé', 0.9) ?? 9)} cpuColor={cpuColor}
        focus={occupied ? 'cpu' : null}
        label="L’ordonnanceur choisit le premier processus prêt et lui donne le processeur"
      >
        <Pill x={634} y={66} w={150} text="ORDONNANCEUR" color="#fff" o={pulse} icon />
        {scan && (
          <g>
            <rect x={bx - 46} y={88} width={92} height={92} rx={20} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="5 5" opacity=".85" />
            <path d={`M634 82 L${bx} 90`} stroke="#fff" strokeOpacity=".4" strokeDasharray="2 5" />
          </g>
        )}
        <Pill x={300} y={34} w={230} text="PRÊT : J’ATTENDS MON TOUR" color={STATE_COLOR.ready} o={fade(progress, at, 'Prêt veut dire', 0, 0.6)} />
        <Pill x={812} y={22} w={238} text="ÉLU : JE CALCULE, MAINTENANT" color={STATE_COLOR.running} o={fade(progress, at, 'Élu veut dire', 0, 0.6)} />
        {ghost && g > 0.9 && (
          <text x={610} y={182} textAnchor="middle" fontSize="12.5" fill={STATE_COLOR.blocked} fontFamily="Geist, sans-serif" opacity={easeOut(clamp((g - 0.9) / 0.1))}>pas d’accès direct au CPU</text>
        )}
      </LifecycleStage>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 5 — Un exemple complet                                              */
/* ------------------------------------------------------------------ */
const EX_ACTORS = [NAV, MUS, EDI]
const EX_INIT: Layout = { nav: { zone: 'queue', i: 0 }, mus: { zone: 'queue', i: 1 }, edi: { zone: 'queue', i: 2 } }
const EX_FRAMES = [
  { on: "L'ordonnanceur élit le navigateur", delay: 0.2, layout: { nav: { zone: 'cpu' }, mus: { zone: 'queue', i: 0 }, edi: { zone: 'queue', i: 1 } } as Layout },
  { on: 'Le navigateur demande', delay: 3.0, layout: { nav: { zone: 'blocked', i: 0 } } as Layout },
  { on: 'Aussitôt', delay: 0.4, layout: { mus: { zone: 'cpu' }, edi: { zone: 'queue', i: 0 } } as Layout },
  { on: "Le navigateur n'est pas relancé", delay: 0.2, len: 1.3, layout: { nav: { zone: 'queue', i: 1 } } as Layout },
  { on: 'Le temps de la musique', delay: 1.6, layout: { mus: { zone: 'queue', i: 2 } } as Layout },
  { on: "L'éditeur est élu", delay: 0.3, layout: { edi: { zone: 'cpu' }, nav: { zone: 'queue', i: 0 }, mus: { zone: 'queue', i: 1 } } as Layout },
]
/** étapes du parcours du navigateur, résumées en bas de scène */
const TRAIL: { on: string; off: number; label: string; color: string }[] = [
  { on: 'Reprenons tout', off: 0.2, label: 'Prêt', color: STATE_COLOR.ready },
  { on: "L'ordonnanceur élit le navigateur", off: 0.5, label: 'Élu', color: STATE_COLOR.running },
  { on: 'Le navigateur demande', off: 3.2, label: 'Bloqué', color: STATE_COLOR.blocked },
  { on: "Le navigateur n'est pas relancé", off: 0.4, label: 'Prêt', color: STATE_COLOR.ready },
]

const example: Scene = {
  id: 'example',
  title: 'Un exemple complet',
  duration: dur('example'),
  audio: audio('example'),
  sync: SYNC.example,
  narration: narrationOf('example'),
  beats: [
    { on: 'Reprenons tout', text: 'Trois processus prêts, un seul processeur' },
    { on: "L'ordonnanceur élit le navigateur", text: 'Prêt → Élu : le navigateur obtient le CPU' },
    { on: 'Le navigateur demande', text: 'Élu → Bloqué : il attend le réseau, le CPU est libéré' },
    { on: 'Aussitôt', text: 'Le CPU ne reste pas inutilisé : la musique est élue' },
    { on: 'Pendant ce temps', text: 'La page arrive : événement attendu !' },
    { on: "Le navigateur n'est pas relancé", text: 'Bloqué → Prêt : il rejoint la file, derrière l’éditeur' },
    { on: 'Le temps de la musique', text: 'Élu → Prêt : préemption, le quantum est écoulé' },
    { on: "L'éditeur est élu", text: 'Prêt → Élu : au tour de l’éditeur ; le navigateur est le suivant' },
    { on: 'Prêt, élu, bloqué', text: 'Chaque transition a une cause précise' },
  ],
  cues: (at) => [
    ...cue(at, "L'ordonnanceur élit le navigateur", 1.0, 'enter', { gain: 0.8 }),
    ...cue(at, 'Le navigateur demande', 3.9, 'move', { gain: 0.8 }),
    ...cue(at, 'Aussitôt', 1.3, 'enter', { gain: 0.7 }),
    ...cue(at, 'Pendant ce temps', 0.9, 'appear', { pitch: 4, gain: 0.8 }),
    ...cue(at, "Le navigateur n'est pas relancé", 1.2, 'move', { gain: 0.7 }),
    ...cue(at, 'Le temps de la musique', 2.5, 'move', { gain: 0.8 }),
    ...cue(at, "L'éditeur est élu", 1.2, 'enter', { gain: 0.8 }),
    ...cue(at, 'Prêt, élu, bloqué', 0.4, 'done', { gain: 0.8 }),
  ],
  render: ({ progress, at }) => {
    const frames = resolveFrames(EX_FRAMES, at)
    const pageAt = at('Pendant ce temps', 0.8), backAt = at("Le navigateur n'est pas relancé", 0.2), reqAt = at('Le navigateur demande', 0.3)
    const pageHere = pageAt != null && progress >= pageAt
    const tokens = buildTokens(EX_ACTORS, EX_INIT, frames, progress, {
      showState: true,
      extra: (id) => {
        if (id === 'nav' && pageHere && backAt != null && progress < backAt) return { glow: easeOut(clamp((progress - pageAt!) / 0.04)), mark: 'check' as const }
        return {}
      },
    })
    // anneau de tranche : monte tant que le processus est sur le CPU (le navigateur quitte avant la fin : il se bloque)
    const run = tokens.find((t) => t.running)
    const sliceOf = (id: string): number => {
      const arrive = frames.find((f) => f.layout[id]?.zone === 'cpu')
      const leave = frames.find((f) => f.start > (arrive?.end ?? 1) && f.layout[id] && f.layout[id].zone !== 'cpu')
      const a = arrive?.end ?? 0
      const b = leave?.start ?? Math.min(1, a + 0.12)
      const cap = id === 'nav' ? 0.4 : id === 'mus' ? 1 : 0.5
      return clamp((progress - a) / Math.max(1e-4, b - a)) * cap
    }
    const slice = run ? sliceOf(run.id) : undefined
    const runColor = run ? EX_ACTORS.find((a) => a.id === run.id)!.color : '#5eead4'

    const waiting = reqAt != null && progress >= reqAt && !pageHere
    const trail = TRAIL.map((s) => progress >= (at(s.on, s.off) ?? 9))
    return (
      <div className="relative h-full w-full">
        <LifecycleStage className="h-full w-full" tokens={tokens} cpuBusy={!!run} cpuColor={runColor} slicePct={slice} label="Exemple complet : trois processus, un processeur, une zone de blocage">
          {waiting && (
            <g transform="translate(330 290)">
              <circle r={13} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="3" />
              <circle r={13} fill="none" stroke={STATE_COLOR.blocked} strokeWidth="3" strokeLinecap="round" strokeDasharray="22 60">
                {!reducedMotion() && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.9s" repeatCount="indefinite" />}
              </circle>
              <text x={26} y={5} fontSize="13" fill="rgba(255,255,255,.75)" fontFamily="Geist, sans-serif">en attente du réseau…</text>
            </g>
          )}
          {pageHere && backAt != null && progress < backAt + 0.02 && (
            <text x={330} y={295} fontSize="13.5" fontWeight="600" fill={STATE_COLOR.running} fontFamily="Geist, sans-serif">page reçue ✓</text>
          )}
        </LifecycleStage>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 text-[12px]">
          <span className="mr-1 text-white/45">parcours du navigateur :</span>
          {TRAIL.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5" style={{ opacity: trail[i] ? 1 : 0, transform: `translateY(${trail[i] ? 0 : 6}px)`, transition: 'all .4s' }}>
              {i > 0 && <ArrowRight size={12} className="text-white/35" />}
              <span className="rounded-full border px-2.5 py-0.5 font-display" style={{ borderColor: `${s.color}99`, color: s.color, background: `${s.color}1a` }}>{s.label}</span>
            </span>
          ))}
        </div>
      </div>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 6 — À retenir                                                       */
/* ------------------------------------------------------------------ */
const recap: Scene = {
  id: 'recap',
  title: 'À retenir',
  duration: dur('recap'),
  audio: audio('recap'),
  sync: SYNC.recap,
  narration: narrationOf('recap'),
  beats: [
    { on: 'Résumons', text: 'Processus = programme en cours d’exécution' },
    { on: 'Il est Prêt quand', text: 'Trois états : prêt, élu, bloqué' },
    { on: "l'ordonnanceur élit", text: 'Quatre transitions, chacune avec sa cause' },
    { on: "Et la règle d'or", text: 'Règle d’or : Bloqué → Prêt, jamais Bloqué → Élu' },
    { on: 'À vous de jouer', text: 'Passez en Exploration pour le vérifier vous-même' },
  ],
  cues: (at) => [
    ...cue(at, 'Il est Prêt quand', 0.2, 'appear', { pitch: 0, gain: 0.8 }),
    ...cue(at, 'Élu quand', 0.2, 'appear', { pitch: 1, gain: 0.8 }),
    ...cue(at, 'Bloqué quand', 0.2, 'appear', { pitch: 2, gain: 0.8 }),
    ...cue(at, "l'ordonnanceur élit", 0.2, 'move', { gain: 0.6 }),
    ...cue(at, "Et la règle d'or", 0.8, 'done', { gain: 0.7 }),
    ...cue(at, 'À vous de jouer', 0.3, 'appear', { pitch: 5, gain: 0.9 }),
  ],
  render: ({ progress, at, actions }) => {
    const nodes: [number, number, number] = [fade(progress, at, 'Il est Prêt quand', 0, 0.5), fade(progress, at, 'Élu quand', 0, 0.5), fade(progress, at, 'Bloqué quand', 0, 0.5)]
    const starts = ["l'ordonnanceur élit", 'le système préempte', 'le processus se bloque', "l'événement le réveille"]
    const edges = starts.map((p) => fade(progress, at, p, 0, 0.5)) as [number, number, number, number]
    let k = -1
    starts.forEach((p, i) => { if (progress >= (at(p) ?? 9)) k = i })
    const inList = progress >= (at(starts[0]) ?? 9) && progress < (at("Et la règle d'or") ?? 9)
    const cta = fade(progress, at, 'À vous de jouer', 0, 0.6)
    return (
      <div className="flex h-full w-full flex-col items-center gap-2">
        <StateDiagram className="min-h-0 w-full flex-1" nodes={nodes} edges={edges} active={inList && k >= 0 ? k : null} forbidden={fade(progress, at, "Et la règle d'or", 0.4, 0.8)} />
        <div className="flex shrink-0 justify-center" style={{ opacity: cta, transform: `translateY(${(1 - cta) * 10}px)`, pointerEvents: cta > 0.5 ? 'auto' : 'none' }}>
          <button onClick={actions.goExplore} className="btn-primary">Essayer en mode Exploration <ArrowRight size={18} /></button>
        </div>
      </div>
    )
  },
}

export const scenes: Scene[] = [what, why, transitions, scheduler, example, recap]

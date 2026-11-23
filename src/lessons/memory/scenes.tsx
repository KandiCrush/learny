import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { BAD, FREE, type DrawBlock, type Geom, type Mark, MemoryBar, memColor, smooth } from '../../components/MemoryBar'
import type { PhraseAt } from '../../lib/clock'
import { clamp, lerp } from '../../lib/math'
import { estimateSeconds } from '../../lib/narration'
import { STRATEGIES, type Strategy, bitmap, choose, explainFailure, freeBlocks, linkedList, stats } from '../../lib/memory'
import type { Scene, SceneAudio, SoundCue } from '../types'
import { AUDIO_URL, type SceneKey, narrationOf } from './narration'
import { CAP, COMPACT_COST, F1, M1, M3, M4, M4a, M6, REQ, RUNS, SIZE, WAIT_DY, blocksAt, blocksOfMem, key, off, placesOf, resolveFrames, waiting, type Layout } from './story'
import { FILE_DURATION, SEGMENTS, SYNC } from './sync.generated'

/**
 * Sept scènes, UNE histoire : la même RAM et les mêmes processus (couleurs, tailles) de bout en bout.
 * Chaque scène démarre exactement là où la précédente s'arrête (états du moteur dans story.ts).
 * Les animations s'accrochent à des EXPRESSIONS de la narration ; elles peuvent durer plus longtemps que la voix
 * (pauses longues dans le script) pour laisser le temps d'observer.
 */
const audio = (k: SceneKey): SceneAudio | undefined => {
  const seg = SEGMENTS[k]
  return seg ? { src: AUDIO_URL, from: seg.from, to: seg.to, fileDuration: FILE_DURATION ?? undefined } : undefined
}
const dur = (k: SceneKey) => estimateSeconds(narrationOf(k)) + 6 // + pauses longues
const cue = (at: PhraseAt, on: string, off: number, sound: SoundCue['sound'], extra: Partial<SoundCue> = {}): SoundCue[] => {
  const p = at(on, off)
  return p == null ? [] : [{ at: p, sound, ...extra }]
}
const fade = (progress: number, at: PhraseAt, on: string, offsetSec = 0, lenSec = 0.8): number => {
  const a = at(on, offsetSec), b = at(on, offsetSec + lenSec)
  if (a == null || b == null) { if (import.meta.env?.DEV) console.warn(`[memory] expression introuvable : « ${on} »`); return 0 }
  return smooth((progress - a) / Math.max(1e-4, b - a))
}

const BAR: Geom = { x: 40, y: 196, w: 920, h: 84, capacity: CAP }
const X = (mo: number) => BAR.x + (mo * BAR.w) / CAP

function Chip({ x, y, text, color = '#fff', o = 1, anchor = 'middle', bad }: { x: number; y: number; text: string; color?: string; o?: number; anchor?: 'start' | 'middle' | 'end'; bad?: boolean }) {
  const w = text.length * 6.9 + 24
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return (
    <g opacity={o} transform={`translate(0 ${(1 - o) * 6})`}>
      <rect x={x0} y={y - 14} width={w} height={28} rx={14} fill={bad ? 'rgba(255,107,107,.14)' : 'rgba(18,20,42,.95)'} stroke={bad ? BAD : color} strokeOpacity=".8" />
      <text x={x0 + w / 2} y={y + 4.5} textAnchor="middle" fontSize="12.5" fill={bad ? BAD : '#fff'} fontFamily="Geist, sans-serif">{text}</text>
    </g>
  )
}

/** Cadre commun des scènes 1 à 5 : la RAM, la zone d'attente, et les surimpressions de la scène */
function Stage({ blocks, partitions, partO, marks, gapO = 1, waitVisible, children }: { blocks: DrawBlock[]; partitions?: { start: number; size: number }[]; partO?: number; marks?: Mark[]; gapO?: number; waitVisible: number; children?: ReactNode }) {
  return (
    <svg viewBox="0 0 1000 440" className="h-full w-full" role="img" aria-label="Mémoire vive : zones occupées par les processus et zones libres, proportionnelles à leur taille">
      <text x={BAR.x} y={BAR.y - 12} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">RAM · {CAP} MO</text>
      <text x={BAR.x} y={BAR.y + WAIT_DY - 12} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.4)" opacity={waitVisible}>PROCESSUS EN ATTENTE</text>
      <MemoryBar geom={BAR} blocks={blocks} partitions={partitions} partO={partO} marks={marks} gapO={gapO} />
      {children}
    </svg>
  )
}

const pids = [1, 2, 3, 4]
const P1_3: Layout = { [key(1)]: off(1, 4), [key(2)]: off(2, 9), [key(3)]: off(3, 16) }
const waitCount = (b: DrawBlock[]) => Math.min(1, b.filter((x) => x.kind === 'proc' && (x.dy ?? 0) < -4 && (x.o ?? 1) > 0.3).length)

/* ------------------------------------------------------------------ */
/* 1 — Partager la RAM                                                 */
/* ------------------------------------------------------------------ */
const S1 = [
  { on: 'Un seul programme', delay: 0.4, len: 1.4, to: { [key(1)]: { lane: 1, o: 1 } } },
  { on: 'Alors on en charge', delay: 0.6, len: 2.0, to: { [key(2)]: { lane: 1, o: 1 }, [key(3)]: { lane: 1, o: 1 } } },
]
const share: Scene = {
  id: 'share', title: 'Partager la mémoire', duration: dur('share'), audio: audio('share'), sync: SYNC.share, narration: narrationOf('share'),
  beats: [
    { on: 'Un seul programme', text: 'Un seul programme : le processeur attend, inutilement' },
    { on: 'Alors on en charge', text: 'Multiprogrammation : plusieurs processus en mémoire, le processeur reste occupé' },
    { on: 'Le gestionnaire de mémoire', text: 'Le gestionnaire de mémoire connaît les zones libres et occupées' },
    { on: 'registre de base', text: 'Base + limite : chaque processus est enfermé dans sa zone' },
  ],
  cues: (at) => [...cue(at, 'Un seul programme', 1.2, 'enter', { gain: 0.7 }), ...cue(at, 'Alors on en charge', 1.4, 'enter', { gain: 0.7 }), ...cue(at, 'Alors on en charge', 2.0, 'appear', { pitch: 2, gain: 0.5 }), ...cue(at, 'registre de base', 1.0, 'appear', { pitch: 3, gain: 0.6 }), ...cue(at, 'registre de base', 2.6, 'move', { gain: 0.6 })],
  render: ({ progress, at }) => {
    const frames = resolveFrames(S1, at)
    const blocks = blocksAt(pids.slice(0, 3), P1_3, frames, progress)
    // processeur occupé : si chaque programme attend les E/S 70 % du temps, n processus en mémoire occupent 1 − 0,7^n du processeur
    const n = blocks.filter((b) => b.kind === 'proc').reduce((a, b) => a + (b.dy === 0 ? (b.o ?? 1) : 0), 0)
    const busy = 1 - Math.pow(0.7, n)
    const cpuO = fade(progress, at, 'Un seul programme', 0.2, 0.8)
    const bl = fade(progress, at, 'registre de base', 0, 0.7)
    const t1 = fade(progress, at, 'registre de base', 1.0, 0.5), t2 = fade(progress, at, 'registre de base', 2.6, 0.5)
    const p2 = placesOf(M1)[key(2)]
    return (
      <Stage blocks={blocks} waitVisible={waitCount(blocks)}>
        <g opacity={cpuO} transform="translate(40 330)">
          <text y={-8} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">PROCESSEUR OCCUPÉ</text>
          <rect width={400} height={16} rx={8} fill="rgba(255,255,255,.07)" />
          <rect width={400 * busy} height={16} rx={8} fill={FREE} opacity=".85" />
          <text y={42} fontSize="26" fontWeight="600" fill="#fff" fontFamily="Geist Mono, monospace">{Math.round(busy * 100)} %</text>
          <text x={100} y={40} fontSize="12" fill="rgba(255,255,255,.55)" fontFamily="Geist, sans-serif">{n < 1.5 ? 'inactif pendant les attentes de disque' : 'les attentes des uns sont comblées par les autres'}</text>
          <text y={64} fontSize="10.5" fill="rgba(255,255,255,.35)" fontFamily="Geist, sans-serif">modèle : chaque programme attend les E/S 70 % du temps</text>
        </g>
        <g opacity={bl}>
          <path d={`M${X(p2.start)} ${BAR.y + BAR.h + 34} v8 H${X(p2.start + p2.size)} v-8`} fill="none" stroke={memColor(2)} strokeWidth="2" />
          <text x={X(p2.start + p2.size / 2)} y={BAR.y + BAR.h + 60} textAnchor="middle" fontSize="12" fill="#fff" fontFamily="Geist Mono, monospace">base = {p2.start} · limite = {p2.size}</text>
        </g>
        <Chip x={640} y={348} text={`adresse 3 → ${p2.start} + 3 = ${p2.start + 3} ✓ accepté`} color={FREE} o={t1} />
        <Chip x={640} y={386} text={`adresse ${p2.size + 1} ≥ limite ${p2.size} ✕ refusé`} bad o={t2} />
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 2 — Partitions fixes                                                */
/* ------------------------------------------------------------------ */
const P4W = waiting(4, 20)
const S2_INIT: Layout = { ...placesOf(M1), [key(4)]: { ...P4W, o: 0 } }
const f1 = placesOf(F1)
const S2 = [
  { on: 'Première idée', delay: 0.3, len: 1.2, to: { [key(1)]: { lane: 0 }, [key(2)]: { lane: 0 }, [key(3)]: { lane: 0 } } },
  { on: 'Une partition', delay: 0.1, len: 1.8, to: { [key(1)]: f1[key(1)], [key(2)]: f1[key(2)], [key(3)]: f1[key(3)] } },
  { on: 'Mais un processus ne remplit', delay: 0.1, len: 1.2, to: { [key(1)]: { waste: 1 }, [key(2)]: { waste: 1 }, [key(3)]: { waste: 1 } } },
  { on: 'Et trois partitions', delay: 0.4, len: 0.8, to: { [key(4)]: { o: 1 } } },
]
const fS = stats(F1)
const partitions = F1.blocks.filter((b) => b.kind !== 'os').map((b) => ({ start: b.start, size: b.size }))
const fail4 = explainFailure(F1, SIZE[4])
const fixed: Scene = {
  id: 'fixed', title: 'Partitions fixes', duration: dur('fixed'), audio: audio('fixed'), sync: SYNC.fixed, narration: narrationOf('fixed'),
  beats: [
    { on: 'Première idée', text: 'Partitions fixes : la RAM est découpée à l’avance' },
    { on: 'Une partition', text: 'Chaque processus occupe une partition entière' },
    { on: 'Mais un processus ne remplit', text: 'Espace réservé mais inutilisé = fragmentation interne' },
    { on: 'Et trois partitions', text: 'Autant de partitions, autant de processus : les autres attendent' },
  ],
  cues: (at) => [...cue(at, 'Première idée', 0.8, 'move', { gain: 0.5 }), ...cue(at, 'Une partition', 1.0, 'enter', { gain: 0.7 }), ...cue(at, 'Une partition', 1.5, 'enter', { gain: 0.5 }), ...cue(at, 'Mais un processus ne remplit', 0.6, 'move', { gain: 0.6 }), ...cue(at, 'Et trois partitions', 0.9, 'move', { gain: 0.7 })],
  render: ({ progress, at }) => {
    const frames = resolveFrames(S2, at)
    const blocks = blocksAt(pids, S2_INIT, frames, progress)
    const partO = fade(progress, at, 'Première idée', 0.5, 0.9)
    const w = fade(progress, at, 'Mais un processus ne remplit', 0.9, 0.8)
    const f = fade(progress, at, 'Et trois partitions', 1.1, 0.7)
    return (
      <Stage blocks={blocks} partitions={partitions} partO={partO} waitVisible={waitCount(blocks)}>
        <g opacity={w} transform="translate(40 336)">
          <text fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill={BAD}>FRAGMENTATION INTERNE</text>
          <text y={34} fontSize="26" fontWeight="600" fill="#fff" fontFamily="Geist Mono, monospace">{fS.internal} Mo perdus</text>
          <text y={58} fontSize="12.5" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">{fS.allocated} Mo réservés · {fS.used} Mo utilisés</text>
        </g>
        <Chip x={560} y={376} text={fail4.ok ? '' : `P4 (${SIZE[4]} Mo) : ${fail4.why.split(':')[0]}`} bad o={f} />
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 3 — Partitions variables                                            */
/* ------------------------------------------------------------------ */
const S3_INIT: Layout = { ...Object.fromEntries(Object.entries(placesOf(F1)).map(([k, v]) => [k, { ...v, waste: 1 }])), [key(4)]: P4W }
const m1 = placesOf(M1)
const S3 = [
  { on: 'Deuxième idée', delay: 0.2, len: 1.8, to: { [key(1)]: { ...m1[key(1)], waste: 0 }, [key(2)]: { ...m1[key(2)], waste: 0 }, [key(3)]: { ...m1[key(3)], waste: 0 } } },
  { on: 'Mais quand un processus termine', delay: 0.9, len: 1.3, to: { [key(2)]: { lane: 0, o: 0 } } },
]
const holes3 = freeBlocks(M3)
const s3 = stats(M3)
const variable: Scene = {
  id: 'variable', title: 'Partitions variables', duration: dur('variable'), audio: audio('variable'), sync: SYNC.variable, narration: narrationOf('variable'),
  beats: [
    { on: 'Deuxième idée', text: 'Partitions variables : chaque zone a exactement la taille demandée' },
    { on: 'Mais quand un processus', text: 'P2 termine : sa zone devient un trou' },
    { on: 'Le quatrième aurait', text: 'Assez de place au total, mais pas d’un seul tenant' },
  ],
  cues: (at) => [...cue(at, 'Deuxième idée', 0.8, 'move', { gain: 0.5 }), ...cue(at, 'Mais quand un processus termine', 1.4, 'done', { gain: 0.7 }), ...cue(at, 'Le quatrième aurait', 0.9, 'move', { gain: 0.5 }), ...cue(at, 'Le quatrième aurait', 2.0, 'move', { gain: 0.5 }), ...cue(at, 'Le quatrième aurait', 3.4, 'appear', { pitch: 0, gain: 0.6 })],
  render: ({ progress, at }) => {
    const frames = resolveFrames(S3, at)
    const blocks = blocksAt(pids, S3_INIT, frames, progress)
    const partO = 1 - fade(progress, at, 'Deuxième idée', 0, 1.0)
    const a1 = fade(progress, at, 'Le quatrième aurait', 0.6, 0.4), a2 = fade(progress, at, 'Le quatrième aurait', 1.8, 0.4), sum = fade(progress, at, 'Le quatrième aurait', 3.2, 0.7)
    const marks: Mark[] = [
      { start: holes3[0].start, size: holes3[0].size, kind: 'fail', o: a1 },
      { start: holes3[1].start, size: holes3[1].size, kind: 'fail', o: a2 },
    ]
    const need = SIZE[4]
    return (
      <Stage blocks={blocks} partitions={partitions} partO={partO} marks={marks} waitVisible={waitCount(blocks)}>
        <Chip x={X(holes3[0].start + holes3[0].size / 2)} y={BAR.y + BAR.h + 44} text={`${holes3[0].size} < ${need} ✕`} bad o={a1} />
        <Chip x={X(holes3[1].start + holes3[1].size / 2)} y={BAR.y + BAR.h + 44} text={`${holes3[1].size} < ${need} ✕`} bad o={a2} />
        <g opacity={sum} transform="translate(40 350)">
          <text fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill={BAD}>FRAGMENTATION EXTERNE</text>
          <text y={32} fontSize="22" fontWeight="600" fill="#fff" fontFamily="Geist Mono, monospace">{s3.free} Mo libres = {holes3.map((h) => h.size).join(' + ')}</text>
          <text y={56} fontSize="12.5" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">mais la plus grande zone contiguë n’en fait que {s3.largestFree} : P4 a besoin de {need}</text>
        </g>
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 4 — Compactage                                                      */
/* ------------------------------------------------------------------ */
const S4_INIT: Layout = { ...placesOf(M3), [key(2)]: { ...off(2, 9) }, [key(4)]: P4W }
const m4a = placesOf(M4a), m4 = placesOf(M4)
const S4 = [
  { on: 'Le compactage déplace', delay: 0.6, len: 2.4, to: { [key(3)]: { start: m4a[key(3)].start } } },
  { on: 'Cette fois', delay: 0.5, len: 1.8, to: { [key(4)]: { lane: 1, start: m4[key(4)].start, o: 1 } } },
]
const compact: Scene = {
  id: 'compact', title: 'Le compactage', duration: dur('compact'), audio: audio('compact'), sync: SYNC.compact, narration: narrationOf('compact'),
  beats: [
    { on: 'Le compactage déplace', text: 'Compactage : P3 glisse vers le bas, les trous se regroupent' },
    { on: 'Cette fois', text: 'Une seule zone libre assez grande : P4 entre' },
    { on: 'Mais copier', text: 'Coût : copier la mémoire, pendant que les processus sont suspendus' },
  ],
  cues: (at) => [...cue(at, 'Le compactage déplace', 0.8, 'move', { gain: 0.8 }), ...cue(at, 'Le compactage déplace', 3.0, 'done', { gain: 0.5 }), ...cue(at, 'Cette fois', 1.6, 'enter', { gain: 0.8 })],
  render: ({ progress, at }) => {
    const frames = resolveFrames(S4, at)
    const blocks = blocksAt(pids, S4_INIT, frames, progress)
    const t0 = at('Le compactage déplace', 0.6), t1 = at('Le compactage déplace', 3.0), t2 = at('Cette fois', 2.3)
    const moving = t0 != null && t1 != null && t2 != null && progress >= t0 && progress < t2
    const copy = fade(progress, at, 'Le compactage déplace', 0.6, 0.5) * (1 - fade(progress, at, 'Cette fois', 1.2, 0.6))
    const cost = fade(progress, at, 'Mais copier', 0.3, 0.8)
    const arrowO = fade(progress, at, 'Le compactage déplace', 0.8, 0.4) * (1 - fade(progress, at, 'Le compactage déplace', 2.6, 0.5))
    const fromX = X(placesOf(M1)[key(3)].start), toX = X(m4a[key(3)].start)
    return (
      <Stage blocks={blocks} waitVisible={waitCount(blocks)}>
        <g opacity={arrowO}>
          <path d={`M${fromX + 30} ${BAR.y - 18} H${toX + 30}`} stroke={memColor(3)} strokeWidth="3" strokeDasharray="6 5" markerEnd="" />
          <path d={`M${toX + 38} ${BAR.y - 24} l-9 6 l9 6`} fill="none" stroke={memColor(3)} strokeWidth="3" strokeLinecap="round" />
        </g>
        <Chip x={700} y={340} text={`⏸ processeur : rien ne s’exécute pendant la copie`} color={BAD} bad o={moving ? copy : 0} />
        <g opacity={cost} transform="translate(40 330)">
          <text fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="#ffb84d">COÛT DU COMPACTAGE</text>
          <text y={34} fontSize="26" fontWeight="600" fill="#fff" fontFamily="Geist Mono, monospace">{COMPACT_COST} Mo copiés</text>
          <text y={58} fontSize="12.5" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">+ adresses de base à mettre à jour · processus suspendus pendant la copie</text>
        </g>
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 5 — Suivre l'état de la mémoire                                     */
/* ------------------------------------------------------------------ */
const S5_INIT: Layout = { ...placesOf(M4), [key(2)]: off(2, 9) }
const bits = bitmap(M4)
const list = linkedList(M4)
const owner = (i: number) => { const b = M4.blocks.find((x) => x.start <= i && i < x.start + x.size)!; return b.kind === 'os' ? '#8a90b5' : b.kind === 'free' ? FREE : memColor(b.pid!) }
const track: Scene = {
  id: 'track', title: 'Retrouver les zones libres', duration: dur('track'), audio: audio('track'), sync: SYNC.track, narration: narrationOf('track'),
  beats: [
    { on: 'Pour retrouver', text: 'Le gestionnaire doit retrouver les trous : deux structures classiques' },
    { on: 'La table est simple', text: 'Table de bits : simple, mais il faut chercher une suite de 0' },
    { on: 'La liste suit', text: 'Liste chaînée : une zone = adresse + taille, adaptée aux tailles variables' },
  ],
  cues: (at) => [...cue(at, 'Pour retrouver', 0.8, 'appear', { pitch: 1, gain: 0.5 }), ...cue(at, 'ou une liste', 0.2, 'appear', { pitch: 3, gain: 0.5 }), ...cue(at, 'La table est simple', 0.3, 'move', { gain: 0.4 })],
  render: ({ progress, at }) => {
    const blocks = blocksAt(pids, S5_INIT, [], progress)
    const bitsO = fade(progress, at, 'une table de bits', 0, 1.8)
    const listO = fade(progress, at, 'ou une liste', 0, 2.4)
    const hl = fade(progress, at, 'La table est simple', 0.9, 0.6)
    const hl2 = fade(progress, at, 'La liste suit', 0.4, 0.6)
    const k = BAR.w / CAP
    const lastFree = list.filter((n) => n.type === 'H').slice(-1)[0]
    const nodeW = 150, gap = (BAR.w - list.length * nodeW) / (list.length - 1)
    return (
      <Stage blocks={blocks} waitVisible={0} gapO={0.6}>
        {/* table de bits : une case par Mo */}
        <g opacity={bitsO > 0 ? 1 : 0}>
          <text x={BAR.x} y={BAR.y + BAR.h + 44} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">TABLE DE BITS · 1 CASE = 1 MO</text>
          {bits.map((b, i) => {
            const shown = clamp(bitsO * (CAP + 6) - i)
            return (
              <g key={i} opacity={shown}>
                <rect x={BAR.x + i * k + 1} y={BAR.y + BAR.h + 52} width={k - 2} height={22} rx={5} fill={b ? `${owner(i)}33` : 'rgba(94,234,212,.1)'} stroke={b ? owner(i) : FREE} strokeOpacity={b ? 0.7 : 0.5} />
                <text x={BAR.x + i * k + k / 2} y={BAR.y + BAR.h + 68} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" fontFamily="Geist Mono, monospace">{b}</text>
              </g>
            )
          })}
          {lastFree && <rect x={BAR.x + lastFree.start * k} y={BAR.y + BAR.h + 48} width={lastFree.size * k} height={30} rx={8} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="5 4" opacity={hl} />}
          <text x={BAR.x + 28 * k + (lastFree?.size ?? 0) * k / 2} y={BAR.y + BAR.h + 90} textAnchor="middle" fontSize="12" fill="#fff" fontFamily="Geist, sans-serif" opacity={hl}>4 zéros d’affilée ?</text>
        </g>
        {/* liste chaînée */}
        <g opacity={listO > 0 ? 1 : 0} transform={`translate(${BAR.x} ${BAR.y + BAR.h + 92})`}>
          <text y={-6} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">LISTE CHAÎNÉE · ADRESSE + TAILLE</text>
          {list.map((n, i) => {
            const s = clamp(listO * (list.length + 0.6) - i)
            const c = n.type === 'H' ? FREE : n.label === 'SE' ? '#8a90b5' : memColor(Number(n.label.slice(1)))
            const hot = n === lastFree ? hl2 : 0
            return (
              <g key={i} opacity={s} transform={`translate(${i * (nodeW + gap)} 4)`}>
                {i > 0 && <path d={`M${-gap + 3} 24 h${gap - 10} m-6 -5 l6 5 l-6 5`} stroke="rgba(255,255,255,.4)" strokeWidth="2" fill="none" strokeLinecap="round" />}
                <rect width={nodeW} height={46} rx={12} fill="#12142a" stroke={c} strokeWidth={1.6 + hot * 1.6} />
                <text x={12} y={19} fontSize="13" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{n.type === 'H' ? 'Libre' : n.label}</text>
                <text x={12} y={36} fontSize="11.5" fill="rgba(255,255,255,.65)" fontFamily="Geist Mono, monospace">début {n.start} · taille {n.size}</text>
              </g>
            )
          })}
        </g>
      </Stage>
    )
  },
}

/* ------------------------------------------------------------------ */
/* 6 & 7 — Quatre stratégies, mêmes demandes                           */
/* ------------------------------------------------------------------ */
const ROW_Y = [92, 172, 252, 332]
const ROW_X = 160, ROW_W = 800, ROW_H = 44
const S6_INIT: Layout = { ...placesOf(M4), [key(2)]: off(2, 9), [key(5)]: off(5, 9) }
const m5 = placesOf(M6)
const S6 = [
  { on: 'Le temps passe', delay: 0.4, len: 1.2, to: { [key(3)]: { lane: 0, o: 0 } } },
  { on: 'de nouveaux trous', delay: 0.2, len: 1.2, to: { [key(5)]: { lane: 1, start: m5[key(5)].start, o: 1 } } },
  { on: 'apparaissent', delay: 0.3, len: 1.2, to: { [key(1)]: { lane: 0, o: 0 } } },
]
const NAMES = ['First Fit', 'Next Fit', 'Best Fit', 'Worst Fit']
const START_PHRASE = ['First Fit prend', 'Next Fit pareil', 'Best Fit prend', 'Worst Fit prend']
const stepSec = 1.05
const rowGeom = (k: number, u: number): Geom => ({ x: lerp(BAR.x, ROW_X, u), y: lerp(BAR.y, ROW_Y[k], u), w: lerp(BAR.w, ROW_W, u), h: lerp(BAR.h, ROW_H, u), capacity: CAP })
const fmtFail = (k: number, s: Strategy) => {
  const run = RUNS[s]
  const i = run.results.findIndex((r) => !r.ok)
  if (i < 0) return null
  const before = stats(run.mems[i])
  return { pid: REQ[i], text: `✕ P${REQ[i]} (${SIZE[REQ[i]]} Mo) refusé : plus grand trou = ${before.largestFree} Mo`, idx: i, k }
}

/** Début (en progression) et pas d'une demande à la suivante pour la i-ème stratégie : au plus 1,05 s, réduit pour que les 4 demandes tiennent avant la stratégie suivante (ou la fin de la scène) */
function timing(i: number, at: PhraseAt): { t0: number; step: number } | null {
  const t0 = at(START_PHRASE[i], 0.5)
  if (t0 == null) return null
  const secU = (at('Mêmes demandes', 1) ?? 0) - (at('Mêmes demandes', 0) ?? 0) || 0.02
  const tNext = i < START_PHRASE.length - 1 ? at(START_PHRASE[i + 1], 0.5) ?? 1 : 1
  return { t0, step: Math.min(stepSec * secU, Math.max(0.01, (tNext - t0) / (REQ.length + 0.5))) }
}

/** État d'une ligne à l'instant `progress` : mémoire, blocs, recherche en cours */
function rowState(s: Strategy, progress: number, at: PhraseAt, startPhrase: string | null) {
  const run = RUNS[s]
  const tm = startPhrase ? timing(START_PHRASE.indexOf(startPhrase), at) : null
  const t0 = tm ? tm.t0 : null
  if (!startPhrase) return { mem: run.mems[REQ.length], born: {} as Record<number, number>, marks: [] as Mark[], idx: REQ.length, t0 } // résultat final (scène 7)
  const step = tm ? tm.step : 0.01
  const born: Record<number, number> = {}
  let idx = 0
  const marks: Mark[] = []
  if (t0 != null) {
    for (let k = 0; k < REQ.length; k++) {
      const a = t0 + k * step
      const before = run.mems[k]
      const ch = choose(before, SIZE[REQ[k]], s)
      const place = a + 0.7 * step
      if (progress >= place) { idx = k + 1; if (run.results[k].ok) born[REQ[k]] = clamp((progress - place) / (0.5 * step)) }
      else if (progress >= a) {
        const vis = ch.visited
        vis.forEach((v, i) => { if (progress >= a + i * 0.2 * step) marks.push({ start: v.start, size: v.size, kind: ch.block && v.start === ch.block.start && progress >= a + (vis.length - 1) * 0.2 * step + 0.1 * step ? 'pick' : 'scan', o: 0.9 }) })
        if (!ch.block && progress >= a + (vis.length) * 0.2 * step) marks.push({ start: 4, size: CAP - 4, kind: 'fail', o: 0.5 })
      }
    }
  }
  return { mem: run.mems[idx], born, marks, idx, t0 }
}

function Rows({ progress, at, u, startPhrases, extra }: { progress: number; at: PhraseAt; u: number; startPhrases: (string | null)[]; extra?: (k: number, s: Strategy, g: Geom) => ReactNode }) {
  return (
    <>
      {STRATEGIES.map((s, k) => {
        const g = rowGeom(k, u)
        const st = rowState(s, progress, at, startPhrases[k])
        const blocks = blocksOfMem(st.mem, st.born)
        return (
          <g key={s} opacity={k === 0 ? 1 : u}>
            <g opacity={u}>
              <text x={30} y={g.y + g.h / 2 + 5} fontSize="14" fontWeight="700" fill="#fff" fontFamily="IBM Plex Mono, monospace">{NAMES[k]}</text>
            </g>
            <MemoryBar geom={g} blocks={blocks} small={u > 0.5} marks={st.marks} gapO={1} tickO={0} />
            {extra?.(k, s, g)}
          </g>
        )
      })}
    </>
  )
}

const strategies: Scene = {
  id: 'strategies', title: 'Quatre stratégies d’allocation', duration: dur('strategies') + 4, audio: audio('strategies'), sync: SYNC.strategies, narration: narrationOf('strategies'),
  beats: [
    { on: 'Le temps passe', text: 'Le temps passe : des processus partent et arrivent' },
    { on: 'Quand plusieurs conviennent', text: 'Trous de 5, 9 et 4 Mo : plusieurs conviennent' },
    { on: 'Mêmes demandes', text: 'Même mémoire, mêmes demandes : P6 2 Mo · P7 6 Mo · P8 4 Mo · P9 4 Mo' },
    { on: 'First Fit prend', text: 'First Fit : le premier trou assez grand' },
    { on: 'Next Fit pareil', text: 'Next Fit : reprend où la dernière recherche s’est arrêtée' },
    { on: 'Best Fit prend', text: 'Best Fit : le plus petit trou qui suffit' },
    { on: 'Worst Fit prend', text: 'Worst Fit : le plus grand trou' },
  ],
  cues: (at) => [
    ...cue(at, 'Le temps passe', 0.8, 'done', { gain: 0.5 }), ...cue(at, 'de nouveaux trous', 1.0, 'enter', { gain: 0.5 }), ...cue(at, 'apparaissent', 1.0, 'done', { gain: 0.5 }),
    ...cue(at, 'Mêmes demandes', 0.6, 'move', { gain: 0.5 }),
    ...START_PHRASE.flatMap((_, i) => { const tm = timing(i, at); return tm ? REQ.map((__, k): SoundCue => ({ at: tm.t0 + k * tm.step + 0.7 * tm.step, sound: RUNS[STRATEGIES[i]].results[k].ok ? 'enter' : 'move', gain: RUNS[STRATEGIES[i]].results[k].ok ? 0.45 : 0.6 })) : [] }),
  ],
  render: ({ progress, at }) => {
    const frames = resolveFrames(S6, at)
    const big = blocksAt([1, 3, 4, 5], S6_INIT, frames, progress)
    const u = fade(progress, at, 'Mêmes demandes', 0.2, 1.4)
    const holesO = fade(progress, at, 'Quand plusieurs conviennent', 0.2, 0.6) * (1 - u)
    const reqO = u
    const holeMarks: Mark[] = freeBlocks(M6).map((h) => ({ start: h.start, size: h.size, kind: 'hole', o: holesO }))
    // avant la séparation : une seule barre (même mémoire que la scène 5) ; après : quatre lignes identiques qui s'écartent
    if (u <= 0) {
      return (
        <svg viewBox="0 0 1000 440" className="h-full w-full" role="img" aria-label="Mémoire fragmentée par le temps">
          <text x={BAR.x} y={BAR.y - 12} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">RAM · {CAP} MO</text>
          <MemoryBar geom={BAR} blocks={big} marks={holeMarks} />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 1000 440" className="h-full w-full" role="img" aria-label="Quatre stratégies d’allocation appliquées aux mêmes demandes">
        <g opacity={reqO} transform="translate(0 0)">
          <text x={30} y={46} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">DEMANDES · MÊME ORDRE</text>
          {REQ.map((pid, i) => <Chip key={pid} x={ROW_X + 190 + i * 130} y={42} text={`P${pid} · ${SIZE[pid]} Mo`} color={memColor(pid)} anchor="middle" />)}
        </g>
        <Rows progress={progress} at={at} u={u} startPhrases={START_PHRASE} />
      </svg>
    )
  },
}

const CAPTIONS: Record<Strategy, { on: string; text: string }> = {
  best: { on: 'Best Fit gaspille', text: 'peu de perte par demande, mais de minuscules trous inutilisables' },
  worst: { on: 'Worst Fit entame', text: 'entame toujours le plus grand trou' },
  first: { on: 'First Fit est rapide', text: 'rapide : s’arrête dès qu’un trou convient' },
  next: { on: 'Next Fit répartit', text: 'répartit les allocations dans toute la mémoire' },
}
const verdict: Scene = {
  id: 'verdict', title: 'Aucune stratégie n’est toujours la meilleure', duration: dur('verdict'), audio: audio('verdict'), sync: SYNC.verdict, narration: narrationOf('verdict'),
  beats: [
    { on: 'Best Fit gaspille', text: 'Chaque stratégie a ses avantages et ses limites' },
    { on: 'Ici, Best', text: 'Même mémoire, mêmes demandes : First et Best Fit échouent sur P9, pas Next ni Worst Fit' },
    { on: 'Aucune stratégie', text: 'À vous de tester d’autres demandes dans le laboratoire' },
  ],
  cues: (at) => [...cue(at, 'Ici, Best', 0.3, 'move', { gain: 0.7 }), ...cue(at, 'Aucune stratégie', 0.6, 'appear', { pitch: 5, gain: 0.8 })],
  render: ({ progress, at, actions }) => {
    const cta = fade(progress, at, 'Aucune stratégie', 0.6, 0.6)
    const hot = fade(progress, at, 'Ici, Best', 0, 0.6)
    return (
      <div className="flex h-full w-full flex-col items-center gap-1">
        <svg viewBox="0 0 1000 410" className="min-h-0 w-full flex-1" role="img" aria-label="Résultat final des quatre stratégies">
          <g>
            <text x={30} y={46} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.5)">DEMANDES · MÊME ORDRE</text>
            {REQ.map((pid, i) => <Chip key={pid} x={ROW_X + 190 + i * 130} y={42} text={`P${pid} · ${SIZE[pid]} Mo`} color={memColor(pid)} />)}
          </g>
          <Rows progress={progress} at={at} u={1} startPhrases={[null, null, null, null]} extra={(k, s, g) => {
            const final = RUNS[s].mems[REQ.length]
            const st = stats(final)
            const cap = CAPTIONS[s]
            const f = fmtFail(k, s)
            return (
              <g>
                {f ? <Chip x={ROW_X} y={g.y + g.h + 16} text={f.text} bad anchor="start" o={0.35 + 0.65 * hot} /> : <text x={ROW_X} y={g.y + g.h + 20} fontSize="12" fill={FREE} fontFamily="Geist, sans-serif" opacity={0.5 + 0.5 * hot}>✓ les 4 demandes satisfaites · plus grand trou : {st.largestFree} Mo</text>}
                <text x={ROW_X + ROW_W} y={g.y + g.h + 20} textAnchor="end" fontSize="12" fill="rgba(255,255,255,.7)" fontFamily="Geist, sans-serif" opacity={fade(progress, at, cap.on, 0, 0.6)}>{cap.text}</text>
              </g>
            )
          }} />
        </svg>
        <div className="flex shrink-0 justify-center" style={{ opacity: cta, transform: `translateY(${(1 - cta) * 10}px)`, pointerEvents: cta > 0.5 ? 'auto' : 'none' }}>
          <button onClick={actions.goExplore} className="btn-primary">Essayer le laboratoire <ArrowRight size={18} /></button>
        </div>
      </div>
    )
  },
}

export const scenes: Scene[] = [share, fixed, variable, compact, track, strategies, verdict]

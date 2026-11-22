import { useId } from 'react'
import { clamp, easeInOut, lerp } from '../lib/math'

/**
 * Changement de contexte, pas à pas — pur fonction de la « phase » `ph` (0 → ~7) :
 *
 *   0    – 1    P1 s'exécute (registres qui évoluent, données chargées/rangées)
 *   1    – 1.4  fin du quantum : interruption d'horloge
 *   1.3  – 2.1  SAUVEGARDE : les registres de P1 partent dans son PCB (mémoire du noyau)
 *   2.1  – 2.9  CHARGEMENT : le contexte de P2 est copié du PCB vers les registres
 *   2.9  – 4    P2 s'exécute et se termine
 *   5.0  – 5.9  RESTAURATION : le contexte sauvegardé de P1 revient dans les registres
 *   6    – 7    P1 repart exactement là où il s'était arrêté
 *
 * Mise en page : mémoire des processus (gauche) · processeur (centre) · PCB du noyau (droite).
 */
export const PHASE_END = 7

interface Pr { name: string; color: string; base: number; sp: number }
const P1: Pr = { name: 'P1', color: '#ff6b6b', base: 0x1000, sp: 0x7ff0 }
const P2: Pr = { name: 'P2', color: '#ffb84d', base: 0x2000, sp: 0x6ff0 }

const hex = (n: number) => '0x' + n.toString(16).toUpperCase()
const sum = (k: number) => (k * (k + 1)) / 2

// instants clés
const CLEAR = 2.08 // les registres de P1 sont libérés juste avant le chargement de P2
const SAVE0 = 1.3, LOAD0 = 2.1, RUN2 = 2.9, END2 = 4.0, REST0 = 5.0, RUN1 = 6.0, STAG = 0.1, FLY = 0.6

/** unités exécutées par P1 / P2 à la phase ph */
const k1 = (ph: number) => (ph < 6 ? 3 * clamp(ph) : 3 + 2 * clamp(ph - RUN1))
const k2 = (ph: number) => 3 * clamp((ph - RUN2) / (END2 - RUN2))

/** valeurs des registres d'un processus après `k` unités (compteur d'instructions entier) */
const regsOf = (p: Pr, k: number, isP1: boolean) => {
  const n = Math.floor(k + 1e-9)
  return [hex(p.base + 4 * n), hex(p.sp), String(isP1 ? sum(n) : 10 * n)]
}

const ROWS = ['PC', 'SP', 'ACC']
const CPU_Y = [160, 220, 280]
const PCB1_Y = [122, 158, 194] // centres des champs du PCB de P1
const PCB2_Y = [312, 348, 384]

const mono = 'Geist Mono, ui-monospace, monospace'

interface Props { ph: number; className?: string }

export function ContextSwitch({ ph, className }: Props) {
  const uid = useId().replace(/:/g, '')

  // --- état du processeur -------------------------------------------------------------------
  const arrived = (t0: number, i: number) => ph >= t0 + i * STAG + FLY
  let owner: Pr | null
  let cpuVals: (string | null)[]
  let tag: string
  if (ph < CLEAR) { owner = P1; cpuVals = regsOf(P1, k1(ph), true); tag = ph < SAVE0 ? 'exécute P1' : 'sauvegarde en cours…' }
  else if (ph < RUN2) { owner = null; cpuVals = ROWS.map((_, i) => (arrived(LOAD0, i) ? regsOf(P2, 0, false)[i] : null)); tag = 'chargement du contexte de P2…' }
  else if (ph < 4.35) { owner = P2; cpuVals = regsOf(P2, k2(ph), false); tag = ph < END2 ? 'exécute P2' : 'P2 est terminé' }
  else if (ph < 5.9) { owner = null; cpuVals = ROWS.map((_, i) => (arrived(REST0, i) ? regsOf(P1, 3, true)[i] : null)); tag = ph < REST0 ? 'le planificateur choisit P1' : 'restauration du contexte de P1…' }
  else { owner = P1; cpuVals = regsOf(P1, k1(ph), true); tag = 'exécute P1' }
  const idle = (ph >= SAVE0 && ph < RUN2) || (ph >= 4.35 && ph < 5.9)
  const irq = ph >= 1.0 && ph < 1.9
  const irqFlash = ph >= 1.0 && ph < 1.4 ? 0.5 + 0.5 * Math.sin((ph - 1.0) * 28) : 0

  // quantum : se remplit pendant l'exécution
  const quantum = owner === P1 ? (ph < 2 ? clamp(k1(ph) / 3) : clamp((k1(ph) - 3) / 3)) : owner === P2 ? clamp(k2(ph) / 3) : ph < RUN2 && ph >= CLEAR ? 0 : ph >= 4.35 && ph < 5.9 ? 0 : 0
  const quantumShown = ph >= 1.0 && ph < CLEAR ? 1 : quantum

  // --- PCB ------------------------------------------------------------------------------------
  const saved1 = regsOf(P1, 3, true) // contexte de P1 au moment de l'interruption
  const init2 = regsOf(P2, 0, false)
  const pcb1Val = (i: number) => (arrived(SAVE0, i) ? saved1[i] : null)
  const pcb1Stale = ph >= 5.9 // contexte déjà restauré
  const pcb1State = ph < CLEAR ? 'Exécution' : ph < 5.9 ? 'Prêt' : 'Exécution'
  const pcb2State = ph < RUN2 ? 'Prêt' : ph < END2 ? 'Exécution' : 'Terminé'
  const pcb2Left = (i: number) => ph >= LOAD0 + i * STAG // la valeur a été copiée vers le processeur
  const pcb2Fade = ph >= END2 ? lerp(1, 0.35, clamp((ph - END2) / 0.6)) : 1

  // --- paquets de données qui voyagent ----------------------------------------------------------
  const packets: { x: number; y: number; label: string; color: string }[] = []
  const fly = (t0: number, i: number) => easeInOut(clamp((ph - t0 - i * STAG) / FLY))
  ROWS.forEach((_, i) => {
    // sauvegarde : CPU → PCB1
    let u = fly(SAVE0, i)
    if (u > 0 && u < 1) packets.push({ x: lerp(620, 756, u), y: lerp(CPU_Y[i], PCB1_Y[i], u) - Math.sin(Math.PI * u) * 18, label: saved1[i], color: P1.color })
    // chargement de P2 : PCB2 → CPU
    u = fly(LOAD0, i)
    if (u > 0 && u < 1) packets.push({ x: lerp(756, 560, u), y: lerp(PCB2_Y[i], CPU_Y[i], u) - Math.sin(Math.PI * u) * 18, label: init2[i], color: P2.color })
    // restauration de P1 : PCB1 → CPU
    u = fly(REST0, i)
    if (u > 0 && u < 1) packets.push({ x: lerp(756, 560, u), y: lerp(PCB1_Y[i], CPU_Y[i], u) - Math.sin(Math.PI * u) * 18, label: saved1[i], color: P1.color })
  })

  // données mémoire ↔ ACC pendant l'exécution (charger puis ranger, une fois par unité)
  const dataDots: { x: number; y: number; color: string }[] = []
  const runOwner = owner && !idle ? owner : null
  if (runOwner) {
    const k = runOwner === P1 ? k1(ph) : k2(ph)
    const moving = runOwner === P1 ? ph < 1 || ph >= RUN1 : ph >= RUN2 && ph < END2
    if (moving) {
      const f = k - Math.floor(k)
      const memY = runOwner === P1 ? 144 : 334
      const a = { x: 270, y: memY }, b = { x: 440, y: 280 }
      const u = f < 0.5 ? easeInOut(f * 2) : 1 - easeInOut((f - 0.5) * 2)
      dataDots.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), color: runOwner.color })
    }
  }

  // --- données en mémoire des processus -------------------------------------------------------------
  const n1 = Math.floor(k1(ph) + 1e-9), n2 = Math.floor(k2(ph) + 1e-9)
  const mem1 = [['i', String(n1)], ['somme', String(sum(n1))]]
  const mem2 = [['n', '3'], ['res', String(10 * n2)]]

  return (
    <svg viewBox="0 0 1000 440" className={className} role="img" aria-label="Sauvegarde et restauration du contexte d'un processus">
      <defs>
        <linearGradient id={`${uid}-cpu`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#262a4a" /><stop offset="1" stopColor="#12142a" /></linearGradient>
      </defs>

      {/* ---------- Mémoire des processus (gauche) ---------- */}
      <text x={24} y={30} className="fill-white/45" fontSize="11.5" letterSpacing="2.2" fontFamily={mono}>MÉMOIRE DES PROCESSUS</text>
      {[{ p: P1, y: 44, vars: mem1, sp: P1.sp, on: owner === P1 }, { p: P2, y: 234, vars: mem2, sp: P2.sp, on: owner === P2 }].map(({ p, y, vars, sp, on }) => (
        <g key={p.name} opacity={p === P2 && ph >= END2 ? lerp(1, 0.4, clamp((ph - END2) / 0.6)) : 1}>
          <rect x={24} y={y} width={276} height={170} rx={20} fill="rgba(255,255,255,.035)" stroke={on ? p.color : 'rgba(255,255,255,.12)'} strokeWidth={on ? 1.8 : 1} />
          <circle cx={46} cy={y + 26} r={5} fill={p.color} />
          <text x={58} y={y + 30} fill="#fff" fontSize="14" fontWeight="600" fontFamily="Geist, sans-serif">Mémoire de {p.name}</text>
          {/* pile */}
          <text x={44} y={y + 62} className="fill-white/40" fontSize="10.5" letterSpacing="1.6" fontFamily={mono}>PILE</text>
          {[0, 1, 2].map((r) => (
            <rect key={r} x={44} y={y + 70 + r * 24} width={62} height={20} rx={5} fill={r === 0 ? `${p.color}33` : 'rgba(255,255,255,.05)'} stroke={r === 0 ? p.color : 'rgba(255,255,255,.12)'} />
          ))}
          <text x={112} y={y + 84} fill={p.color} fontSize="10.5" fontFamily={mono}>◀ SP</text>
          <text x={44} y={y + 156} className="fill-white/35" fontSize="10" fontFamily={mono}>{hex(sp)}</text>
          {/* variables */}
          <text x={150} y={y + 62} className="fill-white/40" fontSize="10.5" letterSpacing="1.6" fontFamily={mono}>DONNÉES</text>
          {vars.map(([name, val], r) => (
            <g key={name}>
              <text x={150} y={y + 90 + r * 36} fill="rgba(238,240,255,.7)" fontSize="13" fontFamily={mono}>{name}</text>
              <rect x={208} y={y + 72 + r * 36} width={72} height={26} rx={7} fill="#161830" stroke="rgba(255,255,255,.14)" />
              <text x={244} y={y + 90 + r * 36} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="600" fontFamily={mono}>{val}</text>
            </g>
          ))}
        </g>
      ))}

      {/* ---------- Processeur (centre) ---------- */}
      <g>
        <rect x={350} y={44} width={300} height={360} rx={26} fill={`url(#${uid}-cpu)`} stroke={owner ? owner.color : 'rgba(255,255,255,.2)'} strokeWidth={owner ? 1.8 : 1.2} />
        <g stroke="rgba(255,255,255,.22)" strokeWidth="3" strokeLinecap="round">
          {[120, 160, 200, 240, 280, 320].map((o) => (<g key={o}><path d={`M${350} ${o} h-10`} /><path d={`M${650} ${o} h10`} /></g>))}
        </g>
        <text x={500} y={74} textAnchor="middle" className="fill-white/55" fontSize="11.5" letterSpacing="2.4" fontFamily={mono}>PROCESSEUR</text>
        <g transform="translate(500 98)">
          <circle cx={-64} cy={0} r={5} fill={owner ? owner.color : 'rgba(255,255,255,.25)'} />
          <text x={-52} y={4} fill="rgba(238,240,255,.85)" fontSize="13" fontFamily={mono}>{tag}</text>
        </g>
        {/* registres */}
        <text x={380} y={134} className="fill-white/40" fontSize="10.5" letterSpacing="1.6" fontFamily={mono}>REGISTRES</text>
        {ROWS.map((r, i) => (
          <g key={r}>
            <text x={380} y={CPU_Y[i] + 5} fill="rgba(238,240,255,.65)" fontSize="13" fontWeight="600" fontFamily={mono}>{r}</text>
            <rect x={440} y={CPU_Y[i] - 20} width={180} height={40} rx={10} fill="#0e1021" stroke={cpuVals[i] ? (owner?.color ?? '#8b7bff') : 'rgba(255,255,255,.12)'} strokeWidth={cpuVals[i] ? 1.6 : 1} strokeDasharray={cpuVals[i] ? undefined : '3 5'} />
            <text x={530} y={CPU_Y[i] + 6} textAnchor="middle" fill={cpuVals[i] ? '#fff' : 'rgba(255,255,255,.25)'} fontSize="17" fontWeight="600" fontFamily={mono}>{cpuVals[i] ?? '—'}</text>
          </g>
        ))}
        <text x={380} y={316} className="fill-white/35" fontSize="10.5" fontFamily={mono}>PC = prochaine instruction · SP = sommet de pile</text>
        {/* quantum */}
        <text x={380} y={352} className="fill-white/40" fontSize="10.5" letterSpacing="1.6" fontFamily={mono}>QUANTUM</text>
        <rect x={470} y={344} width={150} height={8} rx={4} fill="rgba(255,255,255,.1)" />
        <rect x={470} y={344} width={150 * quantumShown} height={8} rx={4} fill={owner?.color ?? (ph < 2 ? P1.color : '#8b7bff')} />
        {/* coût du changement de contexte */}
        <text x={500} y={387} textAnchor="middle" fill="#ffb84d" fontSize="12" fontFamily={mono} opacity={idle ? 1 : 0}>CPU inactif : aucun travail utile</text>
        {/* interruption d'horloge */}
        <g transform="translate(618 70)" opacity={irq ? 1 : 0}>
          <circle r={15} fill="#ffb84d" opacity={0.15 + 0.35 * irqFlash} />
          <path d="M0 -9 L-6 2 L0 2 L-2 10 L7 -3 L1 -3 Z" fill="#ffb84d" />
        </g>
        <text x={632} y={122} textAnchor="end" fill="#ffb84d" fontSize="10.5" letterSpacing="1.2" fontFamily={mono} opacity={irq ? 1 : 0}>INTERRUPTION D’HORLOGE</text>
      </g>

      {/* ---------- PCB du noyau (droite) ---------- */}
      <text x={690} y={30} className="fill-white/45" fontSize="11.5" letterSpacing="2.2" fontFamily={mono}>MÉMOIRE DU NOYAU · PCB</text>
      {[
        { p: P1, y: 44, rows: PCB1_Y, state: pcb1State, val: (i: number) => pcb1Val(i), stale: pcb1Stale, op: 1 },
        { p: P2, y: 234, rows: PCB2_Y, state: pcb2State, val: (i: number) => init2[i], stale: false, op: pcb2Fade },
      ].map(({ p, y, rows, state, val, stale, op }) => (
        <g key={p.name} opacity={op}>
          <rect x={690} y={y} width={286} height={170} rx={20} fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.12)" />
          <circle cx={712} cy={y + 26} r={5} fill={p.color} />
          <text x={724} y={y + 30} fill="#fff" fontSize="14" fontWeight="600" fontFamily="Geist, sans-serif">PCB de {p.name}</text>
          <g transform={`translate(956 ${y + 26})`}>
            <rect x={-82} y={-12} width={82} height={24} rx={12} fill={state === 'Exécution' ? 'rgba(94,234,212,.16)' : state === 'Prêt' ? 'rgba(255,184,77,.16)' : 'rgba(255,255,255,.08)'} stroke={state === 'Exécution' ? 'rgba(94,234,212,.5)' : state === 'Prêt' ? 'rgba(255,184,77,.5)' : 'rgba(255,255,255,.2)'} />
            <text x={-41} y={4} textAnchor="middle" fill="#eef0ff" fontSize="11.5" fontFamily={mono}>{state}</text>
          </g>
          {ROWS.map((r, i) => {
            const v = p === P1 ? val(i) : pcb2Left(i) ? val(i) : val(i)
            const dim = p === P1 ? stale : p === P2 ? pcb2Left(i) : false
            return (
              <g key={r}>
                <text x={710} y={rows[i] + 5} fill="rgba(238,240,255,.65)" fontSize="13" fontWeight="600" fontFamily={mono}>{r}</text>
                <rect x={754} y={rows[i] - 15} width={202} height={30} rx={8} fill="#0e1021" stroke={v ? p.color : 'rgba(255,255,255,.12)'} strokeOpacity={dim ? 0.35 : 1} strokeDasharray={v ? undefined : '3 5'} />
                <text x={855} y={rows[i] + 5} textAnchor="middle" fill={v ? '#fff' : 'rgba(255,255,255,.25)'} fillOpacity={dim ? 0.4 : 1} fontSize="14" fontWeight="600" fontFamily={mono}>{v ?? '—'}</text>
              </g>
            )
          })}
          {p === P2 && ph >= END2 && <text x={833} y={y + 160} textAnchor="middle" className="fill-white/45" fontSize="10.5" fontFamily={mono}>processus terminé · PCB libéré</text>}
          {p === P1 && ph >= SAVE0 + 0.9 && ph < 5.9 && <text x={833} y={y + 160} textAnchor="middle" className="fill-white/45" fontSize="10.5" fontFamily={mono}>contexte sauvegardé</text>}
        </g>
      ))}

      {/* ---------- éléments qui voyagent ---------- */}
      {dataDots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={6} fill={d.color} />)}
      {packets.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <rect x={-30} y={-12} width={60} height={24} rx={8} fill={p.color} />
          <text y={5} textAnchor="middle" fill="#0b0d17" fontSize="12" fontWeight="700" fontFamily={mono}>{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

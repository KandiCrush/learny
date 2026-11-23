import { Globe, HardDrive, MousePointer2 } from 'lucide-react'
import { clamp, easeOut, lerp } from '../../lib/math'
import type { PhraseAt } from '../../lib/clock'

/**
 * Scène 1 : un programme (fichier passif sur le disque) devient un processus (programme + vie en mémoire).
 * Pure fonction de `progress` : chaque étape démarre quand la voix dit son expression (`at`).
 */
const BARS = [74, 118, 92, 136, 64, 104]
const GREEN = '#5eead4'
const GREY = '#9aa0c8'

function Code({ x, y, w, pc, tone }: { x: number; y: number; w: number; pc?: number; tone: string }) {
  return (
    <g>
      {BARS.map((b, i) => (
        <g key={i}>
          <rect x={x + 22} y={y + i * 17} width={Math.min(b, w - 30)} height={7} rx={3.5} fill={tone} opacity={pc === i ? 0.95 : 0.35} />
          {pc === i && <path d={`M${x + 4} ${y + i * 17 - 1} l10 4.5 l-10 4.5 z`} fill={GREEN} />}
        </g>
      ))}
    </g>
  )
}

function Process({ x, y, o, name, t, phase }: { x: number; y: number; o: number; name: string; t: number; phase: number }) {
  const pc = Math.floor(t * 2.2 + phase) % BARS.length // compteur de programme : avance de ligne en ligne, propre à chaque processus
  const cells = [0, 1, 2, 3].map((i) => (Math.floor(t * 1.1 + phase * 3 + i * 2) * 7 + i * 13 + Math.round(phase * 10)) % 90 + 10)
  return (
    <g transform={`translate(${x} ${y + (1 - o) * 30})`} opacity={o}>
      <rect width={250} height={290} rx={22} fill="#12142a" stroke={GREEN} strokeOpacity=".65" strokeWidth="1.8" />
      <rect width={250} height={290} rx={22} fill={GREEN} opacity=".05" />
      <text x={20} y={30} fontSize="11.5" letterSpacing="2" fontFamily="Geist Mono, monospace" fill={GREEN}>PROCESSUS</text>
      <circle cx={226} cy={25} r={5} fill={GREEN} className="cpu-pulse" />
      <text x={20} y={54} fontSize="16" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{name}</text>

      <text x={20} y={86} fontSize="10.5" letterSpacing="1.6" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.45)">CODE + COMPTEUR ▸</text>
      <Code x={20} y={98} w={210} pc={pc} tone="#fff" />

      <text x={20} y={222} fontSize="10.5" letterSpacing="1.6" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.45)">DONNÉES</text>
      {cells.map((c, i) => (
        <g key={i} transform={`translate(${20 + i * 52} 232)`}>
          <rect width={44} height={22} rx={7} fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.16)" />
          <text x={22} y={15} textAnchor="middle" fontSize="12" fontFamily="Geist Mono, monospace" fill="#fff">{c}</text>
        </g>
      ))}
      <g transform="translate(20 264)">
        <rect width={64} height={18} rx={9} fill="rgba(167,139,250,.16)" stroke="rgba(167,139,250,.6)" />
        <text x={32} y={12.5} textAnchor="middle" fontSize="10.5" fontFamily="Geist Mono, monospace" fill="#c4b5fd">PCB ✓</text>
      </g>
    </g>
  )
}

export function ProgramVsProcess({ progress, at }: { progress: number; at: PhraseAt }) {
  const ph = (p: string, len = 0.05, off = 0) => easeOut(clamp((progress - (at(p, off) ?? 9)) / len))
  const disk = ph('Sur votre disque', 0.05)
  const passive = ph('Il ne fait rien', 0.04)
  const click = at('Double-cliquez') ?? 9
  const load = clamp((progress - (at('Double-cliquez', 0.4) ?? 9)) / 0.1) // copie du fichier vers la mémoire
  const proc = ph('Un processus est', 0.05)
  const second = ph('Lancez-le', 0.05)
  const recipe = ph("Le programme, c'est", 0.05)
  const t = progress * 40 // « horloge » des processus vivants

  const cursorK = clamp((progress - click) / 0.04)
  const cursorOn = progress >= click - 0.01 && progress < click + 0.1
  const pkt = easeOut(load)
  const px = lerp(250, 430, pkt), py = lerp(222, 222, pkt)

  return (
    <svg viewBox="0 0 1000 440" className="h-full w-full" role="img" aria-label="Un programme sur le disque devient un processus en mémoire">
      {/* DISQUE */}
      <g opacity={disk} transform={`translate(0 ${(1 - disk) * 16})`}>
        <rect x={24} y={60} width={300} height={340} rx={26} fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.14)" strokeDasharray="3 7" />
        <HardDrive x={44} y={78} width={20} height={20} color="rgba(255,255,255,.55)" />
        <text x={74} y={93} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.55)">DISQUE</text>

        <g transform="translate(64 138)" opacity={lerp(1, 0.55, passive)}>
          <rect width={220} height={170} rx={18} fill="#14162b" stroke={GREY} strokeOpacity=".6" strokeWidth="1.6" />
          <Globe x={18} y={16} width={26} height={26} color="#fff" strokeWidth={1.7} />
          <text x={54} y={36} fontSize="15" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">navigateur</text>
          <Code x={18} y={64} w={190} tone={GREY} />
        </g>
        <text x={174} y={344} textAnchor="middle" fontSize="12.5" letterSpacing="2" fontFamily="Geist Mono, monospace" fill={GREY}>PROGRAMME</text>
        <text x={174} y={366} textAnchor="middle" fontSize="13" fill="rgba(255,255,255,.55)" fontFamily="Geist, sans-serif" opacity={passive}>passif : il ne « fait » rien</text>
        <text x={256} y={134} fontSize="22" fill="rgba(255,255,255,.45)" fontFamily="Geist Mono, monospace" opacity={passive} className="cpu-pulse">z z z</text>
      </g>

      {/* MÉMOIRE */}
      <g opacity={disk}>
        <rect x={376} y={60} width={600} height={340} rx={26} fill="rgba(94,234,212,.03)" stroke="rgba(94,234,212,.22)" strokeDasharray="3 7" />
        <text x={398} y={88} fontSize="11.5" letterSpacing="2.2" fontFamily="Geist Mono, monospace" fill={GREEN} opacity=".8">MÉMOIRE · LE PROGRAMME PREND VIE</text>
      </g>
      <Process x={400} y={100} o={easeOut(clamp(proc * 1.4))} name="navigateur #1" t={t} phase={0} />
      <Process x={690} y={100} o={second} name="navigateur #2" t={t} phase={0.37} />

      {/* chargement : le fichier est copié en mémoire */}
      {load > 0 && load < 1 && (
        <g transform={`translate(${px} ${py})`} opacity={1 - clamp((load - 0.85) / 0.15)}>
          <rect x={-26} y={-30} width={52} height={60} rx={11} fill="#14162b" stroke="#fff" strokeOpacity=".7" strokeWidth="1.6" />
          <Globe x={-11} y={-12} width={22} height={22} color="#fff" />
        </g>
      )}
      <path d="M296 222 H 392" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeDasharray="2 6" opacity={load > 0 ? 1 : 0} />

      {/* curseur de double-clic */}
      {cursorOn && (
        <g transform={`translate(${lerp(300, 214, cursorK)} ${lerp(330, 244, cursorK)})`} opacity={clamp(cursorK * 4)}>
          <circle r={18 * cursorK} fill="none" stroke="#fff" strokeOpacity={0.5 * (1 - cursorK)} strokeWidth="2" />
          <MousePointer2 width={26} height={26} color="#fff" fill="#0b0d17" />
        </g>
      )}

      {/* analogie recette / cuisinier */}
      <g opacity={recipe} transform={`translate(0 ${(1 - recipe) * 10})`}>
        <rect x={24} y={408} width={952} height={26} rx={13} fill="rgba(255,255,255,.04)" />
        <text x={174} y={426} textAnchor="middle" fontSize="13" fill={GREY} fontFamily="Geist, sans-serif">programme = la recette</text>
        <text x={640} y={426} textAnchor="middle" fontSize="13" fill={GREEN} fontFamily="Geist, sans-serif">processus = le cuisinier en train de la réaliser</text>
      </g>
    </svg>
  )
}

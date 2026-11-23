import { ArrowRight, Check, Clock, Cpu, Lock, ShieldAlert, ShieldCheck, TriangleAlert, Wallet, X } from 'lucide-react'
import type { PhraseAt } from '../../lib/clock'
import { type Machine, type EvKind } from '../../lib/concurrency'
import { lerp } from '../../lib/math'
import { procColor } from '../../components/ConcurrencyBoard'
import { STATE_COLOR } from '../../components/LifecycleStage'
import { fade, move } from './scripts'

const KIND: Record<EvKind, string> = { read: 'lit', calc: 'calcule', write: 'écrit', acquire: 'obtient', refuse: 'échoue', release: 'libère', block: 'se bloque', wake: 'réveille', use: 'utilise', test: 'voit 0' }

/** Chronologie : les dernières instructions exécutées, dans l'ordre — montre l'entrelacement des processus */
export function EventStrip({ m }: { m: Machine }) {
  const items = m.log.slice(-9)
  return (
    <div className="flex min-h-[28px] flex-wrap items-center justify-center gap-1.5 text-[12px]" aria-label="Instructions exécutées, dans l’ordre">
      {m.log.length === 0 && <span className="text-white/35">aucune instruction exécutée</span>}
      {items.map((e, i) => (
        <span key={e.tick} className="flex items-center gap-1.5" style={{ opacity: 0.55 + 0.45 * (i / Math.max(1, items.length - 1)) }}>
          {i > 0 && <ArrowRight size={11} className="text-white/30" aria-hidden />}
          <span className="rounded-full border px-2 py-0.5 font-display" style={{ borderColor: `${procColor(e.pid)}99`, background: `${procColor(e.pid)}1f` }}>
            <span className="text-white/45">{e.tick}</span> P{e.pid} {KIND[e.kind]}
          </span>
        </span>
      ))}
    </div>
  )
}

/** P(mutex) → section critique → V(mutex), avec l'étape en cours en surbrillance */
export function SeqStrip({ active, labels = ['P(mutex)', 'Section critique', 'V(mutex)'] }: { active: number; labels?: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[12.5px]" role="img" aria-label={labels.join(', ')}>
      {labels.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && <ArrowRight size={13} className="text-white/35" aria-hidden />}
          <span className="rounded-full border px-3 py-1 font-display transition-colors" style={{ borderColor: i === active ? 'var(--mint)' : 'rgba(255,255,255,.14)', background: i === active ? 'rgba(94,234,212,.16)' : 'rgba(255,255,255,.04)', color: i === active ? '#fff' : 'rgba(255,255,255,.55)' }}>{l}</span>
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scène 2 — la zone protégée                                          */
/* ------------------------------------------------------------------ */
const A = procColor(1), B = procColor(2), C = procColor(3)

function Token({ x, y, color, name, o = 1, dim, mark }: { x: number; y: number; color: string; name: string; o?: number; dim?: boolean; mark?: 'wait' | 'ok' }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={o * (dim ? 0.55 : 1)}>
      <rect x={-30} y={-30} width={60} height={60} rx={14} fill="#161830" />
      <rect x={-30} y={-30} width={60} height={60} rx={14} fill={color} opacity=".22" />
      <rect x={-30} y={-30} width={60} height={60} rx={14} fill="none" stroke={color} strokeWidth="1.8" />
      <text y={7} textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{name}</text>
      {mark === 'wait' && <text y={52} textAnchor="middle" fontSize="12" fill={STATE_COLOR.blocked} fontFamily="Geist, sans-serif">attend</text>}
      {mark === 'ok' && <text y={52} textAnchor="middle" fontSize="12" fill={STATE_COLOR.running} fontFamily="Geist, sans-serif">passe</text>}
    </g>
  )
}

const PROPS = ['Un seul processus à la fois dans la section critique', 'Qui n’utilise pas la ressource ne bloque pas les autres', 'Section libre : quelqu’un peut entrer, le système progresse', 'Aucun privilège arbitraire']
const PROP_AT = ['Un seul processus à la fois', "Un processus qui n'utilise", 'Si la section est libre', "Et personne n'a"]

export function CriticalZone({ progress, at }: { progress: number; at: PhraseAt }) {
  const zone = fade(progress, at, 'Le compte est', 0, 0.8)
  const crit = fade(progress, at, 'Le code qui y accède', 0, 0.8)
  const p1in = move(progress, at, "L'exclusion mutuelle", 0.6, 1.1)       // P1 entre
  const p3 = fade(progress, at, "Un processus qui n'utilise", 0, 0.7)
  const swap = move(progress, at, 'Si la section est libre', 0.1, 1.3)    // P1 sort, P2 entre
  const arrive = fade(progress, at, "L'exclusion mutuelle", 0, 0.8)
  const props = fade(progress, at, 'Quatre propriétés', 0, 0.6)
  const schema = fade(progress, at, 'Schéma constant', 0, 0.8)
  const doorClosed = p1in > 0.9 && swap < 0.1

  // P1 : file (130,170) → zone (500,200) → sortie (830,200) ; P2 : file (130,290) → porte (270,290) → zone (500,200)
  const p1x = lerp(lerp(130, 440, p1in), 640, swap), p1y = lerp(lerp(170, 200, p1in), 200, swap)
  const p2x = lerp(lerp(130, 236, move(progress, at, "L'exclusion mutuelle", 0.9, 1.0)), 440, swap), p2y = lerp(lerp(290, 250, move(progress, at, "L'exclusion mutuelle", 0.9, 1.0)), 200, swap)

  return (
    <svg viewBox="0 0 1000 440" className="h-full w-full" role="img" aria-label="Deux processus devant une zone protégée : un seul y entre à la fois">
      <g opacity={zone}>
        <rect x={300} y={70} width={280} height={260} rx={28} fill={crit > 0.5 ? 'rgba(255,184,77,.07)' : 'rgba(255,255,255,.03)'} stroke={crit > 0.5 ? '#ffb84d' : 'rgba(255,255,255,.2)'} strokeWidth="2" strokeDasharray={crit > 0.5 ? undefined : '4 7'} />
        <Wallet x={322} y={90} width={24} height={24} color="rgba(255,255,255,.7)" />
        <text x={356} y={108} fontSize="12" letterSpacing="2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.6)">LE COMPTE (RESSOURCE)</text>
        <text x={440} y={316} textAnchor="middle" fontSize="12" letterSpacing="2" fontFamily="Geist Mono, monospace" fill="#ffb84d" opacity={crit}>SECTION CRITIQUE</text>
        {/* porte */}
        <g transform="translate(300 250)" opacity={arrive}>
          <rect x={-5} y={-34} width={10} height={68} rx={5} fill={doorClosed ? STATE_COLOR.blocked : STATE_COLOR.running} opacity=".9" />
          <text x={-18} y={-44} textAnchor="end" fontSize="11.5" fill={doorClosed ? STATE_COLOR.blocked : STATE_COLOR.running} fontFamily="Geist Mono, monospace">{doorClosed ? 'OCCUPÉ' : 'LIBRE'}</text>
        </g>
      </g>

      <Token x={p1x} y={p1y} color={A} name="P1" o={arrive} mark={p1in > 0.9 && swap < 0.1 ? 'ok' : undefined} />
      <Token x={p2x} y={p2y} color={B} name="P2" o={arrive} mark={doorClosed ? 'wait' : undefined} />
      <g opacity={p3}><Token x={130} y={380} color={C} name="P3" dim /><text x={176} y={375} fontSize="12" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">n’a pas besoin</text><text x={176} y={392} fontSize="12" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">de la ressource</text></g>

      {/* propriétés recherchées */}
      <g transform="translate(715 70)" opacity={props}>
        {PROPS.map((t, i) => {
          const on = fade(progress, at, PROP_AT[i], 0, 0.5)
          return (
            <g key={i} transform={`translate(0 ${i * 66})`} opacity={0.35 + 0.65 * on}>
              <circle cx={12} cy={14} r={11} fill={on > 0.5 ? 'rgba(94,234,212,.2)' : 'transparent'} stroke={on > 0.5 ? STATE_COLOR.running : 'rgba(255,255,255,.3)'} strokeWidth="1.5" />
              {on > 0.5 && <Check x={5} y={7} width={14} height={14} color={STATE_COLOR.running} strokeWidth={3} />}
              <foreignObject x={32} y={0} width={250} height={60}><div className="text-[12.5px] leading-snug text-white/80">{t}</div></foreignObject>
            </g>
          )
        })}
      </g>

      {/* schéma entrée → section critique → sortie */}
      <g transform="translate(0 368)" opacity={schema}>
        {['ENTRÉE', 'SECTION CRITIQUE', 'SORTIE'].map((t, i) => (
          <g key={t} transform={`translate(${290 + i * 150} 0)`}>
            {i > 0 && <path d="M-26 22 h18 m-6 -5 l6 5 l-6 5" stroke="rgba(255,255,255,.4)" strokeWidth="2" fill="none" strokeLinecap="round" />}
            <rect width={118} height={44} rx={14} fill={i === 1 ? 'rgba(255,184,77,.14)' : 'rgba(255,255,255,.05)'} stroke={i === 1 ? '#ffb84d' : 'rgba(255,255,255,.2)'} />
            <text x={59} y={27} textAnchor="middle" fontSize="11" letterSpacing="1.2" fontFamily="Geist Mono, monospace" fill="#fff">{t}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Scène 4 — masquer les interruptions                                 */
/* ------------------------------------------------------------------ */
function Core({ x, y, label, masked, busy, color }: { x: number; y: number; label: string; masked: number; busy: string; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-85} y={-60} width={170} height={120} rx={24} fill="#12142a" stroke="rgba(255,255,255,.22)" strokeWidth="1.6" />
      <Cpu x={-70} y={-48} width={18} height={18} color="rgba(255,255,255,.6)" />
      <text x={-46} y={-34} fontSize="11.5" letterSpacing="1.8" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.6)">{label}</text>
      <rect x={-34} y={-14} width={68} height={44} rx={12} fill={`${color}33`} stroke={color} strokeWidth="1.6" />
      <text y={14} textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{busy}</text>
      {masked > 0 && (
        <g opacity={masked} transform="translate(60 -62)">
          <circle r={19} fill="#0e2a26" stroke={STATE_COLOR.running} strokeWidth="2" />
          <ShieldCheck x={-11} y={-11} width={22} height={22} color={STATE_COLOR.running} />
        </g>
      )}
    </g>
  )
}

export function IrqScene({ progress, at }: { progress: number; at: PhraseAt }) {
  const mask = fade(progress, at, 'Le processeur ignore', 0, 0.6)
  const danger = fade(progress, at, "Mais c'est", 0, 0.8)
  const multi = fade(progress, at, 'Avec plusieurs processeurs', 0, 0.9)
  const kernel = fade(progress, at, "C'est un outil", 0, 0.7)
  const t = progress * 30
  // tics d'horloge : des flèches qui arrivent sur le cœur A, rebondissent une fois masquées
  const tick = (i: number) => (t * 0.9 + i * 0.5) % 1.5
  const blocked = mask > 0.5

  return (
    <svg viewBox="0 0 1000 440" className="h-full w-full" role="img" aria-label="Masquer les interruptions protège un cœur, pas la ressource partagée entre plusieurs cœurs">
      {/* horloge */}
      <g transform="translate(110 170)">
        <circle r={36} fill="#12142a" stroke="rgba(255,255,255,.25)" strokeWidth="1.6" />
        <Clock x={-16} y={-16} width={32} height={32} color="#fff" strokeWidth={1.7} />
        <text y={62} textAnchor="middle" fontSize="11.5" letterSpacing="2" fontFamily="Geist Mono, monospace" fill="rgba(255,255,255,.55)">HORLOGE</text>
      </g>
      {[0, 1].map((i) => {
        const u = tick(i) / 1.5
        const stop = blocked ? 0.62 : 1
        const x = lerp(160, 252, Math.min(u, stop) )
        const fadeOut = blocked && u > 0.62 ? 1 - Math.min(1, (u - 0.62) / 0.12) : 1
        return (
          <g key={i} opacity={fadeOut}>
            <path d={`M${x - 26} ${170} h26 m-7 -6 l7 6 l-7 6`} stroke={blocked ? STATE_COLOR.blocked : '#ffb84d'} strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        )
      })}
      {blocked && <g transform="translate(236 170)" opacity={mask}><circle r={11} fill="#2a0f16" stroke={STATE_COLOR.blocked} /><X x={-6} y={-6} width={12} height={12} color={STATE_COLOR.blocked} strokeWidth={3} /></g>}

      <Core x={340} y={170} label="CŒUR A" masked={mask} busy="P1" color={A} />
      <text x={340} y={256} textAnchor="middle" fontSize="12.5" fill={blocked ? STATE_COLOR.running : 'rgba(255,255,255,.5)'} fontFamily="Geist, sans-serif" opacity={mask}>interruptions masquées : P1 n’est plus interrompu</text>

      {/* risque : oubli de réactiver */}
      <g opacity={danger} transform="translate(340 318)">
        <rect x={-190} y={-26} width={380} height={52} rx={16} fill="rgba(255,107,107,.1)" stroke={STATE_COLOR.blocked} strokeOpacity=".7" />
        <ShieldAlert x={-174} y={-12} width={24} height={24} color={STATE_COLOR.blocked} />
        <text x={-140} y={-3} fontSize="13" fontWeight="600" fill="#fff" fontFamily="Geist, sans-serif">Un programme oublie de réactiver</text>
        <text x={-140} y={15} fontSize="12.5" fill="rgba(255,255,255,.65)" fontFamily="Geist, sans-serif">les interruptions : plus de changement, le système se fige</text>
      </g>

      {/* plusieurs processeurs */}
      <g opacity={multi}>
        <Core x={760} y={170} label="CŒUR B" masked={0} busy="P2" color={B} />
        <rect x={600} y={330} width={300} height={70} rx={20} fill="rgba(255,255,255,.04)" stroke="#ffb84d" strokeWidth="1.8" />
        <Wallet x={622} y={352} width={24} height={24} color="rgba(255,255,255,.7)" />
        <text x={660} y={370} fontSize="12" letterSpacing="1.6" fontFamily="Geist Mono, monospace" fill="#ffb84d">RESSOURCE PARTAGÉE</text>
        <path d="M760 232 V322" stroke={B} strokeWidth="3" strokeDasharray="6 6" fill="none" />
        <path d="M420 200 C 520 300, 560 340, 600 360" stroke={A} strokeWidth="3" strokeDasharray="6 6" fill="none" />
        <g transform="translate(700 330)"><circle r={15} fill="#2a0f16" stroke={STATE_COLOR.blocked} strokeWidth="2" /><TriangleAlert x={-9} y={-9} width={18} height={18} color={STATE_COLOR.blocked} /></g>
        <text x={780} y={296} fontSize="12.5" fill={STATE_COLOR.blocked} fontFamily="Geist, sans-serif">B accède quand même à la ressource</text>
      </g>

      <g opacity={kernel} transform="translate(500 400)">
        <rect x={-190} y={-18} width={380} height={34} rx={17} fill="rgba(139,123,255,.18)" stroke="var(--accent)" />
        <Lock x={-176} y={-9} width={16} height={16} color="#fff" />
        <text x={-152} y={5} fontSize="12.5" fill="#fff" fontFamily="Geist Mono, monospace">réservé au noyau, pour de très courts instants</text>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Scène 9 — comparaison                                               */
/* ------------------------------------------------------------------ */
const ROWS: { name: string; at: string; ok: boolean; wait: string; cpu: string; cpuColor: string; use: string; color: string }[] = [
  { name: 'Sans protection', at: 'Sans protection', ok: false, wait: 'aucune', cpu: '—', cpuColor: 'rgba(255,255,255,.5)', use: 'à éviter dès qu’une ressource est partagée', color: STATE_COLOR.blocked },
  { name: 'Spinlock (TAS)', at: 'Spinlock', ok: true, wait: 'active : boucle sur le CPU', cpu: 'gaspillé', cpuColor: STATE_COLOR.blocked, use: 'attentes très courtes', color: '#ffb84d' },
  { name: 'Mutex bloquant', at: 'Mutex bloquant', ok: true, wait: 'bloquante : file d’attente', cpu: 'économe', cpuColor: STATE_COLOR.running, use: 'un seul accès, avec propriétaire', color: STATE_COLOR.running },
  { name: 'Sémaphore binaire', at: 'Sémaphore binaire', ok: true, wait: 'bloquante : file d’attente', cpu: 'économe', cpuColor: STATE_COLOR.running, use: 'un seul accès, sans propriétaire', color: STATE_COLOR.ready },
  { name: 'Sémaphore de comptage', at: 'Sémaphore de comptage', ok: true, wait: 'bloquante : file d’attente', cpu: 'économe', cpuColor: STATE_COLOR.running, use: 'N exemplaires d’une ressource', color: '#a78bfa' },
]

export function CompareTable({ progress, at }: { progress: number; at: PhraseAt }) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1.5" role="table" aria-label="Comparaison des mécanismes">
      <div className="hidden grid-cols-[1.25fr_.6fr_1.3fr_.8fr_1.4fr] gap-3 px-4 text-[11px] uppercase tracking-widest text-white/40 md:grid" role="row">
        <span>Approche</span><span>Résultat</span><span>Attente</span><span>CPU</span><span>Convient pour</span>
      </div>
      {ROWS.map((r) => {
        const o = fade(progress, at, r.at, 0, 0.6)
        return (
          <div key={r.name} role="row" className="grid items-center gap-x-3 gap-y-0.5 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-1.5 text-[13px] md:grid-cols-[1.25fr_.6fr_1.3fr_.8fr_1.4fr]" style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)`, borderLeft: `3px solid ${r.color}` }}>
            <b className="font-display text-[13.5px]" role="cell">{r.name}</b>
            <span role="cell" className="flex items-center gap-1.5" style={{ color: r.ok ? STATE_COLOR.running : STATE_COLOR.blocked }}>{r.ok ? <Check size={14} /> : <X size={14} />}{r.ok ? 'correct' : 'faux'}</span>
            <span role="cell" className="text-white/70">{r.wait}</span>
            <span role="cell" style={{ color: r.cpuColor }}>{r.cpu}</span>
            <span role="cell" className="text-white/60">{r.use}</span>
          </div>
        )
      })}
    </div>
  )
}

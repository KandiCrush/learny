import { Lock, LockOpen, TriangleAlert, Check, X } from 'lucide-react'
import { type CProc, type Machine, type Op, csLimit, csRange, expected, finished, inCS, ops } from '../lib/concurrency'
import { clamp } from '../lib/math'
import { reducedMotion } from '../lib/motion'
import { STATE_COLOR } from './LifecycleStage'

/**
 * Tableau de la leçon « Exclusion mutuelle » : dessine UNE machine (src/lib/concurrency.ts) — processus et leur code,
 * verrou / sémaphore / file, solde partagé, coût CPU. Les scènes et le laboratoire l'utilisent tous les deux :
 * tout ce qu'on voit vient de l'état du moteur, rien n'est dessiné « à la main ».
 */
export const PROC_COLORS = ['#ffb84d', '#f472b6', '#a78bfa', '#c4f06b', '#fb923c']
export const procColor = (id: number) => PROC_COLORS[(id - 1) % PROC_COLORS.length]

const CHIP: Record<CProc['state'], [string, string]> = {
  ready: ['Prêt', STATE_COLOR.ready], running: ['Élu', STATE_COLOR.running], blocked: ['Bloqué', STATE_COLOR.blocked], done: ['Terminé', STATE_COLOR.terminated],
}
const MONO = 'Geist Mono, monospace'

export const opLabel = (op: Op, p: CProc, printers: boolean): string => ({
  lire: 'tmp ← solde', calc: `tmp ← tmp − ${p.amount}`, ecrire: 'solde ← tmp', tas: 'TAS(verrou)', test: 'attendre verrou = 0', set: 'verrou ← 1',
  release: 'verrou ← 0', lock: 'lock(m)', unlock: 'unlock(m)', P: 'P(S)', use: printers ? 'imprimer' : 'utiliser', V: 'V(S)',
}[op])

function Spinner({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={7} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2.5" />
      <circle r={7} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="10 34">
        {!reducedMotion() && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.7s" repeatCount="indefinite" />}
      </circle>
    </g>
  )
}

interface Props {
  m: Machine
  /** 0 → 1 : intensité du halo sur le processus qui vient d'agir (décroît dans la scène) */
  pulse?: number
  /** masque le coût CPU (scènes où il n'a pas encore été introduit) */
  hideCost?: boolean
  /** masque la bannière « section critique » */
  hideBanner?: boolean
  className?: string
  label?: string
}

export function ConcurrencyBoard({ m, pulse = 0, hideCost, hideBanner, className, label }: Props) {
  const { params } = m
  const program = ops(params)
  const [csA, csB] = csRange(params)
  const n = m.procs.length
  const gap = 12
  const cw = Math.min(210, (650 - (n - 1) * gap) / n)
  const x0 = 20 + (650 - (n * cw + (n - 1) * gap)) / 2
  const inside = inCS(m)
  const printers = params.resource === 'printers'
  const fin = finished(m)
  const showSem = params.scenario === 'sem'
  const over = inside.length > csLimit(params)
  const exp = expected(params)
  const lineH = 27

  return (
    <svg viewBox="0 0 1000 440" className={className} role="img" aria-label={label ?? 'Processus, ressource partagée et mécanisme de protection'}>
      {/* bannière section critique */}
      {!hideBanner && (
        <g transform="translate(20 8)">
          <rect width={650} height={30} rx={15} fill={over ? 'rgba(255,107,107,.14)' : 'rgba(255,255,255,.04)'} stroke={over ? STATE_COLOR.blocked : 'rgba(255,255,255,.12)'} />
          {over ? <TriangleAlert x={14} y={6} width={18} height={18} color={STATE_COLOR.blocked} /> : null}
          <text x={over ? 40 : 16} y={20} fontSize="12" letterSpacing="1.4" fontFamily={MONO} fill={over ? STATE_COLOR.blocked : 'rgba(255,255,255,.6)'}>
            {over
              ? `${inside.map((i) => `P${i}`).join(' ET ')} DANS LA SECTION CRITIQUE EN MÊME TEMPS`
              : inside.length === 0 ? (showSem ? 'ZONE PROTÉGÉE : LIBRE' : 'SECTION CRITIQUE : LIBRE') : `${showSem ? 'ZONE PROTÉGÉE' : 'SECTION CRITIQUE'} : ${inside.map((i) => `P${i}`).join(', ')}${showSem ? `  (${inside.length}/${params.permits})` : ''}`}
          </text>
        </g>
      )}

      {/* processus */}
      {m.procs.map((p, i) => {
        const x = x0 + i * (cw + gap)
        const c = procColor(p.id)
        const [chip, chipColor] = CHIP[p.state]
        const hot = m.last === p.id ? pulse : 0
        const bottom = 56 + 340
        return (
          <g key={p.id} transform={`translate(${x} 48)`} opacity={p.state === 'done' ? 0.62 : 1}>
            <rect x={-3} y={-3} width={cw + 6} height={346} rx={25} fill={c} opacity={0.18 * hot} />
            <rect width={cw} height={340} rx={22} fill="#12142a" stroke={c} strokeOpacity={0.55 + 0.4 * hot} strokeWidth="1.8" />
            <rect width={cw} height={340} rx={22} fill={c} opacity=".05" />
            <circle cx={20} cy={26} r={6} fill={c} />
            <text x={34} y={31} fontSize="17" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">{p.name}</text>
            <g transform={`translate(${cw - 12} 26)`}>
              <rect x={-(chip.length * 7 + 22)} y={-11} width={chip.length * 7 + 22} height={22} rx={11} fill={`${chipColor}22`} stroke={chipColor} strokeOpacity=".7" />
              <text x={-(chip.length * 7 + 22) / 2} y={4} textAnchor="middle" fontSize="11" fill={chipColor} fontFamily={MONO}>{chip}</text>
            </g>

            {program.map((op, k) => {
              const y = 56 + k * lineH
              const cur = p.pc === k && p.state !== 'done'
              const inCs = k >= csA && k <= csB
              const dim = k < p.pc || p.state === 'done'
              return (
                <g key={k} transform={`translate(0 ${y})`} opacity={dim ? 0.42 : 1}>
                  {inCs && <rect x={10} y={0} width={cw - 20} height={lineH - 3} rx={8} fill="rgba(255,184,77,.08)" />}
                  {inCs && <rect x={10} y={2} width={3} height={lineH - 7} rx={1.5} fill="#ffb84d" opacity=".85" />}
                  {cur && <rect x={10} y={0} width={cw - 20} height={lineH - 3} rx={8} fill={c} opacity={m.last === p.id ? 0.18 + 0.15 * hot : 0.14} stroke={c} strokeOpacity=".8" />}
                  {cur && <path d="M16 6 l7 5 l-7 5 z" fill={c} />}
                  <text x={cur ? 30 : 20} y={lineH - 10} fontSize={cw < 150 ? 11 : 12.5} fill="#fff" fontFamily={MONO}>{opLabel(op, p, printers)}</text>
                </g>
              )
            })}

            {/* registre local */}
            {params.scenario !== 'sem' && (
              <g transform={`translate(14 ${56 + program.length * lineH + 12})`}>
                <rect width={cw - 28} height={30} rx={9} fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)" />
                <text x={12} y={20} fontSize="12" fill="rgba(255,255,255,.55)" fontFamily={MONO}>tmp</text>
                <text x={cw - 40} y={20} textAnchor="end" fontSize="14" fontWeight="600" fill="#fff" fontFamily={MONO}>{p.tmp === null ? '—' : `${p.tmp} $`}</text>
              </g>
            )}

            {/* état d'attente */}
            <g transform={`translate(14 ${bottom - 48 - 48})`}>
              {p.state === 'blocked' && (
                <g>
                  <rect width={cw - 28} height={34} rx={11} fill="rgba(255,107,107,.12)" stroke={STATE_COLOR.blocked} strokeOpacity=".6" />
                  <text x={(cw - 28) / 2} y={14} textAnchor="middle" fontSize="11" fill={STATE_COLOR.blocked} fontFamily={MONO}>en file d’attente</text>
                  <text x={(cw - 28) / 2} y={28} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,.55)" fontFamily="Geist, sans-serif">aucun test, pas de CPU</text>
                </g>
              )}
              {p.state !== 'blocked' && p.spins > 0 && p.state !== 'done' && (
                <g>
                  <rect width={cw - 28} height={34} rx={11} fill={p.spinning ? 'rgba(255,107,107,.12)' : 'rgba(255,255,255,.04)'} stroke={p.spinning ? STATE_COLOR.blocked : 'rgba(255,255,255,.16)'} strokeOpacity=".7" />
                  {p.spinning && <Spinner x={20} y={17} color={STATE_COLOR.blocked} />}
                  <text x={p.spinning ? 36 : 14} y={14} fontSize="11" fill={p.spinning ? STATE_COLOR.blocked : 'rgba(255,255,255,.6)'} fontFamily={MONO}>{p.spinning ? 'attente active' : 'a attendu'}</text>
                  <text x={p.spinning ? 36 : 14} y={28} fontSize="11" fill="rgba(255,255,255,.7)" fontFamily={MONO}>{p.spins} tentative{p.spins > 1 ? 's' : ''}</text>
                </g>
              )}
              {p.state === 'done' && <text x={(cw - 28) / 2} y={22} textAnchor="middle" fontSize="12" fill={STATE_COLOR.running} fontFamily={MONO}>✓ terminé</text>}
            </g>
          </g>
        )
      })}

      {/* ressources */}
      <g transform="translate(690 48)">
        {!showSem ? (
          <g>
            <rect width={290} height={132} rx={22} fill="#12142a" stroke="rgba(255,255,255,.2)" strokeWidth="1.6" />
            <text x={20} y={28} fontSize="11.5" letterSpacing="2" fontFamily={MONO} fill="rgba(255,255,255,.55)">SOLDE PARTAGÉ</text>
            <text x={20} y={80} fontSize="46" fontWeight="600" fill="#fff" fontFamily={MONO}>{m.balance}<tspan fontSize="20" fill="rgba(255,255,255,.5)" dx="6">$</tspan></text>
            {fin ? (
              <g transform="translate(20 100)">
                {m.balance === exp ? <Check x={0} y={-2} width={16} height={16} color={STATE_COLOR.running} strokeWidth={3} /> : <X x={0} y={-2} width={16} height={16} color={STATE_COLOR.blocked} strokeWidth={3} />}
                <text x={24} y={11} fontSize="12.5" fill={m.balance === exp ? STATE_COLOR.running : STATE_COLOR.blocked} fontFamily="Geist, sans-serif">
                  {m.balance === exp ? `attendu : ${exp} $ — correct` : `attendu : ${exp} $ — mise à jour perdue`}
                </text>
              </g>
            ) : <text x={20} y={110} fontSize="12" fill="rgba(255,255,255,.45)" fontFamily="Geist, sans-serif">attendu à la fin : {exp} $</text>}
          </g>
        ) : (
          <g>
            <rect width={290} height={132} rx={22} fill="#12142a" stroke="rgba(94,234,212,.45)" strokeWidth="1.6" />
            <text x={20} y={28} fontSize="11.5" letterSpacing="2" fontFamily={MONO} fill={STATE_COLOR.running}>SÉMAPHORE S · {params.permits} {printers ? 'IMPRIMANTE' : 'AUTORISATION'}{params.permits > 1 ? 'S' : ''}</text>
            <text x={20} y={80} fontSize="46" fontWeight="600" fill="#fff" fontFamily={MONO}>S = {m.value}</text>
            {Array.from({ length: Math.min(params.permits, 6) }, (_, k) => {
              const holder = m.holders[k]
              const cx = 30 + k * 44
              return (
                <g key={k} transform={`translate(${cx} 108)`}>
                  <rect x={-17} y={-14} width={34} height={26} rx={9} fill={holder ? `${procColor(holder)}33` : 'rgba(94,234,212,.08)'} stroke={holder ? procColor(holder) : STATE_COLOR.running} strokeOpacity={holder ? 0.9 : 0.5} strokeDasharray={holder ? undefined : '3 3'} />
                  <text y={4} textAnchor="middle" fontSize="11" fill={holder ? '#fff' : STATE_COLOR.running} fontFamily={MONO}>{holder ? `P${holder}` : 'libre'}</text>
                </g>
              )
            })}
          </g>
        )}

        {/* verrou / file */}
        <g transform="translate(0 146)">
          <rect width={290} height={showSem || params.scenario === 'mutex' ? 118 : 100} rx={22} fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.14)" strokeDasharray="3 6" />
          {params.scenario === 'race' && (
            <g>
              <TriangleAlert x={20} y={20} width={22} height={22} color={STATE_COLOR.blocked} />
              <text x={52} y={37} fontSize="13" fontWeight="600" fill="#fff" fontFamily="Geist, sans-serif">Aucune protection</text>
              <text x={20} y={64} fontSize="12" fill="rgba(255,255,255,.55)" fontFamily="Geist, sans-serif">Chacun lit, calcule et écrit</text>
              <text x={20} y={82} fontSize="12" fill="rgba(255,255,255,.55)" fontFamily="Geist, sans-serif">quand l’ordonnanceur le décide.</text>
            </g>
          )}
          {params.scenario === 'spin' && (
            <g>
              {m.lock ? <Lock x={20} y={18} width={26} height={26} color={m.owner ? procColor(m.owner) : STATE_COLOR.blocked} /> : <LockOpen x={20} y={18} width={26} height={26} color={STATE_COLOR.running} />}
              <text x={58} y={36} fontSize="14" fontWeight="600" fill="#fff" fontFamily={MONO}>verrou = {m.lock}</text>
              <text x={20} y={68} fontSize="12" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">{m.owner ? `propriétaire : P${m.owner}` : m.lock ? 'occupé' : 'libre'}</text>
              <text x={20} y={86} fontSize="11.5" fill="rgba(255,255,255,.4)" fontFamily="Geist, sans-serif">{params.atomic ? 'Test and Set : atomique' : 'tester puis écrire : 2 instructions'}</text>
            </g>
          )}
          {params.scenario === 'mutex' && (
            <g>
              {m.owner ? <Lock x={20} y={16} width={26} height={26} color={procColor(m.owner)} /> : <LockOpen x={20} y={16} width={26} height={26} color={STATE_COLOR.running} />}
              <text x={58} y={34} fontSize="14" fontWeight="600" fill="#fff" fontFamily={MONO}>mutex {m.owner ? 'occupé' : 'libre'}</text>
              <text x={20} y={62} fontSize="12" fill="rgba(255,255,255,.6)" fontFamily="Geist, sans-serif">{m.owner ? `propriétaire : P${m.owner}` : 'aucun propriétaire'}</text>
              <Queue m={m} y={76} />
            </g>
          )}
          {showSem && (
            <g>
              <text x={20} y={30} fontSize="11.5" letterSpacing="2" fontFamily={MONO} fill="rgba(255,255,255,.55)">FILE D’ATTENTE</text>
              <Queue m={m} y={50} />
              <text x={20} y={104} fontSize="11.5" fill="rgba(255,255,255,.4)" fontFamily={MONO}>S + détenues = {m.value} + {m.holders.length} = {params.permits}</text>
            </g>
          )}
        </g>

        {/* coût CPU */}
        {!hideCost && (params.scenario === 'spin' || params.scenario === 'mutex') && (
          <g transform={`translate(0 ${params.scenario === 'mutex' ? 276 : 258})`}>
            <text x={0} y={12} fontSize="11.5" letterSpacing="2" fontFamily={MONO} fill="rgba(255,255,255,.5)">COÛT CPU</text>
            <rect y={22} width={290} height={14} rx={7} fill="rgba(255,255,255,.08)" />
            {m.tick > 0 && <rect y={22} width={290 * clamp((m.tick - m.wasted) / m.tick)} height={14} rx={7} fill={STATE_COLOR.running} opacity=".85" />}
            {m.tick > 0 && m.wasted > 0 && <rect x={290 * clamp((m.tick - m.wasted) / m.tick)} y={22} width={290 * clamp(m.wasted / m.tick)} height={14} rx={7} fill={STATE_COLOR.blocked} />}
            <text x={0} y={56} fontSize="12" fill="rgba(255,255,255,.7)" fontFamily="Geist, sans-serif">
              <tspan fill={STATE_COLOR.running}>utile : {m.tick - m.wasted}</tspan>  ·  <tspan fill={m.wasted ? STATE_COLOR.blocked : 'rgba(255,255,255,.7)'}>gaspillé : {m.wasted}</tspan>  tour{m.tick > 1 ? 's' : ''} de CPU
            </text>
          </g>
        )}
      </g>
    </svg>
  )
}

function Queue({ m, y }: { m: Machine; y: number }) {
  if (m.queue.length === 0) return <text x={20} y={y + 16} fontSize="12" fill="rgba(255,255,255,.4)" fontFamily="Geist, sans-serif">file vide</text>
  return (
    <g transform={`translate(20 ${y})`}>
      {m.queue.map((id, k) => (
        <g key={id} transform={`translate(${k * 52} 0)`}>
          <rect width={44} height={26} rx={9} fill={`${procColor(id)}2b`} stroke={procColor(id)} />
          <text x={22} y={17.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff" fontFamily="Geist, sans-serif">P{id}</text>
        </g>
      ))}
      <text x={m.queue.length * 52 + 2} y={18} fontSize="11" fill="rgba(255,255,255,.4)" fontFamily={MONO}>1er réveillé : P{m.queue[0]}</text>
    </g>
  )
}

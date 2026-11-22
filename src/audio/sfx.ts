/**
 * Effets sonores synthétiques (Web Audio API) — aucun fichier à charger.
 *
 * Identité : sons doux et courts, sinusoïdes filtrées, tous accordés sur la gamme
 * pentatonique de ré majeur (ré · mi · fa# · la · si) : ils s'additionnent sans jamais
 * sonner faux. Un peu d'écho (très atténué) donne de l'air ; un compresseur évite toute
 * saturation.
 */
import { getAudioSettings, subscribeAudioSettings } from './settings'

export type SoundName = 'appear' | 'move' | 'enter' | 'done'

export interface SfxOptions {
  /** degré de la gamme (appear, done) : 0, 1, 2… */
  pitch?: number
  /** gain relatif, 1 = normal */
  gain?: number
  /** vitesse de lecture de la leçon : raccourcit légèrement les sons quand ça va vite */
  speed?: number
}

const SCALE = [587.33, 659.25, 739.99, 880, 987.77, 1174.66] // ré5 mi5 fa#5 la5 si5 ré6
const degree = (n: number) => SCALE[((n % SCALE.length) + SCALE.length) % SCALE.length] * Math.pow(2, Math.floor(n / SCALE.length))

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bus: GainNode | null = null
let noise: AudioBuffer | null = null
const lastPlayed = new Map<SoundName, number>()

const masterLevel = () => Math.pow(getAudioSettings().sfxVolume, 1.6) * 0.9

function ensure(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = masterLevel()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2
    master.connect(comp).connect(ctx.destination)

    bus = ctx.createGain()
    bus.connect(master)
    // écho discret : retard court, rebouclage faible, aigus adoucis
    const delay = ctx.createDelay(0.5); delay.delayTime.value = 0.14
    const fb = ctx.createGain(); fb.gain.value = 0.22
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2400
    const wet = ctx.createGain(); wet.gain.value = 0.16
    bus.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); damp.connect(wet); wet.connect(master)

    const len = ctx.sampleRate * 0.6
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    subscribeAudioSettings(() => { if (master && ctx) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.03) })
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Les navigateurs exigent un geste utilisateur : le premier clic ou la première touche débloque l'audio. */
export function installAudioUnlock() {
  const unlock = () => { ensure(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

function tone(c: AudioContext, o: { f: number; type?: OscillatorType; at: number; attack?: number; decay: number; gain: number; glideTo?: number; lp?: number }) {
  const osc = c.createOscillator(), env = c.createGain(), lp = c.createBiquadFilter()
  const a = o.attack ?? 0.006
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.f, o.at)
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, o.at + o.decay * 0.7)
  lp.type = 'lowpass'; lp.frequency.value = o.lp ?? 3500
  env.gain.setValueAtTime(0.0001, o.at)
  env.gain.linearRampToValueAtTime(o.gain, o.at + a)
  env.gain.exponentialRampToValueAtTime(0.0001, o.at + a + o.decay)
  osc.connect(lp).connect(env).connect(bus!)
  osc.start(o.at); osc.stop(o.at + a + o.decay + 0.05)
}

export function playSfx(name: SoundName, opts: SfxOptions = {}) {
  const s = getAudioSettings()
  if (!s.sfxOn || s.sfxVolume <= 0) return
  const c = ensure()
  if (!c || c.state !== 'running') return // pas encore débloqué par un geste
  const now = c.currentTime
  // anti-rafale : jamais deux fois le même son à moins de 40 ms
  const wall = performance.now()
  if (wall - (lastPlayed.get(name) ?? -1e9) < 40) return
  lastPlayed.set(name, wall)

  const g = opts.gain ?? 1
  const k = 1 / Math.sqrt(Math.min(2, Math.max(0.75, opts.speed ?? 1))) // durée : plus court si la leçon va vite
  const t = now + 0.005

  switch (name) {
    case 'appear': { // « bulle » électronique douce
      const f = degree(opts.pitch ?? 0)
      tone(c, { f, at: t, decay: 0.22 * k, gain: 0.16 * g, lp: 3200 })
      tone(c, { f: f * 2, at: t, decay: 0.1 * k, gain: 0.035 * g, lp: 4000 })
      break
    }
    case 'move': { // souffle filtré qui glisse
      const src = c.createBufferSource(); src.buffer = noise
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1
      bp.frequency.setValueAtTime(450, t); bp.frequency.exponentialRampToValueAtTime(1700, t + 0.24 * k)
      const env = c.createGain()
      env.gain.setValueAtTime(0.0001, t)
      env.gain.linearRampToValueAtTime(0.1 * g, t + 0.07 * k)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.26 * k)
      src.connect(bp).connect(env).connect(bus!)
      src.start(t); src.stop(t + 0.3)
      break
    }
    case 'enter': { // impulsion numérique : battement grave + micro-tic
      tone(c, { f: 230, glideTo: 150, at: t, attack: 0.004, decay: 0.2 * k, gain: 0.24 * g, lp: 1200 })
      tone(c, { f: 1760, type: 'triangle', at: t, attack: 0.001, decay: 0.04, gain: 0.04 * g, lp: 5000 })
      break
    }
    case 'done': { // confirmation : deux notes montantes
      tone(c, { f: degree(3), at: t, decay: 0.28 * k, gain: 0.13 * g, lp: 4000 })
      tone(c, { f: degree(5), at: t + 0.11 * k, decay: 0.38 * k, gain: 0.13 * g, lp: 4000 })
      break
    }
  }
}

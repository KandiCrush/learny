import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { playSfx } from '../audio/sfx'
import { setAudioSettings, useAudioSettings } from '../audio/settings'

/** Bouton « Son » : volume de la narration, volume et interrupteur des effets sonores */
export function SoundMenu() {
  const s = useAudioSettings()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    window.addEventListener('pointerdown', out)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', out); window.removeEventListener('keydown', esc) }
  }, [open])

  const muted = !s.sfxOn && s.narrationVolume === 0
  const Icon = muted ? VolumeX : Volume2

  return (
    <div ref={root} className="relative">
      <button className="icon-btn" data-active={open} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label="Réglages du son" title="Son">
        <Icon size={18} />
      </button>
      {open && (
        <div role="dialog" aria-label="Réglages du son" className="beat-in absolute right-0 top-[calc(100%+10px)] z-30 w-[290px] rounded-2xl border border-white/12 bg-[#0e1021]/95 p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-2xl">
          <label className="block">
            <div className="flex justify-between"><span className="eyebrow">Narration</span><b className="font-mono text-[12px]">{Math.round(s.narrationVolume * 100)}</b></div>
            <input type="range" className="range mt-1.5" min={0} max={1} step={0.05} value={s.narrationVolume} onChange={(e) => setAudioSettings({ narrationVolume: Number(e.target.value) })} aria-label="Volume de la narration" />
          </label>

          <div className="mt-3 flex items-center justify-between">
            <span className="eyebrow">Effets sonores</span>
            <button role="switch" aria-checked={s.sfxOn} onClick={() => setAudioSettings({ sfxOn: !s.sfxOn })} className="relative h-6 w-11 rounded-full border border-white/15 transition-colors" style={{ background: s.sfxOn ? 'var(--accent)' : 'rgba(255,255,255,.08)' }} aria-label="Activer les effets sonores">
              <span className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all" style={{ left: s.sfxOn ? 22 : 2 }} />
            </button>
          </div>
          <label className={`mt-1 block transition-opacity ${s.sfxOn ? '' : 'pointer-events-none opacity-40'}`}>
            <div className="flex justify-between"><span className="text-[12px] text-white/50">Volume des effets</span><b className="font-mono text-[12px]">{Math.round(s.sfxVolume * 100)}</b></div>
            <input type="range" className="range mt-1" min={0} max={1} step={0.05} value={s.sfxVolume} disabled={!s.sfxOn}
              onChange={(e) => setAudioSettings({ sfxVolume: Number(e.target.value) })}
              onPointerUp={() => { playSfx('appear', { pitch: 1 }) }} onKeyUp={() => playSfx('appear', { pitch: 1 })} aria-label="Volume des effets sonores" />
          </label>
          <button className="btn-ghost mt-3 !h-9 w-full justify-center !text-[12px]" disabled={!s.sfxOn} onClick={() => { playSfx('appear', { pitch: 0 }); setTimeout(() => playSfx('enter'), 380); setTimeout(() => playSfx('done'), 800) }}>
            Écouter les effets
          </button>
        </div>
      )}
    </div>
  )
}

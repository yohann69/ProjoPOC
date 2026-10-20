import { useEffect, useRef } from 'react'
import { rmsToDb } from '../../lib/audio/bands'
import { onFrame } from '../../lib/frameLoop'
import { audioLive } from '../../live/audioLive'

const BANDS = [
  { key: 'low', label: 'Low 20–150 Hz', color: 'bg-pink-400' },
  { key: 'mid', label: 'Mid 150 Hz–2 kHz', color: 'bg-sky-400' },
  { key: 'high', label: 'High 2–16 kHz', color: 'bg-yellow-300' }
] as const

/** Band energies, RMS level and an onset flash, updated every frame without React renders. */
export function BandBars() {
  const bars = useRef<Record<string, HTMLDivElement | null>>({})
  const rms = useRef<HTMLSpanElement>(null)
  const flash = useRef<HTMLSpanElement>(null)
  const rate = useRef<HTMLSpanElement>(null)
  useEffect(
    () =>
      onFrame((now) => {
        for (const b of BANDS) {
          const bar = bars.current[b.key]
          if (bar) bar.style.width = `${audioLive.bands[b.key] * 100}%`
        }
        const db = rmsToDb(audioLive.rms)
        if (rms.current)
          rms.current.textContent = Number.isFinite(db) ? `${db.toFixed(1)} dBFS` : '-inf dBFS'
        const age = now - audioLive.onsetTs
        if (flash.current) flash.current.style.opacity = String(Math.max(0.15, 1 - age / 250))
        const recent = audioLive.onsetTimes.filter((t) => now - t < 10_000).length
        if (rate.current) rate.current.textContent = `${(recent / 10).toFixed(1)} onsets/s`
      }),
    []
  )
  return (
    <div className="flex flex-col gap-2">
      {BANDS.map((b) => (
        <div key={b.key} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 text-slate-300">{b.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-800">
            <div
              ref={(node) => {
                bars.current[b.key] = node
              }}
              className={`h-full ${b.color}`}
              style={{ width: 0 }}
            />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span>RMS</span>
        <span ref={rms} className="w-24 tabular-nums text-slate-100" />
        <span
          ref={flash}
          className="rounded border border-amber-300 bg-amber-300 px-1.5 py-0.5 font-semibold text-slate-950"
          style={{ opacity: 0.15 }}
        >
          Onset
        </span>
        <span ref={rate} className="tabular-nums" />
      </div>
    </div>
  )
}

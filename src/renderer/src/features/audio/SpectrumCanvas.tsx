import { useEffect, useRef } from 'react'
import { dbToLevel } from '../../lib/audio/bands'
import { onFrame } from '../../lib/frameLoop'
import { audioLive } from '../../live/audioLive'

const HEIGHT = 120
const MIN_HZ = 20
const MAX_HZ = 20000
const REGIONS = [
  { from: 20, to: 150, color: 'rgba(244, 114, 182, 0.12)', label: 'low' },
  { from: 150, to: 2000, color: 'rgba(56, 189, 248, 0.12)', label: 'mid' },
  { from: 2000, to: 16000, color: 'rgba(250, 204, 21, 0.12)', label: 'high' }
]

const xOf = (hz: number, w: number): number =>
  (Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * w

function draw(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  if (canvas.width !== Math.floor(w * dpr)) {
    canvas.width = Math.floor(w * dpr)
    canvas.height = HEIGHT * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, HEIGHT)
  ctx.font = '10px system-ui, sans-serif'
  for (const r of REGIONS) {
    ctx.fillStyle = r.color
    ctx.fillRect(xOf(r.from, w), 0, xOf(r.to, w) - xOf(r.from, w), HEIGHT)
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(r.label, xOf(r.from, w) + 3, 11)
  }
  const { spectrum, sampleRate } = audioLive
  if (spectrum.length === 0) return
  const binHz = sampleRate / (2 * spectrum.length)
  ctx.beginPath()
  ctx.moveTo(0, HEIGHT)
  let previousHz = MIN_HZ
  for (let x = 0; x <= w; x += 2) {
    const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (x / w)
    const first = Math.max(0, Math.floor(previousHz / binHz))
    const last = Math.min(spectrum.length - 1, Math.max(first, Math.ceil(hz / binHz)))
    let peak = -Infinity
    for (let i = first; i <= last; i++) peak = Math.max(peak, spectrum[i] ?? -Infinity)
    previousHz = hz
    ctx.lineTo(x, HEIGHT - dbToLevel(peak) * (HEIGHT - 14))
  }
  ctx.lineTo(w, HEIGHT)
  ctx.closePath()
  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)'
  ctx.fill()
}

/** Live log-frequency spectrum with the three analysis bands shaded behind it. */
export function SpectrumCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current
    return el ? onFrame(() => draw(el)) : undefined
  }, [])
  return (
    <canvas
      ref={ref}
      className="w-full rounded bg-slate-950"
      style={{ height: HEIGHT }}
      role="img"
      aria-label="Live audio spectrum on a logarithmic frequency axis from 20 Hz to 20 kHz"
    />
  )
}

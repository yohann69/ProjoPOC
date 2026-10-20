import type { Cue, TrackInfo } from '@shared/types'
import { PHRASE_COLORS } from '../../lib/phrases'

const BAND_COLORS = { low: '#2563eb', mid: '#f97316', high: '#e2e8f0' }
const MONO_COLOR = '#7dd3fc'

function drawPhrases(ctx: CanvasRenderingContext2D, w: number, h: number, track: TrackInfo): void {
  const dpr = w / Math.max(1, ctx.canvas.clientWidth)
  ctx.font = `${10 * dpr}px system-ui, sans-serif`
  ctx.textBaseline = 'top'
  for (const phrase of track.phrases) {
    const x0 = (phrase.startMs / track.durationMs) * w
    const x1 = (phrase.endMs / track.durationMs) * w
    ctx.fillStyle = PHRASE_COLORS[phrase.kind] + '33'
    ctx.fillRect(x0, 0, Math.max(1, x1 - x0 - dpr), h)
    ctx.fillStyle = PHRASE_COLORS[phrase.kind]
    ctx.fillRect(x0, 0, Math.max(1, x1 - x0 - dpr), 2 * dpr)
    if (x1 - x0 > 36 * dpr) ctx.fillText(phrase.kind.toUpperCase(), x0 + 3 * dpr, 4 * dpr)
  }
}

function drawBars(ctx: CanvasRenderingContext2D, w: number, h: number, track: TrackInfo): void {
  const wave = track.waveform
  if (!wave) return
  const mid = h / 2
  const columns = Math.floor(w)
  if (wave.bands) {
    const { low, mid: m, high } = wave.bands
    ctx.globalCompositeOperation = 'lighter'
    const layers = [
      [low, BAND_COLORS.low],
      [m, BAND_COLORS.mid],
      [high, BAND_COLORS.high]
    ] as const
    for (const [data, color] of layers) {
      ctx.fillStyle = color
      for (let x = 0; x < columns; x++) {
        const value = data[Math.floor((x / columns) * data.length)] ?? 0
        const half = (value / 255) * mid * 0.9
        ctx.fillRect(x, mid - half, 1, half * 2)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
    return
  }
  ctx.fillStyle = MONO_COLOR
  for (let x = 0; x < columns; x++) {
    const half =
      ((wave.heights[Math.floor((x / columns) * wave.heights.length)] ?? 0) / 255) * mid * 0.9
    ctx.fillRect(x, mid - half, 1, half * 2)
  }
}

function drawMarkers(ctx: CanvasRenderingContext2D, w: number, h: number, track: TrackInfo): void {
  const dpr = w / Math.max(1, ctx.canvas.clientWidth)
  ctx.fillStyle = 'rgba(34, 211, 238, 0.45)'
  for (const loop of track.loops) {
    const x0 = (loop.startMs / track.durationMs) * w
    ctx.fillRect(
      x0,
      h - 8 * dpr,
      Math.max(2, ((loop.endMs - loop.startMs) / track.durationMs) * w),
      8 * dpr
    )
  }
  ctx.font = `bold ${10 * dpr}px system-ui, sans-serif`
  ctx.textBaseline = 'bottom'
  const drawCue = (cue: Cue): void => {
    const x = (cue.positionMs / track.durationMs) * w
    ctx.fillStyle = cue.color ?? (cue.type === 'hot' ? '#fbbf24' : '#e2e8f0')
    ctx.fillRect(x - dpr / 2, 0, dpr * 1.5, h)
    if (cue.label) ctx.fillText(cue.label.slice(0, 6), x + 3 * dpr, h - 2 * dpr)
  }
  track.cues.forEach(drawCue)
}

/** Static layers: phrase bands, 3-band (or mono) waveform, loops and cue markers. */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  track: TrackInfo
): void {
  ctx.clearRect(0, 0, w, h)
  if (track.durationMs <= 0) return
  drawPhrases(ctx, w, h, track)
  drawBars(ctx, w, h, track)
  drawMarkers(ctx, w, h, track)
}

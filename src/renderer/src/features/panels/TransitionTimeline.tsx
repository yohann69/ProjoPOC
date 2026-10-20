import { DECK_IDS } from '@shared/types'
import { useEffect, useRef } from 'react'
import { DECK_COLORS } from '../../lib/deckColors'
import { epochNow } from '../../lib/frameLoop'
import { computeOverlaps, spans, transitions } from '../../live/timeline'
import { OriginBadge } from '../../ui/OriginBadge'
import { Panel } from '../../ui/primitives'

const WINDOW_MS = 5 * 60_000
const HEIGHT = 150
const ROW = 20
const TOP = 22

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
  const now = epochNow()
  const from = now - WINDOW_MS
  const x = (t: number): number => ((t - from) / WINDOW_MS) * w

  for (const [a, b] of computeOverlaps(spans, now)) {
    if (b < from) continue
    ctx.fillStyle = 'rgba(251, 191, 36, 0.18)'
    ctx.fillRect(Math.max(0, x(a)), TOP, x(b) - Math.max(0, x(a)), HEIGHT - TOP)
  }
  ctx.font = '11px system-ui, sans-serif'
  DECK_IDS.forEach((deck, i) => {
    const y = TOP + 4 + i * (ROW + 6)
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(`D${deck}`, 2, y + 13)
    ctx.fillStyle = DECK_COLORS[deck]
    for (const s of spans[deck]) {
      const end = s.end ?? now
      if (end < from) continue
      const x0 = Math.max(24, x(s.start))
      ctx.fillRect(x0, y, Math.max(2, x(end) - x0), ROW)
    }
  })
  ctx.strokeStyle = '#a78bfa'
  ctx.fillStyle = '#ddd6fe'
  ctx.setLineDash([4, 3])
  for (const t of transitions) {
    if (t.ts < from) continue
    const tx = x(t.ts)
    ctx.beginPath()
    ctx.moveTo(tx, 14)
    ctx.lineTo(tx, HEIGHT)
    ctx.stroke()
    ctx.fillText(
      `${t.fromDeck}\u2192${t.toDeck} ${Math.round(t.confidence * 100)}%`,
      Math.min(tx + 3, w - 70),
      10
    )
  }
  ctx.setLineDash([])
}

export function TransitionTimeline() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    draw(el)
    const timer = setInterval(() => draw(el), 500)
    const observer = new ResizeObserver(() => draw(el))
    observer.observe(el)
    return () => {
      clearInterval(timer)
      observer.disconnect()
    }
  }, [])
  return (
    <Panel
      title="Transitions (5 min)"
      badges={
        <>
          <OriginBadge origin="ETH_LIVE" />
          <OriginBadge origin="DERIVED" />
        </>
      }
    >
      <canvas
        ref={canvas}
        className="w-full"
        style={{ height: HEIGHT }}
        role="img"
        aria-label="Timeline of audible decks with detected transitions and confidence"
      />
      <p className="text-xs text-slate-300">
        Bars: deck playing on air (ETH LIVE). Shaded: two decks audible at once. Dashed: detected
        transition with confidence (DERIVED).
      </p>
    </Panel>
  )
}

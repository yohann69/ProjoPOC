import type { DeckId } from '@shared/types'
import { useEffect, useRef } from 'react'
import { onFrame } from '../../lib/frameLoop'
import { deckLive } from '../../live/liveData'
import { useSettingsStore } from '../../store/useSettingsStore'
import { Labeled } from '../../ui/primitives'

const SIZE = 96
const LINE = 8

function drawRing(ctx: CanvasRenderingContext2D, dpr: number, phase: number | null): void {
  const c = (SIZE / 2) * dpr
  const r = (SIZE / 2 - LINE) * dpr
  ctx.clearRect(0, 0, SIZE * dpr, SIZE * dpr)
  ctx.lineWidth = LINE * dpr
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#334155'
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.stroke()
  if (phase === null) return
  const start = -Math.PI / 2
  ctx.strokeStyle = '#a78bfa'
  ctx.beginPath()
  ctx.arc(c, c, r, start, start + Math.PI * 2 * Math.max(phase, 0.004))
  ctx.stroke()
  ctx.fillStyle = '#f8fafc'
  ctx.beginPath()
  const angle = start + Math.PI * 2 * phase
  ctx.arc(c + Math.cos(angle) * r, c + Math.sin(angle) * r, (LINE / 2 + 1) * dpr, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Four beat pulses and the phase ring. Driven by the shared frame loop and live data: React never
 * re-renders on a beat.
 */
export function BeatIndicator({ deck }: { deck: DeckId }) {
  const reduceMotion = useSettingsStore((s) => s.dashboard.reduceMotion)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dots = useRef<(HTMLSpanElement | null)[]>([])
  const digit = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    el.width = SIZE * dpr
    el.height = SIZE * dpr
    let seenBeat = -1
    let shown = 0
    let drawn = -2
    return onFrame((now) => {
      const live = deckLive[deck]
      const phase = live.smoother.phase(now)
      const active = phase === null ? 0 : (live.beatInBar ?? 0)
      if (active !== shown) {
        shown = active
        dots.current.forEach((dot, i) => {
          if (dot) dot.dataset.active = String(i + 1 === active)
        })
        if (digit.current) digit.current.textContent = active ? String(active) : '\u2013'
      }
      if (live.beatCount !== seenBeat) {
        seenBeat = live.beatCount
        const dot = dots.current[(live.beatInBar ?? 1) - 1]
        if (dot && phase !== null && !reduceMotion) {
          dot.animate([{ transform: 'scale(1.7)' }, { transform: 'scale(1)' }], {
            duration: 220,
            easing: 'ease-out'
          })
        }
      }
      const key = reduceMotion ? shown : phase === null ? -1 : Math.round(phase * 1000)
      if (key !== drawn) {
        drawn = key
        drawRing(ctx, dpr, reduceMotion ? (shown ? shown / 4 : null) : phase)
      }
    })
  }, [deck, reduceMotion])

  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <Labeled label="Beat" origin="ETH_LIVE" stampKey={`d${deck}.beat`}>
        <div className="flex justify-center gap-2" role="img" aria-label="Beat in bar">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              ref={(node) => {
                dots.current[i] = node
              }}
              data-active="false"
              className="size-5 rounded-full bg-slate-700 data-[active=true]:bg-emerald-400"
            />
          ))}
        </div>
      </Labeled>
      <Labeled label="Phase" origin="DERIVED">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <canvas ref={canvas} style={{ width: SIZE, height: SIZE }} aria-hidden="true" />
          <span
            ref={digit}
            className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-50"
          >
            {'\u2013'}
          </span>
        </div>
      </Labeled>
    </div>
  )
}

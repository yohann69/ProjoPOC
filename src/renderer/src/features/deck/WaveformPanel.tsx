import type { DeckId } from '@shared/types'
import { useEffect, useRef } from 'react'
import { onFrame } from '../../lib/frameLoop'
import { deckLive, livePosition } from '../../live/liveData'
import { useDeckStore } from '../../store/useDeckStore'
import { Labeled, NotAvailable, Waiting, useFieldSupport } from '../../ui/primitives'
import { drawWaveform } from './drawWaveform'

const HEIGHT = 80

/** Cached static canvas plus a transform-only playhead, so a frame never redraws the waveform. */
function WaveformCanvas({ deck }: { deck: DeckId }) {
  const track = useDeckStore((s) => s.decks[deck]?.track?.value)
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const head = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = canvas.current
    const box = wrap.current
    const ctx = el?.getContext('2d')
    if (!el || !box || !ctx || !track) return
    const paint = (): void => {
      const dpr = window.devicePixelRatio || 1
      el.width = Math.max(1, Math.floor(box.clientWidth * dpr))
      el.height = Math.floor(HEIGHT * dpr)
      drawWaveform(ctx, el.width, el.height, track)
    }
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(box)
    return () => observer.disconnect()
  }, [track])

  useEffect(() => {
    let lastX = -1
    return onFrame((now) => {
      const node = head.current
      const box = wrap.current
      const live = deckLive[deck]
      const pos = livePosition(live, now)
      if (!node || !box || pos === null || !live.durationMs) {
        if (node && lastX !== -1) node.style.opacity = '0'
        lastX = -1
        return
      }
      const x = Math.round((pos / live.durationMs) * box.clientWidth * 2) / 2
      if (x === lastX) return
      if (lastX === -1) node.style.opacity = '1'
      lastX = x
      node.style.transform = `translate3d(${x}px,0,0)`
    })
  }, [deck])

  return (
    <div
      ref={wrap}
      className="relative w-full overflow-hidden rounded bg-slate-950"
      style={{ height: HEIGHT }}
    >
      <canvas
        ref={canvas}
        className="block h-full w-full"
        aria-label="Waveform with phrases and cues"
      />
      <div
        ref={head}
        className="absolute inset-y-0 left-0 w-0.5 bg-white opacity-0 will-change-transform"
        aria-hidden="true"
      />
    </div>
  )
}

export function WaveformPanel({ deck }: { deck: DeckId }) {
  const hasTrack = useDeckStore((s) => !!s.decks[deck]?.track)
  const hasWaveform = useDeckStore((s) => !!s.decks[deck]?.track?.value.waveform)
  const status = useDeckStore((s) => s.decks[deck]?.trackStatus)
  const supported = useFieldSupport('waveform')
  let body
  if (!supported) body = <NotAvailable />
  else if (hasTrack && hasWaveform) body = <WaveformCanvas deck={deck} />
  else if (hasTrack) body = <NotAvailable text="N/A: this track has no waveform analysis" />
  else if (status?.state === 'unavailable')
    body = <NotAvailable text={`N/A: ${status.message ?? 'unavailable'}`} />
  else if (status?.state === 'loading') body = <Waiting text="loading waveform" />
  else body = <span className="text-sm text-slate-400">No track loaded</span>
  return (
    <Labeled label="Waveform, phrases, cues" origin="ETH_LIBRARY" stampKey={`d${deck}.track`}>
      {body}
    </Labeled>
  )
}

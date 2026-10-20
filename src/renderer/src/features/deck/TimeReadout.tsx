import type { DeckId } from '@shared/types'
import { useEffect, useRef } from 'react'
import { formatMs } from '../../lib/format'
import { onFrame } from '../../lib/frameLoop'
import { deckLive, livePosition } from '../../live/liveData'
import { useDeckStore } from '../../store/useDeckStore'
import { Labeled, NotAvailable, Waiting, useFieldSupport } from '../../ui/primitives'

const REFRESH_MS = 100

function Counters({ deck }: { deck: DeckId }) {
  const elapsed = useRef<HTMLSpanElement>(null)
  const remaining = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let last = 0
    return onFrame((now) => {
      if (now - last < REFRESH_MS) return
      last = now
      const live = deckLive[deck]
      const pos = livePosition(live, now)
      if (pos === null) return
      if (elapsed.current) elapsed.current.textContent = formatMs(pos)
      if (remaining.current) {
        remaining.current.textContent = live.durationMs ? formatMs(pos - live.durationMs) : 'N/A'
      }
    })
  }, [deck])
  return (
    <div className="flex gap-6 font-mono text-xl tabular-nums text-slate-50">
      <Labeled label="Elapsed" origin="ETH_LIVE" stampKey={`d${deck}.positionMs`}>
        <span ref={elapsed}>--:--.-</span>
      </Labeled>
      <Labeled label="Remaining" origin="DERIVED">
        <span ref={remaining}>--:--.-</span>
      </Labeled>
    </div>
  )
}

export function TimeReadout({ deck }: { deck: DeckId }) {
  const supported = useFieldSupport('position')
  const hasPosition = useDeckStore((s) => s.decks[deck]?.hasPosition ?? false)
  if (!supported) {
    return (
      <Labeled label="Position" origin="ETH_LIVE">
        <span className="flex gap-2">
          <span className="text-lg text-slate-300">position N/A</span>
          <NotAvailable />
        </span>
      </Labeled>
    )
  }
  if (!hasPosition) {
    return (
      <Labeled label="Position" origin="ETH_LIVE">
        <Waiting text="waiting for position" />
      </Labeled>
    )
  }
  return <Counters deck={deck} />
}

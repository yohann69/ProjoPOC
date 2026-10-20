import type { DeckId } from '@shared/types'
import { LIVE_STATES } from '../../live/liveData'
import { useLiveStore } from '../../store/useLiveStore'
import { BeatIndicator } from './BeatIndicator'
import { BpmBlock, StateRow } from './BpmBlock'
import { DeckHeader } from './DeckHeader'
import { TimeReadout } from './TimeReadout'
import { WaveformPanel } from './WaveformPanel'

export function DeckCard({ deck }: { deck: DeckId }) {
  const stale = useLiveStore((s) => !LIVE_STATES.includes(s.sourceState))
  return (
    <article
      aria-label={`Deck ${deck}${stale ? ' (stale, source not delivering data)' : ''}`}
      className={`relative flex flex-col gap-4 rounded-xl border bg-slate-900 p-4 ${
        stale ? 'border-amber-700 opacity-60' : 'border-slate-800'
      }`}
    >
      {stale && (
        <span className="absolute -top-2.5 left-4 z-10 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-950">
          STALE: no live data
        </span>
      )}
      <DeckHeader deck={deck} />
      <div className="flex items-start gap-4">
        <BpmBlock deck={deck} />
        <BeatIndicator deck={deck} />
      </div>
      <StateRow deck={deck} />
      <WaveformPanel deck={deck} />
      <TimeReadout deck={deck} />
    </article>
  )
}

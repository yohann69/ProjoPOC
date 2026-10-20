import { DECK_IDS, type DeckId } from '@shared/types'
import { useShallow } from 'zustand/react/shallow'
import { DECK_COLORS } from '../../lib/deckColors'
import { formatMs } from '../../lib/format'
import { PHRASE_COLORS, phraseEnergy, phraseProgress } from '../../lib/phrases'
import { epochNow } from '../../lib/frameLoop'
import { deckLive, livePosition } from '../../live/liveData'
import { isDeckActive, useDeckStore } from '../../store/useDeckStore'
import { OriginBadge } from '../../ui/OriginBadge'
import { NotAvailable, Panel, useFieldSupport, useTicker } from '../../ui/primitives'

function PhraseRow({ deck }: { deck: DeckId }) {
  useTicker(250)
  const phrases = useDeckStore((s) => s.decks[deck]?.track?.value.phrases)
  const supported = useFieldSupport('position')
  let body
  if (!supported)
    body = (
      <span className="text-slate-300">
        position N/A <NotAvailable />
      </span>
    )
  else if (!phrases?.length)
    body = <span className="text-slate-300">no phrase data for this track</span>
  else {
    const pos = livePosition(deckLive[deck], epochNow())
    const progress = pos === null ? null : phraseProgress(phrases, pos)
    if (!progress) body = <span className="text-slate-300">waiting for position</span>
    else {
      const { current, next, msToChange } = progress
      body = (
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-2 py-0.5 text-sm font-bold uppercase text-slate-950"
              style={{ backgroundColor: PHRASE_COLORS[current.kind] }}
            >
              {current.kind}
            </span>
            <span className="tabular-nums text-slate-50">
              next{next ? ` ${next.kind}` : ' (end)'} in {formatMs(msToChange)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-800" aria-label="Energy">
            <div
              className="h-full origin-left rounded bg-violet-400"
              style={{ transform: `scaleX(${phraseEnergy(current.kind)})` }}
            />
          </div>
        </div>
      )
    }
  }
  return (
    <li className="flex items-center gap-3">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded font-bold text-slate-950"
        style={{ backgroundColor: DECK_COLORS[deck] }}
      >
        {deck}
      </span>
      {body}
    </li>
  )
}

export function PhrasePanel() {
  const active = useDeckStore(useShallow((s) => DECK_IDS.filter((d) => isDeckActive(s.decks[d]))))
  return (
    <Panel
      title="Energy and phrases"
      badges={
        <>
          <OriginBadge origin="ETH_LIBRARY" />
          <OriginBadge origin="DERIVED" />
        </>
      }
    >
      {active.length === 0 ? (
        <span className="text-sm text-slate-300">No active decks.</span>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {active.map((deck) => (
            <PhraseRow key={deck} deck={deck} />
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-300">
        Phrases come from the rekordbox analysis (ETH LIBRARY); the section timing and the energy
        estimate are computed by DeckPulse (DERIVED).
      </p>
    </Panel>
  )
}

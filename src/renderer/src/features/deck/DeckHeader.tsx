import type { DeckId } from '@shared/types'
import { keyDisplay } from '../../lib/camelot'
import { DECK_COLORS } from '../../lib/deckColors'
import { useDeckStore } from '../../store/useDeckStore'
import { useLiveStore } from '../../store/useLiveStore'
import { Labeled, NotAvailable, Waiting, useFieldSupport } from '../../ui/primitives'

function Artwork({ url }: { url?: string }) {
  if (url)
    return <img src={url} alt="Album artwork" className="size-16 shrink-0 rounded object-cover" />
  return (
    <div
      aria-label="No artwork available"
      className="flex size-16 shrink-0 items-center justify-center rounded border border-dashed border-slate-700 text-center text-[10px] leading-tight text-slate-400"
    >
      no
      <br />
      artwork
    </div>
  )
}

function TrackText({ deck }: { deck: DeckId }) {
  const track = useDeckStore((s) => s.decks[deck]?.track)
  const status = useDeckStore((s) => s.decks[deck]?.trackStatus)
  const supported = useFieldSupport('trackMeta')
  if (!supported) return <NotAvailable />
  if (!track) {
    if (status?.state === 'loading') return <Waiting text="loading track metadata" />
    if (status?.state === 'unavailable')
      return <NotAvailable text={`N/A: ${status.message ?? 'metadata unavailable'}`} />
    return <span className="text-lg text-slate-400">No track loaded</span>
  }
  const t = track.value
  const key = keyDisplay(t.key)
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-2xl font-semibold text-slate-50">{t.title}</span>
      <span className="truncate text-lg text-slate-200">{t.artist}</span>
      <span className="mt-1 flex flex-wrap gap-2 text-sm text-slate-100">
        <span className="rounded bg-slate-800 px-2 py-0.5">
          {key.camelot && key.camelot !== key.name
            ? `${key.name} \u00b7 ${key.camelot}`
            : key.name || 'key N/A'}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5">{t.genre || 'genre N/A'}</span>
      </span>
    </div>
  )
}

export function DeckHeader({ deck }: { deck: DeckId }) {
  const art = useDeckStore((s) => s.decks[deck]?.track?.value.artworkUrl)
  const track = useDeckStore((s) => s.decks[deck]?.track)
  const simulated = useLiveStore((s) => s.source === 'simulator')
  return (
    <header className="flex items-start gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-2xl font-bold text-slate-950"
        style={{ backgroundColor: DECK_COLORS[deck] }}
        aria-label={`Deck ${deck}`}
      >
        {deck}
      </span>
      <Artwork url={art} />
      <Labeled
        label="Track"
        origin={track ? track.origin : 'ETH_LIBRARY'}
        stampKey={`d${deck}.track`}
        className="flex-1"
      >
        <TrackText deck={deck} />
      </Labeled>
      {simulated && (
        <span className="rounded border border-amber-500 bg-amber-950 px-2 py-0.5 text-xs font-bold text-amber-300">
          SIMULATED
        </span>
      )}
    </header>
  )
}

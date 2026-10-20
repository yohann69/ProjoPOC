import type { DeckId } from '@shared/types'
import { epochNow } from '../../lib/frameLoop'
import { DECK_COLORS } from '../../lib/deckColors'
import type { SnapshotView } from '../../lib/dataFold'
import { useDeckStore } from '../../store/useDeckStore'
import { useTicker } from '../../ui/primitives'
import { Chip, InfoCard, InfoGroup } from './InfoGrid'
import {
  FLAGS,
  STATUS_PLAYBACK,
  STATUS_SOURCE,
  TRACK_ANALYSIS,
  TRACK_FILE,
  TRACK_LIBRARY,
  otherRows,
  rowsFor,
  type Row
} from './formatters'

function TrackState({ track }: { track: SnapshotView | undefined }) {
  const state = String(track?.fields.state ?? '')
  const reason = track?.fields.reason
  if (!track) return <p className="text-sm text-slate-400">No track information yet.</p>
  if (state === 'ready') return null
  const text =
    state === 'loading'
      ? 'Reading the track from the USB stick\u2026'
      : state === 'unavailable'
        ? `Track details unavailable: ${reason ?? 'unknown reason'}`
        : 'No track loaded.'
  return <p className="text-sm text-amber-200">{text}</p>
}

/** Everything known about one deck: live playback, where the track comes from, library row and analysis. */
export function DeckDetails({
  deck,
  status,
  track
}: {
  deck: DeckId
  status: SnapshotView | undefined
  track: SnapshotView | undefined
}) {
  useTicker(500)
  const now = epochNow()
  const artwork = useDeckStore((s) => s.decks[deck]?.track?.value.artworkUrl)
  const sf = status?.fields ?? {}
  const tf = track?.fields ?? {}
  const usedStatus = new Set<string>()
  const usedTrack = new Set<string>(['state', 'key', 'reason', 'id'])
  const playback = rowsFor(sf, STATUS_PLAYBACK, usedStatus)
  const source = rowsFor(sf, STATUS_SOURCE, usedStatus)
  FLAGS.forEach((f) => usedStatus.add(f.key))
  usedStatus.add('derived.deck')
  usedStatus.add('deviceType')
  usedStatus.add('packetNum')
  const library = rowsFor(tf, TRACK_LIBRARY, usedTrack)
  const file = rowsFor(tf, TRACK_FILE, usedTrack)
  const analysis = rowsFor(tf, TRACK_ANALYSIS, usedTrack)
  const other: Row[] = [...otherRows(sf, usedStatus), ...otherRows(tf, usedTrack)]
  const title = String(tf.title ?? '') || 'No track'
  const artist = [tf['artist.name'], tf['album.name']].filter(Boolean).join(' \u00b7 ')
  const changed = { ...status?.changedAt, ...track?.changedAt }
  return (
    <InfoCard
      title={`Deck ${deck}`}
      updatedAt={Math.max(status?.updatedAt ?? 0, track?.updatedAt ?? 0)}
      now={now}
    >
      <header className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-2xl font-bold text-slate-950"
          style={{ backgroundColor: DECK_COLORS[deck] }}
        >
          {deck}
        </span>
        {artwork ? (
          <img
            src={artwork}
            alt="Album artwork"
            className="size-20 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded border border-dashed border-slate-700 text-[10px] text-slate-400">
            no artwork
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-slate-50">{title}</p>
          <p className="truncate text-slate-200">{artist || '\u2013'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FLAGS.map((f) => (
              <Chip key={f.key} on={sf[f.key] === true} label={f.label} />
            ))}
          </div>
        </div>
      </header>
      <TrackState track={track} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-x-6 gap-y-4">
        <InfoGroup title="Playback" rows={playback} changedAt={changed} now={now} />
        <InfoGroup title="Playing from" rows={source} changedAt={changed} now={now} />
        <InfoGroup title="Track" rows={library} changedAt={changed} now={now} />
        <InfoGroup title="File" rows={file} changedAt={changed} now={now} />
        <InfoGroup title="Analysis" rows={analysis} changedAt={changed} now={now} />
        <InfoGroup title="Other" rows={other} changedAt={changed} now={now} />
      </div>
    </InfoCard>
  )
}

import type { DeckId } from '@shared/types'
import { formatBpm, formatPitch } from '../../lib/format'
import { useDeckStore } from '../../store/useDeckStore'
import { Labeled, NotAvailable, Waiting, useFieldSupport } from '../../ui/primitives'

function Chip({ label, on, tone }: { label: string; on: boolean | undefined; tone: string }) {
  const state = on === undefined ? 'unknown' : on ? 'on' : 'off'
  return (
    <span
      aria-label={`${label}: ${state}`}
      className={`rounded-md border px-2.5 py-1 text-sm font-bold ${
        on ? tone : 'border-slate-700 text-slate-400'
      }`}
    >
      {label}
    </span>
  )
}

const PLAY_TONES = {
  playing: 'border-emerald-500 bg-emerald-950 text-emerald-300',
  paused: 'border-slate-500 bg-slate-800 text-slate-200',
  cued: 'border-sky-500 bg-sky-950 text-sky-300',
  empty: 'border-slate-700 text-slate-400'
}

export function StatusChips({ deck }: { deck: DeckId }) {
  const play = useDeckStore((s) => s.decks[deck]?.playState)
  const master = useDeckStore((s) => s.decks[deck]?.isMaster)
  const sync = useDeckStore((s) => s.decks[deck]?.isSynced)
  const onAir = useDeckStore((s) => s.decks[deck]?.isOnAir)
  const state = play?.value
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`rounded-md border px-2.5 py-1 text-sm font-bold uppercase ${state ? PLAY_TONES[state] : PLAY_TONES.empty}`}
      >
        {state ?? 'no data'}
      </span>
      <Chip label="MASTER" on={master?.value} tone="border-amber-400 bg-amber-950 text-amber-300" />
      <Chip label="SYNC" on={sync?.value} tone="border-sky-400 bg-sky-950 text-sky-300" />
      <Chip label="ON-AIR" on={onAir?.value} tone="border-red-400 bg-red-950 text-red-300" />
    </div>
  )
}

export function BpmBlock({ deck }: { deck: DeckId }) {
  const bpm = useDeckStore((s) => s.decks[deck]?.bpm)
  const pitch = useDeckStore((s) => s.decks[deck]?.pitchPercent)
  const trackBpm = useDeckStore((s) => s.decks[deck]?.track?.value.bpmGrid.bpm)
  const supported = useFieldSupport('bpm')
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Labeled label="BPM" origin="ETH_LIVE" stampKey={`d${deck}.bpm`}>
        {!supported ? (
          <NotAvailable />
        ) : bpm ? (
          <span className="text-6xl font-bold leading-none tabular-nums text-slate-50">
            {formatBpm(bpm.value)}
          </span>
        ) : (
          <Waiting text="no tempo yet" />
        )}
      </Labeled>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Labeled label="Pitch" origin="ETH_LIVE" stampKey={`d${deck}.pitchPercent`}>
          <span className="text-xl tabular-nums text-slate-50">
            {pitch ? formatPitch(pitch.value) : <Waiting text="no pitch" />}
          </span>
        </Labeled>
        <Labeled label="Track BPM" origin="ETH_LIBRARY" stampKey={`d${deck}.track`}>
          <span className="text-xl tabular-nums text-slate-50">
            {trackBpm !== undefined ? formatBpm(trackBpm) : <Waiting text="no track" />}
          </span>
        </Labeled>
      </div>
    </div>
  )
}

/** Play state and MASTER / SYNC / ON-AIR chips on one full-width row. */
export function StateRow({ deck }: { deck: DeckId }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Labeled label="State" origin="ETH_LIVE" stampKey={`d${deck}.playState`}>
        <StatusChips deck={deck} />
      </Labeled>
    </div>
  )
}

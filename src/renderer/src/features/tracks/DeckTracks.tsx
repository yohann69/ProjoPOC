import { DECK_IDS, type TrackLoadState } from '@shared/types'
import { useLiveStore } from '../../store/useLiveStore'

const STATE_STYLES: Record<TrackLoadState, string> = {
  idle: 'text-slate-500',
  loading: 'text-sky-300',
  ready: 'text-emerald-300',
  unavailable: 'text-amber-300'
}

export function DeckTracks() {
  const status = useLiveStore((s) => s.trackStatus)
  const tracks = useLiveStore((s) => s.tracks)
  return (
    <section className="flex flex-col gap-2 rounded border border-white/10 p-3">
      <h2 className="text-sm font-semibold text-white">Track metadata</h2>
      <ul className="flex flex-col gap-1 text-xs">
        {DECK_IDS.map((deck) => {
          const s = status[deck]
          const track = tracks[deck]
          if (!s) return null
          return (
            <li key={deck} className="flex flex-col font-mono">
              <span>
                <span className="text-slate-400">deck {deck} </span>
                <span className={STATE_STYLES[s.state]}>{s.state}</span>
                {track && (
                  <span className="text-slate-200">
                    {' '}
                    — {track.title} / {track.artist} · {track.key} · {track.bpmGrid.bpm} bpm
                  </span>
                )}
              </span>
              {s.message && <span className="text-amber-300/80">{s.message}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

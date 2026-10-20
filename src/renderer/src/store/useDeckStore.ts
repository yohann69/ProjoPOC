import type { AppEvent, DeckId, PlayState, Tagged, TrackInfo, TrackLoadState } from '@shared/types'
import { create } from 'zustand'

/** Slow-changing, React-visible deck data. Beat and position values live in `liveData` instead. */
export interface DeckView {
  playState?: Tagged<PlayState>
  bpm?: Tagged<number>
  pitchPercent?: Tagged<number>
  isMaster?: Tagged<boolean>
  isSynced?: Tagged<boolean>
  isOnAir?: Tagged<boolean>
  trackId?: Tagged<string | null>
  track?: Tagged<TrackInfo>
  trackStatus?: { state: TrackLoadState; message?: string }
  hasPosition: boolean
}

interface DeckStore {
  decks: Partial<Record<DeckId, DeckView>>
  apply(events: AppEvent[]): void
  reset(): void
}

const BPM_EPSILON = 0.005

/** Keeps the previous object when the value did not change, so selectors do not re-render. */
function keep<T>(
  previous: Tagged<T> | undefined,
  next: Tagged<T> | undefined,
  equal: (a: T, b: T) => boolean = Object.is
): Tagged<T> | undefined {
  if (previous && next && previous.origin === next.origin && equal(previous.value, next.value)) {
    return previous
  }
  return next
}

const nearly = (a: number, b: number): boolean => Math.abs(a - b) < BPM_EPSILON

export function applyToDecks(decks: DeckStore['decks'], events: AppEvent[]): DeckStore['decks'] {
  let next = decks
  const update = (deck: DeckId, change: (view: DeckView) => DeckView): void => {
    const view = next[deck] ?? { hasPosition: false }
    const changed = change(view)
    if (changed !== view) next = { ...next, [deck]: changed }
  }
  for (const event of events) {
    if (event.type === 'deckState') {
      const s = event.state
      update(s.deck, (v) => {
        const merged: DeckView = {
          ...v,
          playState: keep(v.playState, s.playState),
          bpm: keep(v.bpm, s.bpm, nearly),
          pitchPercent: keep(v.pitchPercent, s.pitchPercent, nearly),
          isMaster: keep(v.isMaster, s.isMaster),
          isSynced: keep(v.isSynced, s.isSynced),
          isOnAir: keep(v.isOnAir, s.isOnAir),
          trackId: keep(v.trackId, s.trackId),
          hasPosition: v.hasPosition || s.positionMs !== undefined
        }
        return (Object.keys(merged) as (keyof DeckView)[]).every((k) => merged[k] === v[k])
          ? v
          : merged
      })
    } else if (event.type === 'track') {
      update(event.deck, (v) => ({ ...v, track: event.track ?? undefined }))
    } else if (event.type === 'trackStatus') {
      update(event.deck, (v) => ({
        ...v,
        trackStatus: { state: event.state, message: event.message }
      }))
    }
  }
  return next
}

export const useDeckStore = create<DeckStore>((set) => ({
  decks: {},
  apply: (events) => {
    set((state) => {
      const decks = applyToDecks(state.decks, events)
      return decks === state.decks ? state : { decks }
    })
  },
  reset: () => set({ decks: {} })
}))

export const isDeckActive = (view: DeckView | undefined): boolean =>
  !!view &&
  ((view.playState !== undefined && view.playState.value !== 'empty') || !!view.trackId?.value)

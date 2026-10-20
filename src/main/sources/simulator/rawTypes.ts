import type { BeatInBar, DeckId, PlayState, SourceState, TrackInfo } from '@shared/types'

export interface SimChannelRaw {
  deck: DeckId
  fader: number
  eqHigh: number
  eqMid: number
  eqLow: number
}

/** Simulator-specific events, shaped like what a hardware source would hand to the normalizer. */
export type SimRawEvent =
  | {
      kind: 'deck'
      ts: number
      deck: DeckId
      playState: PlayState
      trackId: string | null
      /** Effective BPM (track BPM adjusted by pitch). */
      bpm: number | null
      pitchPercent: number | null
      beatInBar: BeatInBar | null
      /** Playhead position, like the CDJ-3000 absolute position packets. */
      positionMs?: number | null
      isMaster: boolean
      isSynced: boolean
      isOnAir: boolean
    }
  | { kind: 'beat'; ts: number; deck: DeckId; beatInBar: BeatInBar }
  | { kind: 'track'; ts: number; deck: DeckId; track: TrackInfo | null }
  | { kind: 'mixer'; ts: number; crossfader: number; channels: SimChannelRaw[] }
  | { kind: 'devices'; ts: number; decks: DeckId[] }
  | { kind: 'status'; ts: number; state: SourceState; message?: string }

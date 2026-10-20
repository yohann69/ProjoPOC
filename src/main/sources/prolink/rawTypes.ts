import type {
  AppEvent,
  BeatInBar,
  DeckId,
  SourceState,
  TrackInfo,
  TrackLoadState
} from '@shared/types'

export type ProlinkDeviceKind = 'player' | 'mixer' | 'rekordbox' | 'other'

export interface ProlinkDevice {
  id: number
  name: string
  ip: string
  kind: ProlinkDeviceKind
  /** Deck this player was mapped to; absent for mixers and anything else. */
  deck?: DeckId
}

/** One CDJ status packet reduced to the fields DeckPulse reads (see alphatheta-connect CDJStatus.State). */
export interface ProlinkDeckStatus {
  deviceId: number
  trackId: number
  trackDeviceId: number
  trackSlot: number
  trackType: number
  /** Raw CDJStatus.PlayState code. */
  playState: number
  isOnAir: boolean
  isSync: boolean
  isMaster: boolean
  trackBpm: number | null
  /** Pitch in effect, in percent. */
  effectivePitch: number
  /** 1-4, or 0 when no track is loaded. */
  beatInMeasure: number
  /** Beat counter of the track (1 = first grid beat); null when the player reports none. */
  beat: number | null
}

/** Prolink-specific events handed to the normalizer. */
export type ProlinkRawEvent =
  | { kind: 'status'; ts: number; state: SourceState; message?: string }
  | { kind: 'devices'; ts: number; devices: ProlinkDevice[] }
  | {
      kind: 'deck'
      ts: number
      deck: DeckId
      status: ProlinkDeckStatus
      /** Playhead derived from the beat counter and the track's beat grid, when both are known. */
      positionMs?: number | null
    }
  | {
      kind: 'beat'
      ts: number
      deck: DeckId
      beatInBar: BeatInBar
      trackBpm: number | null
      pitchPercent: number | null
    }
  | { kind: 'track'; ts: number; deck: DeckId; track: TrackInfo | null }
  | { kind: 'trackStatus'; ts: number; deck: DeckId; state: TrackLoadState; message?: string }
  | { kind: 'log'; ts: number; level: 'info' | 'warn' | 'error'; message: string }
  /** Packet inspector output; already in the unified event shape. */
  | { kind: 'inspector'; event: AppEvent }

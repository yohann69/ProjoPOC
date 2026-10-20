/** Where a value really came from, so the UI never mislabels it. */
import type { HookEvent, HookServerStatus } from './hooks'
import type { TransitionSignal } from './transition'

export type Origin = 'ETH_LIVE' | 'ETH_LIBRARY' | 'USBC' | 'DERIVED'

export type Tagged<T> = { value: T; origin: Origin; ts: number }

export type DeckId = 1 | 2 | 3 | 4
export const DECK_IDS: readonly DeckId[] = [1, 2, 3, 4]

export type SourceId = 'simulator' | 'prolink' | 'usbc' | 'audio' | 'replay'
export type SourceState =
  | 'stopped'
  | 'starting'
  | 'connecting'
  | 'running'
  | 'online'
  | 'noDevices'
  | 'permissionDenied'
  | 'rekordboxConflict'
  | 'error'

export type PlayState = 'empty' | 'cued' | 'paused' | 'playing'
export type BeatInBar = 1 | 2 | 3 | 4

export interface DeckState {
  deck: DeckId
  playState: Tagged<PlayState>
  bpm?: Tagged<number>
  pitchPercent?: Tagged<number>
  beatInBar?: Tagged<BeatInBar>
  /** 0..1 position inside the current beat. */
  beatPhase?: Tagged<number>
  /** Playhead position in the track, when the source reports it. */
  positionMs?: Tagged<number>
  trackId?: Tagged<string | null>
  isMaster?: Tagged<boolean>
  isSynced?: Tagged<boolean>
  isOnAir?: Tagged<boolean>
}

export interface Cue {
  type: 'hot' | 'memory'
  positionMs: number
  color?: string
  label?: string
}

export interface Loop {
  startMs: number
  endMs: number
  label?: string
}

export type PhraseKind =
  'intro' | 'verse' | 'bridge' | 'up' | 'down' | 'chorus' | 'drop' | 'outro' | 'other'

export interface Phrase {
  startMs: number
  endMs: number
  kind: PhraseKind
}

export interface Waveform {
  /** Preview heights, 0..255. */
  heights: Uint8Array
  bands?: { low: Uint8Array; mid: Uint8Array; high: Uint8Array }
}

export interface BeatGrid {
  bpm: number
  firstBeatMs: number
}

export interface TrackInfo {
  id: string
  title: string
  artist: string
  album: string
  key: string
  genre: string
  durationMs: number
  bpmGrid: BeatGrid
  artworkUrl?: string
  cues: Cue[]
  loops: Loop[]
  waveform?: Waveform
  phrases: Phrase[]
}

/** Levels are normalized 0..1. */
export interface ChannelState {
  fader?: Tagged<number>
  eqHigh?: Tagged<number>
  eqMid?: Tagged<number>
  eqLow?: Tagged<number>
  trim?: Tagged<number>
  /** The COLOR FX knob: 0 is fully left, 1 fully right. */
  color?: Tagged<number>
}

export interface MixerState {
  /** Set when the values come from the optional USB-C source rather than the simulator. */
  source?: SourceId
  crossfader?: Tagged<number>
  channels: Partial<Record<DeckId, ChannelState>>
}

export interface DeviceInfo {
  id: string
  name: string
  kind: 'player' | 'mixer' | 'other'
  deck?: DeckId
  origin: Origin
  ip?: string
  /** Device number as announced on the network. */
  deviceNumber?: number
}

export type TrackLoadState = 'idle' | 'loading' | 'ready' | 'unavailable'

export type FieldValue = string | number | boolean | null

export interface PortStats {
  port: number
  packetsPerSecond: number
  total: number
  /** Packet counts by decoded kind, e.g. `beat` or `type_0x2a`. */
  kinds: Record<string, number>
}

export type AppEvent =
  | { type: 'deckState'; state: DeckState }
  | { type: 'track'; deck: DeckId; track: Tagged<TrackInfo> | null }
  | { type: 'mixer'; mixer: MixerState }
  | { type: 'beat'; deck: DeckId; beatInBar: BeatInBar; ts: number; origin: Origin }
  | {
      type: 'transition'
      fromDeck: DeckId
      toDeck: DeckId
      confidence: number
      ts: number
      origin: Origin
      /** Evidence behind the confidence, including signals that were not available. */
      signals?: TransitionSignal[]
    }
  | { type: 'deviceList'; devices: DeviceInfo[] }
  | { type: 'sourceStatus'; source: SourceId; state: SourceState; message?: string }
  | {
      type: 'rawPacket'
      source: SourceId
      port: number
      length: number
      hexPreview: string
      /** Decoded kind when known. */
      kind?: string
    }
  | { type: 'packetStats'; source: SourceId; ports: PortStats[] }
  | {
      /** Every field a source can read for one thing (a deck, device, track...), undecorated. */
      type: 'dataSnapshot'
      source: SourceId
      /** Dotted id such as `eth.deck.1`; the first segments tell the UI where to file it. */
      group: string
      title: string
      fields: Record<string, FieldValue>
      ts: number
    }
  | {
      /** Latest bytes of one kind of packet from one sender, whole, for byte-level study. */
      type: 'packetDump'
      source: SourceId
      key: string
      port: number
      kind: string
      srcAddr: string
      /** Device number byte (0x21) when the packet has the Pro DJ Link header. */
      device: number | null
      length: number
      /** Space-separated lowercase hex bytes. */
      hex: string
      /** Packets of this kind seen from this sender so far. */
      count: number
      ts: number
    }
  | { type: 'trackStatus'; deck: DeckId; state: TrackLoadState; message?: string }
  | {
      type: 'sourceLog'
      source: SourceId
      level: 'info' | 'warn' | 'error'
      message: string
      ts: number
    }
  | { type: 'hook'; hook: HookEvent }
  | { type: 'hookServer'; status: HookServerStatus }
  | {
      type: 'energy'
      ts: number
      /** Linear RMS, 0..1. */
      rms: number
      /** Band levels, 0..1 (see lib/audio/bands.ts for the mapping). */
      bands: { low: number; mid: number; high: number }
      origin: Origin
    }
  | { type: 'onset'; ts: number; strength: number; origin: Origin }
  | { type: 'drop'; ts: number; phase: 'buildup' | 'drop'; origin: Origin }

export type AppEventType = AppEvent['type']

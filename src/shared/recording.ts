import type { AppEvent, SourceId, SourceState } from './types'
import type { IngestEvent } from './usb'

export interface ReplayConfig {
  /** Absolute path of a DeckPulse JSONL recording. */
  path: string
  loop: boolean
}

export const DEFAULT_REPLAY_CONFIG: ReplayConfig = { path: '', loop: false }

export const RECORDING_VERSION = 1

export interface RecordingHeader {
  type: 'header'
  version: typeof RECORDING_VERSION
  app: 'DeckPulse'
  /** Epoch ms when recording started. */
  startedAt: number
  /** Primary source running when recording started, if any. */
  source: SourceId | null
}

/** One line of a recording after the header. `t` is the wall-clock time it was captured. */
export type RecordingRecord =
  | { type: 'raw'; t: number; source: 'prolink' | 'simulator'; raw: unknown }
  | { type: 'event'; t: number; event: AppEvent }
  | { type: 'ingest'; t: number; events: IngestEvent[] }

/** What the replay source hands to the pipeline. */
export type ReplayItem =
  | { kind: 'raw'; source: 'prolink' | 'simulator'; raw: unknown }
  | { kind: 'event'; event: AppEvent }
  | { kind: 'ingest'; events: IngestEvent[] }
  | { kind: 'restart' }
  | { kind: 'status'; state: SourceState; message?: string; recordedFrom?: SourceId | null }

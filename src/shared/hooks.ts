import type { TransitionSignal } from './transition'
import type { BeatInBar, DeckId, Origin, PhraseKind, SourceId } from './types'

export const DEFAULT_HOOK_PORT = 8765

interface HookBase {
  ts: number
  origin: Origin
  /** Source that produced the data; `simulated` is true for the simulator so visuals can tell. */
  source: SourceId
  simulated: boolean
}

/** Normalized events a visuals engine subscribes to; they are also the JSON sent over the WebSocket. */
export type HookEvent =
  | (HookBase & { type: 'beat'; deck: DeckId; beatInBar: BeatInBar; bpm: number | null })
  | (HookBase & {
      type: 'phraseChange'
      deck: DeckId
      from: PhraseKind | null
      to: PhraseKind
      /** Real time until the next phrase boundary, when known. */
      nextChangeInMs: number | null
    })
  | (HookBase & {
      type: 'transition'
      fromDeck: DeckId
      toDeck: DeckId
      confidence: number
      signals: TransitionSignal[]
    })
  | (HookBase & { type: 'bpmChange'; deck: DeckId; bpm: number; previousBpm: number })
  | (HookBase & {
      type: 'energy'
      rms: number
      bands: { low: number; mid: number; high: number }
    })
  | (HookBase & { type: 'onset'; strength: number })
  | (HookBase & { type: 'drop'; phase: 'buildup' | 'drop' })

export type HookEventType = HookEvent['type']

export interface HookServerStatus {
  listening: boolean
  port: number | null
  clients: number
  error?: string
}

export interface HookRequest {
  enabled: boolean
  port: number
}

export interface DashboardSettings {
  showAllDecks: boolean
  reduceMotion: boolean
  hookPort: number
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  showAllDecks: false,
  reduceMotion: false,
  hookPort: DEFAULT_HOOK_PORT
}

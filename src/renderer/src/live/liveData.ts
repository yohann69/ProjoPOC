import {
  DECK_IDS,
  type AppEvent,
  type DeckId,
  type DeckState,
  type SourceState
} from '@shared/types'
import { epochNow } from '../lib/frameLoop'
import { clearStamps, stamp } from '../lib/freshness'
import { PhaseSmoother } from '../lib/phaseSmoother'
import { resetBpmHistory } from './bpmHistory'
import { applyMixer, resetMixerPrimary } from './mixerLive'
import { addTransition, resetTimeline, setAudible } from './timeline'

/** Mutable per-deck values read by animation loops; kept out of React so beats cost no renders. */
export interface DeckLive {
  smoother: PhaseSmoother
  beatInBar: number | null
  /** Increments on every beat so a loop can tell a new beat from the previous frame. */
  beatCount: number
  bpm: number | null
  pitchPercent: number
  playing: boolean
  posMs: number | null
  posTs: number
  durationMs: number | null
}

const makeLive = (): DeckLive => ({
  smoother: new PhaseSmoother(),
  beatInBar: null,
  beatCount: 0,
  bpm: null,
  pitchPercent: 0,
  playing: false,
  posMs: null,
  posTs: 0,
  durationMs: null
})

export const deckLive: Record<DeckId, DeckLive> = {
  1: makeLive(),
  2: makeLive(),
  3: makeLive(),
  4: makeLive()
}

export function resetLive(): void {
  for (const deck of DECK_IDS) deckLive[deck] = makeLive()
  clearStamps()
  resetTimeline()
  resetBpmHistory()
  resetMixerPrimary()
}

/** Playhead position extrapolated to `now`, or null when the source reports none. */
export function livePosition(live: DeckLive, now: number): number | null {
  if (live.posMs === null) return null
  const elapsed = live.playing ? (now - live.posTs) * (1 + live.pitchPercent / 100) : 0
  return Math.max(0, Math.min(live.durationMs ?? Infinity, live.posMs + elapsed))
}

function applyDeckState(state: DeckState): void {
  const live = deckLive[state.deck]
  const key = `d${state.deck}.`
  live.playing = state.playState.value === 'playing'
  live.bpm = state.bpm?.value ?? null
  live.pitchPercent = state.pitchPercent?.value ?? 0
  if (state.bpm) live.smoother.setPeriod(60000 / state.bpm.value)
  if (!live.playing) live.smoother.reset()
  if (state.positionMs) {
    live.posMs = state.positionMs.value
    live.posTs = state.positionMs.ts
  } else live.posMs = null
  const fields = [
    'playState',
    'bpm',
    'pitchPercent',
    'isMaster',
    'isSynced',
    'isOnAir',
    'positionMs'
  ] as const
  for (const field of fields) {
    const tagged = state[field]
    if (tagged) stamp(key + field, tagged.ts)
  }
  setAudible(state.deck, live.playing && state.isOnAir?.value === true, state.playState.ts)
}

/** States in which the source is delivering data; any other state freezes the live values. */
export const LIVE_STATES: readonly SourceState[] = ['starting', 'running', 'online']

export function applyLive(events: AppEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'beat': {
        const live = deckLive[event.deck]
        live.beatInBar = event.beatInBar
        live.beatCount++
        const period = live.bpm ? 60000 / live.bpm : 500
        live.smoother.onBeat(event.ts, period, epochNow())
        stamp(`d${event.deck}.beat`, event.ts)
        break
      }
      case 'deckState':
        applyDeckState(event.state)
        break
      case 'track': {
        const live = deckLive[event.deck]
        live.durationMs = event.track?.value.durationMs ?? null
        if (event.track) stamp(`d${event.deck}.track`, event.track.ts)
        break
      }
      case 'transition':
        addTransition({
          ts: event.ts,
          fromDeck: event.fromDeck,
          toDeck: event.toDeck,
          confidence: event.confidence,
          signals: event.signals ?? []
        })
        break
      case 'mixer':
        applyMixer(event.mixer)
        break
      case 'sourceStatus':
        if (LIVE_STATES.includes(event.state)) break
        for (const deck of DECK_IDS) {
          deckLive[deck].playing = false
          deckLive[deck].smoother.reset()
          setAudible(deck, false, epochNow())
        }
        break
      default:
        break
    }
  }
}

import {
  TRANSITION_WEIGHTS,
  type TransitionSignal,
  type TransitionSignalName
} from '@shared/transition'
import type { DeckId } from '@shared/types'
import type { DeckTracker } from './deckSignals'
import { MixerHistory } from './mixerHistory'

export interface AudioFacts {
  lastEnergyTs: number | null
  lastDropTs: number | null
}

export const MIN_OVERLAP_MS = 2000
const RECENT_MS = 30_000
const FADER_MOVE = 0.4
const BPM_TOLERANCE = 0.01
const AUDIO_FRESH_MS = 3000
const DROP_WINDOW_MS = 20_000

const secs = (ms: number): string => `${(ms / 1000).toFixed(1)} s`

/** Judges every signal for a hand-off, separating "not available" from "available but not seen". */
export function evaluateSignals(
  from: DeckId,
  to: DeckId,
  ts: number,
  decks: DeckTracker,
  mixer: MixerHistory,
  audio: AudioFacts
): TransitionSignal[] {
  const a = decks.facts.get(from)
  const b = decks.facts.get(to)
  const both = !!a && !!b
  const out: TransitionSignal[] = []
  const add = (name: TransitionSignalName, available: boolean, detail: string | null): void => {
    const signal: TransitionSignal = {
      name,
      weight: TRANSITION_WEIGHTS[name],
      available,
      contributed: available && detail !== null
    }
    if (available && detail !== null) signal.detail = detail
    out.push(signal)
  }

  const moved = decks.lastMasterChange
  const masterSeen = moved && moved.from === from && moved.to === to && ts - moved.ts <= RECENT_MS
  add('masterChange', both, masterSeen ? `master moved ${from} to ${to}` : null)

  const overlap = decks.overlapMs(from, to, ts)
  add('overlap', both, overlap >= MIN_OVERLAP_MS ? `${secs(overlap)} both audible` : null)

  const toOn = decks.onAirChange.get(to)
  const fromOff = decks.onAirChange.get(from)
  const onAirRecent = toOn?.to && ts - toOn.ts <= RECENT_MS
  const offAirRecent = fromOff && !fromOff.to && ts - fromOff.ts <= RECENT_MS
  const onAirKnown = !!a && !!b && a.onAir !== null && b.onAir !== null
  add('onAir', onAirKnown, onAirRecent || offAirRecent ? 'on-air flag changed' : null)

  const bpmA = a?.bpm
  const bpmB = b?.bpm
  const bpmClose = !!bpmA && !!bpmB && Math.abs(bpmA - bpmB) / bpmA < BPM_TOLERANCE
  add('bpmSync', both, b?.synced ? 'target deck synced' : bpmClose ? 'BPMs within 1%' : null)

  const known = (mixer.hasFader(from) && mixer.hasFader(to)) || mixer.hasCrossfader()
  const crossfade = mixer.swing('crossfader', ts)
  const faders =
    mixer.swing(`ch${from}`, ts).fall >= FADER_MOVE && mixer.swing(`ch${to}`, ts).rise >= FADER_MOVE
  const fader = faders
    ? `channel ${from} fader down, ${to} up`
    : Math.max(crossfade.rise, crossfade.fall) >= FADER_MOVE
      ? 'crossfader moved'
      : null
  add('fader', known, fader)

  const fresh = audio.lastEnergyTs !== null && ts - audio.lastEnergyTs <= AUDIO_FRESH_MS
  const dropAge = audio.lastDropTs === null ? null : ts - audio.lastDropTs
  const drop = dropAge !== null && dropAge >= 0 && dropAge <= DROP_WINDOW_MS
  add('audio', fresh, drop ? `bass drop ${secs(dropAge)} earlier` : null)
  return out
}

/** Share of the available evidence that was seen, to two decimals. */
export function confidenceOf(signals: TransitionSignal[]): number {
  const available = signals.filter((s) => s.available).reduce((sum, s) => sum + s.weight, 0)
  const seen = signals.filter((s) => s.contributed).reduce((sum, s) => sum + s.weight, 0)
  return available === 0 ? 0 : Math.round((seen / available) * 100) / 100
}

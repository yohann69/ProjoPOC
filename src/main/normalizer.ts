import type {
  AppEvent,
  DeckId,
  DeckState,
  DeviceInfo,
  MixerState,
  Origin,
  Tagged
} from '@shared/types'
import type { SimChannelRaw, SimRawEvent } from './sources/simulator/rawTypes'
import { DerivedTracker } from './normalizer/derived'
import { normalizeProlink } from './normalizer/prolink'
import type { ProlinkRawEvent } from './sources/prolink/rawTypes'

const tag = <T>(value: T, origin: Origin, ts: number): Tagged<T> => ({ value, origin, ts })

/**
 * Turns source-specific events into the unified model. Stateful: it remembers the last beat per
 * deck (to derive beat phase). Transitions are derived later by the TransitionDetector.
 */
export class Normalizer {
  private readonly derived = new DerivedTracker()

  reset(): void {
    this.derived.reset()
  }

  fromProlink(raw: ProlinkRawEvent): AppEvent[] {
    return normalizeProlink(raw, this.derived)
  }

  /** The simulator mimics the hardware, so it reports the origins the real sources would use. */
  fromSimulator(raw: SimRawEvent): AppEvent[] {
    switch (raw.kind) {
      case 'deck':
        return this.deck(raw)
      case 'beat':
        this.derived.recordBeat(raw.deck, raw.ts)
        return [
          { type: 'beat', deck: raw.deck, beatInBar: raw.beatInBar, ts: raw.ts, origin: 'ETH_LIVE' }
        ]
      case 'track':
        return [
          {
            type: 'track',
            deck: raw.deck,
            track: raw.track && tag(raw.track, 'ETH_LIBRARY', raw.ts)
          }
        ]
      case 'mixer':
        return [{ type: 'mixer', mixer: this.mixer(raw.crossfader, raw.channels, raw.ts) }]
      case 'devices':
        return [{ type: 'deviceList', devices: this.devices(raw.decks) }]
      case 'status':
        return [
          { type: 'sourceStatus', source: 'simulator', state: raw.state, message: raw.message }
        ]
    }
  }

  private deck(raw: Extract<SimRawEvent, { kind: 'deck' }>): AppEvent[] {
    const { ts } = raw
    const state: DeckState = {
      deck: raw.deck,
      playState: tag(raw.playState, 'ETH_LIVE', ts),
      trackId: tag(raw.trackId, 'ETH_LIVE', ts),
      isMaster: tag(raw.isMaster, 'ETH_LIVE', ts),
      isSynced: tag(raw.isSynced, 'ETH_LIVE', ts),
      isOnAir: tag(raw.isOnAir, 'ETH_LIVE', ts)
    }
    if (raw.bpm !== null) state.bpm = tag(raw.bpm, 'ETH_LIVE', ts)
    if (raw.pitchPercent !== null) state.pitchPercent = tag(raw.pitchPercent, 'ETH_LIVE', ts)
    if (raw.beatInBar !== null) state.beatInBar = tag(raw.beatInBar, 'ETH_LIVE', ts)
    if (raw.positionMs != null) state.positionMs = tag(raw.positionMs, 'ETH_LIVE', ts)
    const beatPhase = this.derived.beatPhase(raw.deck, ts, raw.bpm, raw.playState)
    if (beatPhase) state.beatPhase = beatPhase
    return [{ type: 'deckState', state }]
  }

  private mixer(crossfader: number, channels: SimChannelRaw[], ts: number): MixerState {
    const mixer: MixerState = { crossfader: tag(crossfader, 'USBC', ts), channels: {} }
    for (const c of channels) {
      mixer.channels[c.deck] = {
        fader: tag(c.fader, 'USBC', ts),
        eqHigh: tag(c.eqHigh, 'USBC', ts),
        eqMid: tag(c.eqMid, 'USBC', ts),
        eqLow: tag(c.eqLow, 'USBC', ts)
      }
    }
    return mixer
  }

  private devices(decks: DeckId[]): DeviceInfo[] {
    const players: DeviceInfo[] = decks.map((deck) => ({
      id: `sim-deck-${deck}`,
      name: `Simulated deck ${deck}`,
      kind: 'player',
      deck,
      origin: 'ETH_LIVE'
    }))
    return [...players, { id: 'sim-mixer', name: 'Simulated mixer', kind: 'mixer', origin: 'USBC' }]
  }
}

import type { AppEvent, DeckState, DeviceInfo, Tagged } from '@shared/types'
import type { ProlinkRawEvent } from '../sources/prolink/rawTypes'
import { isPlayingCode, unifiedPlayState } from '../sources/prolink/playState'
import { trackKey } from '../sources/prolink/trackKey'
import type { DerivedTracker } from './derived'

const live = <T>(value: T, ts: number): Tagged<T> => ({ value, origin: 'ETH_LIVE', ts })

/** A raw pitch of 0 decodes to -100%; the XDJ-XZ reports it for a deck without a usable tempo (observed). */
const pitchKnown = (pitchPercent: number): boolean => pitchPercent > -100

function effectiveBpm(trackBpm: number | null, pitchPercent: number): number | null {
  if (!pitchKnown(pitchPercent)) return null
  return trackBpm === null ? null : Math.round(trackBpm * (1 + pitchPercent / 100) * 100) / 100
}

/**
 * Prolink events to the unified model: live status and beats are ETH_LIVE, rekordbox library
 * metadata is ETH_LIBRARY, beat phase is DERIVED. Mixer data is never invented:
 * nothing is emitted for it because no prolink field is mapped to it.
 */
export function normalizeProlink(raw: ProlinkRawEvent, tracker: DerivedTracker): AppEvent[] {
  switch (raw.kind) {
    case 'status':
      return [{ type: 'sourceStatus', source: 'prolink', state: raw.state, message: raw.message }]
    case 'devices':
      return [{ type: 'deviceList', devices: raw.devices.map(toDeviceInfo) }]
    case 'beat':
      tracker.recordBeat(raw.deck, raw.ts)
      return [
        { type: 'beat', deck: raw.deck, beatInBar: raw.beatInBar, ts: raw.ts, origin: 'ETH_LIVE' }
      ]
    case 'track':
      return [
        {
          type: 'track',
          deck: raw.deck,
          track: raw.track && { value: raw.track, origin: 'ETH_LIBRARY', ts: raw.ts }
        }
      ]
    case 'trackStatus':
      return [{ type: 'trackStatus', deck: raw.deck, state: raw.state, message: raw.message }]
    case 'log':
      return [
        { type: 'sourceLog', source: 'prolink', level: raw.level, message: raw.message, ts: raw.ts }
      ]
    case 'inspector':
      return [raw.event]
    case 'deck':
      return deckEvents(raw, tracker)
  }
}

function toDeviceInfo(
  d: Extract<ProlinkRawEvent, { kind: 'devices' }>['devices'][number]
): DeviceInfo {
  return {
    id: `prolink-${d.ip}-${d.id}`,
    name: d.name,
    kind: d.kind === 'player' || d.kind === 'mixer' ? d.kind : 'other',
    deck: d.deck,
    origin: 'ETH_LIVE',
    ip: d.ip,
    deviceNumber: d.id
  }
}

function deckEvents(
  raw: Extract<ProlinkRawEvent, { kind: 'deck' }>,
  tracker: DerivedTracker
): AppEvent[] {
  const { ts, deck, status: s } = raw
  const playState = unifiedPlayState(s.playState)
  const bpm = effectiveBpm(s.trackBpm, s.effectivePitch)
  const state: DeckState = {
    deck,
    playState: live(playState, ts),
    trackId: live(trackKey(s), ts),
    isMaster: live(s.isMaster, ts),
    isSynced: live(s.isSync, ts),
    isOnAir: live(s.isOnAir, ts)
  }
  if (bpm !== null) state.bpm = live(bpm, ts)
  if (s.trackId !== 0 && pitchKnown(s.effectivePitch))
    state.pitchPercent = live(s.effectivePitch, ts)
  if (isPlayingCode(s.playState) && s.beatInMeasure >= 1 && s.beatInMeasure <= 4) {
    state.beatInBar = live(s.beatInMeasure as 1 | 2 | 3 | 4, ts)
  }
  const phase = tracker.beatPhase(deck, ts, bpm, playState)
  if (phase) state.beatPhase = phase
  if (raw.positionMs != null) {
    state.positionMs = { value: raw.positionMs, origin: 'DERIVED', ts }
  }
  return [{ type: 'deckState', state }]
}

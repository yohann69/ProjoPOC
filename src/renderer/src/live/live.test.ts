import { describe, expect, it } from 'vitest'
import type { HookEvent } from '@shared/hooks'
import type { AppEvent, DeckState, Tagged } from '@shared/types'
import { mergeHooks } from '../store/useHookStore'
import { applyToDecks, isDeckActive } from '../store/useDeckStore'
import { applyLive, deckLive, livePosition, resetLive } from './liveData'
import { mixerLive, resetMixerUsbc } from './mixerLive'
import { computeOverlaps, type Span } from './timeline'

const live = <T>(value: T, ts: number): Tagged<T> => ({ value, origin: 'ETH_LIVE', ts })
const deckState = (over: Partial<DeckState> = {}): AppEvent => ({
  type: 'deckState',
  state: { deck: 1, playState: live('playing', 1), ...over }
})

describe('computeOverlaps', () => {
  const spans = (s: Partial<Record<1 | 2 | 3 | 4, Span[]>>) => ({
    1: [],
    2: [],
    3: [],
    4: [],
    ...s
  })

  it('finds the ranges where two decks are audible together', () => {
    const result = computeOverlaps(
      spans({ 1: [{ start: 0, end: 100 }], 2: [{ start: 60, end: 200 }] }),
      300
    )
    expect(result).toEqual([[60, 100]])
  })

  it('treats open spans as running until now and ignores touching spans', () => {
    expect(
      computeOverlaps(spans({ 1: [{ start: 0, end: 50 }], 2: [{ start: 50, end: null }] }), 300)
    ).toEqual([])
    expect(
      computeOverlaps(spans({ 1: [{ start: 0, end: null }], 3: [{ start: 100, end: null }] }), 300)
    ).toEqual([[100, 300]])
  })
})

describe('applyToDecks', () => {
  it('keeps the same object when only timestamps change, so selectors stay quiet', () => {
    const first = applyToDecks({}, [deckState({ bpm: live(128, 1) })])
    const second = applyToDecks(first, [deckState({ bpm: live(128.001, 2) })])
    expect(second).toBe(first)
    const third = applyToDecks(second, [deckState({ bpm: live(129, 3) })])
    expect(third).not.toBe(second)
    expect(third[1]?.bpm?.value).toBe(129)
  })

  it('replaces only the changed field and records that a position was seen', () => {
    const first = applyToDecks({}, [deckState({ bpm: live(128, 1) })])
    const next = applyToDecks(first, [
      deckState({ bpm: live(128, 2), positionMs: live(5000, 2), isMaster: live(true, 2) })
    ])
    expect(next[1]?.bpm).toBe(first[1]?.bpm)
    expect(next[1]?.isMaster?.value).toBe(true)
    expect(next[1]?.hasPosition).toBe(true)
  })

  it('marks a deck active once it plays or has a track', () => {
    const empty = applyToDecks({}, [
      { type: 'deckState', state: { deck: 2, playState: live('empty', 1) } }
    ])
    expect(isDeckActive(empty[2])).toBe(false)
    const playing = applyToDecks(empty, [
      {
        type: 'deckState',
        state: { deck: 2, playState: live('paused', 2), trackId: live<string | null>('x', 2) }
      }
    ])
    expect(isDeckActive(playing[2])).toBe(true)
  })

  it('stores track status and track info', () => {
    const next = applyToDecks({}, [
      {
        type: 'trackStatus',
        deck: 3,
        state: 'unavailable',
        message: 'USB not exported with rekordbox'
      }
    ])
    expect(next[3]?.trackStatus).toEqual({
      state: 'unavailable',
      message: 'USB not exported with rekordbox'
    })
  })
})

describe('live values', () => {
  const beat = (ts: number): AppEvent => ({
    type: 'beat',
    deck: 1,
    beatInBar: 1,
    ts,
    origin: 'ETH_LIVE'
  })

  it('extrapolates the playhead while playing and freezes it when the source stops', () => {
    resetLive()
    applyLive([
      {
        type: 'track',
        deck: 1,
        track: {
          value: {
            id: 't',
            title: '',
            artist: '',
            album: '',
            key: '',
            genre: '',
            durationMs: 100000,
            bpmGrid: { bpm: 120, firstBeatMs: 0 },
            cues: [],
            loops: [],
            phrases: []
          },
          origin: 'ETH_LIBRARY',
          ts: 1
        }
      },
      deckState({ positionMs: live(10000, 1000), pitchPercent: live(10, 1000) }),
      beat(1000)
    ])
    expect(livePosition(deckLive[1], 1500)).toBeCloseTo(10550, 5)
    expect(deckLive[1].beatCount).toBe(1)
    applyLive([{ type: 'sourceStatus', source: 'simulator', state: 'stopped' }])
    expect(livePosition(deckLive[1], 5000)).toBe(10000)
    expect(deckLive[1].smoother.phase(1100)).toBeNull()
  })

  it('returns no position when the source never reports one', () => {
    resetLive()
    applyLive([{ type: 'deckState', state: { deck: 2, playState: live('playing', 1) } }])
    expect(livePosition(deckLive[2], 2000)).toBeNull()
  })

  it('keeps USB-C mixer values apart from the primary mixer and across source resets', () => {
    resetLive()
    resetMixerUsbc()
    const usbc = {
      source: 'usbc' as const,
      channels: {},
      crossfader: { value: 1, origin: 'USBC' as const, ts: 2 }
    }
    const primary = { channels: {}, crossfader: { value: 0, origin: 'USBC' as const, ts: 1 } }
    applyLive([
      { type: 'mixer', mixer: primary },
      { type: 'mixer', mixer: usbc }
    ])
    expect(mixerLive.primary).toBe(primary)
    expect(mixerLive.usbc).toBe(usbc)
    resetLive()
    expect(mixerLive.primary).toBeNull()
    expect(mixerLive.usbc).toBe(usbc)
  })
})

describe('mergeHooks', () => {
  const hook = (type: 'beat' | 'bpmChange', ts: number): HookEvent =>
    type === 'beat'
      ? {
          type,
          deck: 1,
          beatInBar: 1,
          bpm: 120,
          ts,
          origin: 'ETH_LIVE',
          source: 'simulator',
          simulated: true
        }
      : {
          type,
          deck: 1,
          bpm: 121,
          previousBpm: 120,
          ts,
          origin: 'DERIVED',
          source: 'simulator',
          simulated: true
        }

  it('keeps rare hooks even when beats flood in', () => {
    let recent: HookEvent[] = [hook('bpmChange', 1)]
    for (let i = 0; i < 100; i++) recent = mergeHooks(recent, [hook('beat', 10 + i)])
    expect(recent.filter((h) => h.type === 'beat')).toHaveLength(20)
    expect(recent.filter((h) => h.type === 'bpmChange')).toHaveLength(1)
    expect(recent[0]?.ts).toBe(109)
  })
})

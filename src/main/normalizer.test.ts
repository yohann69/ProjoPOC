import { describe, expect, it } from 'vitest'
import { Normalizer } from './normalizer'
import type { SimRawEvent } from './sources/simulator/rawTypes'

type DeckRaw = Extract<SimRawEvent, { kind: 'deck' }>

const deckRaw = (overrides: Partial<DeckRaw> = {}): DeckRaw => ({
  kind: 'deck',
  ts: 1000,
  deck: 1,
  playState: 'playing',
  trackId: 'sim-1',
  bpm: 120,
  pitchPercent: 1.5,
  beatInBar: 2,
  isMaster: true,
  isSynced: false,
  isOnAir: true,
  ...overrides
})

describe('Normalizer', () => {
  it('maps deck fields to ETH_LIVE tagged values', () => {
    const [event] = new Normalizer().fromSimulator(deckRaw())
    expect(event).toMatchObject({
      type: 'deckState',
      state: {
        deck: 1,
        playState: { value: 'playing', origin: 'ETH_LIVE', ts: 1000 },
        bpm: { value: 120, origin: 'ETH_LIVE' },
        pitchPercent: { value: 1.5, origin: 'ETH_LIVE' },
        beatInBar: { value: 2, origin: 'ETH_LIVE' },
        isMaster: { value: true, origin: 'ETH_LIVE' }
      }
    })
  })

  it('omits fields the source does not know', () => {
    const [event] = new Normalizer().fromSimulator(
      deckRaw({ playState: 'empty', trackId: null, bpm: null, pitchPercent: null, beatInBar: null })
    )
    if (event?.type !== 'deckState') throw new Error('expected deckState')
    expect(event.state.bpm).toBeUndefined()
    expect(event.state.pitchPercent).toBeUndefined()
    expect(event.state.beatInBar).toBeUndefined()
    expect(event.state.beatPhase).toBeUndefined()
  })

  it('derives beat phase from the last beat and tags it DERIVED', () => {
    const n = new Normalizer()
    n.fromSimulator({ kind: 'beat', ts: 1000, deck: 1, beatInBar: 1 })
    const [event] = n.fromSimulator(deckRaw({ ts: 1125, bpm: 120 }))
    if (event?.type !== 'deckState') throw new Error('expected deckState')
    expect(event.state.beatPhase?.origin).toBe('DERIVED')
    expect(event.state.beatPhase?.value).toBeCloseTo(0.25, 6)
  })

  it('clamps beat phase to 0..1 and skips it when not playing', () => {
    const n = new Normalizer()
    n.fromSimulator({ kind: 'beat', ts: 1000, deck: 1, beatInBar: 1 })
    const late = n.fromSimulator(deckRaw({ ts: 5000 }))[0]
    const paused = n.fromSimulator(deckRaw({ ts: 1100, playState: 'paused' }))[0]
    if (late?.type !== 'deckState' || paused?.type !== 'deckState') throw new Error('bad events')
    expect(late.state.beatPhase?.value).toBe(1)
    expect(paused.state.beatPhase).toBeUndefined()
  })

  it('tags beats ETH_LIVE, tracks ETH_LIBRARY and mixer USBC', () => {
    const n = new Normalizer()
    expect(n.fromSimulator({ kind: 'beat', ts: 5, deck: 2, beatInBar: 3 })).toEqual([
      { type: 'beat', deck: 2, beatInBar: 3, ts: 5, origin: 'ETH_LIVE' }
    ])
    const [track] = n.fromSimulator({ kind: 'track', ts: 7, deck: 1, track: null })
    expect(track).toEqual({ type: 'track', deck: 1, track: null })
    const [mixer] = n.fromSimulator({
      kind: 'mixer',
      ts: 9,
      crossfader: 0.5,
      channels: [{ deck: 3, fader: 1, eqHigh: 1, eqMid: 1, eqLow: 0.5 }]
    })
    if (mixer?.type !== 'mixer') throw new Error('expected mixer')
    expect(mixer.mixer.crossfader).toEqual({ value: 0.5, origin: 'USBC', ts: 9 })
    expect(mixer.mixer.channels[3]?.eqLow?.origin).toBe('USBC')
  })

  it('does not derive transitions itself; the TransitionDetector does', () => {
    const n = new Normalizer()
    n.fromSimulator(deckRaw({ deck: 1, isMaster: true }))
    const moved = n.fromSimulator(deckRaw({ deck: 2, isMaster: true, ts: 2000 }))
    expect(moved.map((e) => e.type)).toEqual(['deckState'])
  })

  it('maps status and device list', () => {
    const n = new Normalizer()
    expect(n.fromSimulator({ kind: 'status', ts: 1, state: 'running', message: 'ok' })).toEqual([
      { type: 'sourceStatus', source: 'simulator', state: 'running', message: 'ok' }
    ])
    const [devices] = n.fromSimulator({ kind: 'devices', ts: 1, decks: [1, 2] })
    if (devices?.type !== 'deviceList') throw new Error('expected deviceList')
    expect(devices.devices.map((d) => d.kind)).toEqual(['player', 'player', 'mixer'])
  })
})

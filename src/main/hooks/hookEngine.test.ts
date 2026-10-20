import { describe, expect, it } from 'vitest'
import type { AppEvent, DeckState, Tagged, TrackInfo } from '@shared/types'
import { BPM_CHANGE_THRESHOLD, HookEngine } from './hookEngine'

const tag = <T>(value: T, ts = 1000): Tagged<T> => ({ value, origin: 'ETH_LIVE', ts })

const state = (over: Partial<DeckState> = {}): AppEvent => ({
  type: 'deckState',
  state: { deck: 1, playState: tag('playing'), trackId: tag<string | null>('t1'), ...over }
})

const track = (): AppEvent => ({
  type: 'track',
  deck: 1,
  track: {
    value: {
      id: 't1',
      title: 'x',
      artist: 'y',
      album: '',
      key: '',
      genre: '',
      durationMs: 60000,
      bpmGrid: { bpm: 120, firstBeatMs: 0 },
      cues: [],
      loops: [],
      phrases: [
        { startMs: 0, endMs: 10000, kind: 'intro' },
        { startMs: 10000, endMs: 30000, kind: 'drop' }
      ]
    } satisfies TrackInfo,
    origin: 'ETH_LIBRARY',
    ts: 1
  }
})

describe('HookEngine', () => {
  it('turns beats into hooks that carry the latest BPM and flag simulated data', () => {
    const engine = new HookEngine('simulator')
    engine.process(state({ bpm: tag(128) }))
    const [hook] = engine.process({
      type: 'beat',
      deck: 1,
      beatInBar: 2,
      ts: 5,
      origin: 'ETH_LIVE'
    })
    expect(hook).toEqual({
      type: 'beat',
      deck: 1,
      beatInBar: 2,
      bpm: 128,
      ts: 5,
      origin: 'ETH_LIVE',
      source: 'simulator',
      simulated: true
    })
    const real = new HookEngine('prolink').process({
      type: 'beat',
      deck: 1,
      beatInBar: 1,
      ts: 1,
      origin: 'ETH_LIVE'
    })
    expect(real[0]).toMatchObject({ source: 'prolink', simulated: false, bpm: null })
  })

  it('announces a BPM change only after a real move, not for pitch drift', () => {
    const engine = new HookEngine('prolink')
    expect(engine.process(state({ bpm: tag(128) }))).toEqual([])
    expect(engine.process(state({ bpm: tag(128 + BPM_CHANGE_THRESHOLD / 2) }))).toEqual([])
    const [change] = engine.process(state({ bpm: tag(129, 2000) }))
    expect(change).toMatchObject({
      type: 'bpmChange',
      bpm: 129,
      previousBpm: 128,
      origin: 'DERIVED',
      ts: 2000
    })
    expect(engine.process(state({ bpm: tag(129.2) }))).toEqual([])
  })

  it('does not report a tempo change when a new track loads', () => {
    const engine = new HookEngine('prolink')
    engine.process(state({ bpm: tag(128) }))
    const next = state({ bpm: tag(140), trackId: tag<string | null>('t2') })
    expect(engine.process(next)).toEqual([])
  })

  it('emits phraseChange when the playhead enters a new section, with time to the next one', () => {
    const engine = new HookEngine('simulator')
    engine.process(track())
    const first = engine.process(state({ positionMs: tag(2000, 10) }))
    expect(first).toEqual([
      expect.objectContaining({
        type: 'phraseChange',
        from: null,
        to: 'intro',
        nextChangeInMs: 8000
      })
    ])
    expect(engine.process(state({ positionMs: tag(5000, 11) }))).toEqual([])
    const [drop] = engine.process(state({ positionMs: tag(10500, 12), pitchPercent: tag(5) }))
    expect(drop).toMatchObject({
      from: 'intro',
      to: 'drop',
      nextChangeInMs: Math.round(19500 / 1.05)
    })
  })

  it('stays quiet without position or phrase data and passes transitions through', () => {
    const engine = new HookEngine('simulator')
    expect(engine.process(state({}))).toEqual([])
    const [transition] = engine.process({
      type: 'transition',
      fromDeck: 1,
      toDeck: 2,
      confidence: 0.75,
      ts: 9,
      origin: 'DERIVED'
    })
    expect(transition).toMatchObject({
      type: 'transition',
      fromDeck: 1,
      toDeck: 2,
      confidence: 0.75,
      signals: []
    })
  })

  it('publishes audio analysis as DERIVED hooks from the audio source, never simulated', () => {
    const engine = new HookEngine('simulator')
    const bands = { low: 0.5, mid: 0.2, high: 0.1 }
    const origin = 'DERIVED'
    expect(engine.process({ type: 'energy', ts: 1, rms: 0.3, bands, origin })).toEqual([
      { type: 'energy', ts: 1, rms: 0.3, bands, origin, source: 'audio', simulated: false }
    ])
    expect(engine.process({ type: 'onset', ts: 2, strength: 0.8, origin })[0]).toMatchObject({
      type: 'onset',
      source: 'audio'
    })
    expect(engine.process({ type: 'drop', ts: 3, phase: 'drop', origin })[0]).toMatchObject({
      type: 'drop',
      phase: 'drop',
      simulated: false
    })
  })
})

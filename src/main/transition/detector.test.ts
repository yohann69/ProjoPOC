import { describe, expect, it } from 'vitest'
import type { AppEvent, DeckId, MixerState, PlayState } from '@shared/types'
import { TransitionDetector } from './detector'

const live = <T>(value: T, ts: number) => ({ value, origin: 'ETH_LIVE' as const, ts })

interface Deck {
  playing?: boolean
  onAir?: boolean
  master?: boolean
  synced?: boolean
  bpm?: number
}

function deck(id: DeckId, ts: number, d: Deck = {}): AppEvent {
  const playState: PlayState = d.playing === false ? 'paused' : 'playing'
  return {
    type: 'deckState',
    state: {
      deck: id,
      playState: live(playState, ts),
      trackId: live<string | null>(`t${id}`, ts),
      isMaster: live(d.master ?? false, ts),
      isSynced: live(d.synced ?? false, ts),
      isOnAir: live(d.onAir ?? true, ts),
      bpm: live(d.bpm ?? 120, ts)
    }
  }
}

const mixerAt = (ts: number, faders: Partial<Record<DeckId, number>>, xf?: number): AppEvent => {
  const mixer: MixerState = { source: 'usbc', channels: {} }
  for (const [id, v] of Object.entries(faders)) {
    mixer.channels[Number(id) as DeckId] = { fader: { value: v, origin: 'USBC', ts } }
  }
  if (xf !== undefined) mixer.crossfader = { value: xf, origin: 'USBC', ts }
  return { type: 'mixer', mixer }
}

const run = (d: TransitionDetector, events: AppEvent[]): AppEvent[] =>
  events.flatMap((e) => d.process(e))

type Transition = Extract<AppEvent, { type: 'transition' }>
const only = (events: AppEvent[]): Transition => {
  const [t] = events
  if (events.length !== 1 || t?.type !== 'transition') throw new Error('expected one transition')
  return t
}

describe('TransitionDetector', () => {
  it('ignores the first master and emits when the master moves', () => {
    const d = new TransitionDetector()
    expect(run(d, [deck(1, 0, { master: true }), deck(2, 0)])).toEqual([])
    const t = only(run(d, [deck(1, 5000, { master: false }), deck(2, 5000, { master: true })]))
    expect([t.fromDeck, t.toDeck]).toEqual([1, 2])
    expect(t.origin).toBe('DERIVED')
    const master = t.signals?.find((s) => s.name === 'masterChange')
    expect(master).toMatchObject({ available: true, contributed: true })
  })

  it('reports signals without data as unavailable and leaves them out of the confidence', () => {
    const d = new TransitionDetector()
    run(d, [deck(1, 0, { master: true }), deck(2, 0)])
    const t = only(run(d, [deck(2, 6000, { master: true })]))
    const byName = Object.fromEntries((t.signals ?? []).map((s) => [s.name, s]))
    expect(byName.fader).toMatchObject({ available: false, contributed: false })
    expect(byName.audio).toMatchObject({ available: false, contributed: false })
    // master .30 + overlap .20 + onAir (no change) 0 + bpmSync (equal BPM) .10 over deck signals .75
    expect(t.confidence).toBe(0.8)
  })

  it('detects a hand-off after an overlap even when the master flag never moves', () => {
    const d = new TransitionDetector()
    run(d, [deck(1, 0, { master: true }), deck(2, 1000)])
    const t = only(run(d, [deck(1, 9000, { playing: false, master: true })]))
    expect([t.fromDeck, t.toDeck]).toEqual([1, 2])
    expect(t.signals?.find((s) => s.name === 'overlap')?.detail).toBe('8.0 s both audible')
  })

  it('does not report a hand-off without enough overlap', () => {
    const d = new TransitionDetector()
    run(d, [deck(1, 0, { master: true }), deck(2, 5000)])
    expect(run(d, [deck(1, 6000, { playing: false })])).toEqual([])
  })

  it('counts fader movement only when mixer values are known', () => {
    const d = new TransitionDetector()
    run(d, [
      mixerAt(0, { 1: 1, 2: 0 }),
      deck(1, 0, { master: true }),
      deck(2, 0),
      mixerAt(4000, { 1: 0.5, 2: 0.6 }),
      mixerAt(8000, { 1: 0.1, 2: 1 })
    ])
    const t = only(run(d, [deck(2, 9000, { master: true })]))
    expect(t.signals?.find((s) => s.name === 'fader')).toMatchObject({
      available: true,
      contributed: true
    })
  })

  it('does not let two mixer sources interleave; USB-C wins when both exist', () => {
    const d = new TransitionDetector()
    const primary = (ts: number, v1: number, v2: number): AppEvent => {
      const e = mixerAt(ts, { 1: v1, 2: v2 })
      if (e.type === 'mixer') delete e.mixer.source
      return e
    }
    run(d, [deck(1, 0, { master: true }), deck(2, 0), primary(0, 1, 0), primary(8000, 0, 1)])
    run(d, [mixerAt(1000, { 1: 0.5, 2: 0.5 }), mixerAt(9000, { 1: 0.5, 2: 0.5 })])
    const t = only(run(d, [deck(2, 9500, { master: true })]))
    expect(t.signals?.find((s) => s.name === 'fader')).toMatchObject({
      available: true,
      contributed: false
    })
  })

  it('uses a crossfader sweep and an audio drop as evidence', () => {
    const d = new TransitionDetector()
    run(d, [mixerAt(0, {}, 0), deck(1, 0, { master: true }), deck(2, 0)])
    run(d, [mixerAt(5000, {}, 1)])
    run(d, [{ type: 'drop', ts: 6000, phase: 'drop', origin: 'DERIVED' }])
    run(d, [
      { type: 'energy', ts: 9500, rms: 0.4, bands: { low: 1, mid: 1, high: 1 }, origin: 'DERIVED' }
    ])
    const t = only(run(d, [deck(2, 10_000, { master: true })]))
    const names = (t.signals ?? []).filter((s) => s.contributed).map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(['fader', 'audio', 'masterChange']))
  })

  it('does not repeat the same hand-off within the cool-down', () => {
    const d = new TransitionDetector()
    run(d, [deck(1, 0, { master: true }), deck(2, 0)])
    only(run(d, [deck(2, 5000, { master: true })]))
    expect(run(d, [deck(1, 9000, { playing: false })])).toEqual([])
  })

  it('forgets everything on reset', () => {
    const d = new TransitionDetector()
    run(d, [deck(1, 0, { master: true })])
    d.reset()
    expect(run(d, [deck(2, 100, { master: true })])).toEqual([])
  })
})

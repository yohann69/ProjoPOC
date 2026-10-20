import { describe, expect, it } from 'vitest'
import type { Scenario } from '@shared/simulator'
import type { DeckId } from '@shared/types'
import { SimulatorEngine } from './engine'
import type { SimRawEvent } from './rawTypes'

const START = 1_700_000_000_000

function run(scenario: Scenario, seed: number, durationMs: number, stepMs: number): SimRawEvent[] {
  const engine = new SimulatorEngine({ seed, scenario }, START)
  const events: SimRawEvent[] = []
  for (let t = START; t <= START + durationMs; t += stepMs) events.push(...engine.advance(t))
  return events
}

const beatsOf = (events: SimRawEvent[], deck: DeckId) =>
  events.flatMap((e) => (e.kind === 'beat' && e.deck === deck ? [e] : []))

describe('simulator beat timing', () => {
  const events = run('single', 7, 20_000, 7)
  const beats = beatsOf(events, 1)
  const decks = events.flatMap((e) => (e.kind === 'deck' && e.deck === 1 ? [e] : []))

  it('fires beats spaced by the effective BPM period', () => {
    expect(beats.length).toBeGreaterThan(30)
    beats.slice(1).forEach((beat, i) => {
      const prev = beats[i]
      if (!prev) throw new Error('missing beat')
      const nearest = decks.reduce((a, b) =>
        Math.abs(b.ts - beat.ts) < Math.abs(a.ts - beat.ts) ? b : a
      )
      const expected = 60000 / (nearest.bpm ?? 0)
      expect(Math.abs(beat.ts - prev.ts - expected)).toBeLessThan(0.5)
    })
  })

  it('cycles beat-in-bar 1..4 without gaps', () => {
    beats.slice(1).forEach((beat, i) => {
      const prev = beats[i]
      expect(beat.beatInBar).toBe((((prev?.beatInBar ?? 0) % 4) + 1) as 1 | 2 | 3 | 4)
    })
  })

  it('stamps beats with scheduled time, independent of how often advance() is called', () => {
    const fine = beatsOf(run('single', 7, 20_000, 1), 1)
    const coarse = beatsOf(run('single', 7, 20_000, 33), 1)
    const count = Math.min(fine.length, coarse.length)
    expect(count).toBeGreaterThan(30)
    for (let i = 0; i < count; i++) {
      expect(Math.abs((fine[i]?.ts ?? 0) - (coarse[i]?.ts ?? 1e9))).toBeLessThan(0.5)
    }
  })

  it('never emits beats before the clock reaches them', () => {
    const engine = new SimulatorEngine({ seed: 7, scenario: 'single' }, START)
    for (let t = START; t <= START + 5000; t += 20) {
      for (const e of engine.advance(t)) expect(e.ts).toBeLessThanOrEqual(t)
    }
  })
})

describe('simulator behaviour', () => {
  it('is deterministic for a given seed', () => {
    const strip = (events: SimRawEvent[]) =>
      JSON.stringify(events.filter((e) => e.kind !== 'track'))
    expect(strip(run('mixing2', 3, 30_000, 10))).toBe(strip(run('mixing2', 3, 30_000, 10)))
  })

  it('emits deck state at ~10 Hz and mixer at ~4 Hz', () => {
    const events = run('chaos4', 5, 10_000, 10)
    for (const deck of [1, 2, 3, 4]) {
      const count = events.filter((e) => e.kind === 'deck' && e.deck === deck).length
      expect(Math.abs(count - 100)).toBeLessThanOrEqual(2)
    }
    expect(Math.abs(events.filter((e) => e.kind === 'mixer').length - 40)).toBeLessThanOrEqual(2)
  })

  it('uses the deck count of the scenario', () => {
    const decks = (s: Scenario) => {
      const devices = run(s, 1, 0, 10).find((e) => e.kind === 'devices')
      return devices?.kind === 'devices' ? devices.decks.length : 0
    }
    expect([decks('single'), decks('mixing2'), decks('chaos4')]).toEqual([1, 2, 4])
  })

  it('hands the master flag and on-air state from one deck to the other', () => {
    const events = run('mixing2', 11, 150_000, 10)
    const masters = events.flatMap((e) => (e.kind === 'deck' && e.isMaster ? [e.deck] : []))
    const changes = masters.filter((deck, i) => i > 0 && deck !== masters[i - 1])
    expect(changes.length).toBeGreaterThanOrEqual(1)
    const both = events.some(
      (e, i) =>
        e.kind === 'deck' &&
        e.isOnAir &&
        events.slice(i, i + 3).some((o) => o.kind === 'deck' && o.deck !== e.deck && o.isOnAir)
    )
    expect(both).toBe(true)
  })

  it('keeps BPM within 120-150 for loaded tracks and pitch drift slow', () => {
    const events = run('mixing2', 2, 25_000, 10)
    for (const e of events) {
      if (e.kind === 'track' && e.track) {
        expect(e.track.bpmGrid.bpm).toBeGreaterThanOrEqual(120)
        expect(e.track.bpmGrid.bpm).toBeLessThanOrEqual(150)
      }
    }
    const pitches = events.flatMap((e) =>
      e.kind === 'deck' && e.deck === 1 && e.pitchPercent !== null ? [e.pitchPercent] : []
    )
    expect(Math.max(...pitches) - Math.min(...pitches)).toBeLessThan(1)
  })
})

import { describe, expect, it } from 'vitest'
import { PositionTracker } from './position'

const grid = (beat: number): number | null =>
  beat >= 1 && beat <= 100 ? 1000 + (beat - 1) * 500 : null

describe('PositionTracker', () => {
  it('uses the grid time of the beat while paused', () => {
    const p = new PositionTracker()
    expect(p.positionMs(1, 3, 10_000, false, 0, grid)).toBe(2000)
    expect(p.positionMs(1, 3, 12_000, false, 0, grid)).toBe(2000)
  })

  it('runs on from the beat while playing, at the pitch rate, and re-anchors on the next beat', () => {
    const p = new PositionTracker()
    expect(p.positionMs(1, 3, 10_000, true, 10, grid)).toBe(2000)
    expect(p.positionMs(1, 3, 10_200, true, 10, grid)).toBeCloseTo(2220, 5)
    expect(p.positionMs(1, 4, 10_480, true, 10, grid)).toBe(2500)
  })

  it('never runs past the next beat if the counter stalls', () => {
    const p = new PositionTracker()
    p.positionMs(1, 3, 10_000, true, 0, grid)
    expect(p.positionMs(1, 3, 20_000, true, 0, grid)).toBe(2500)
  })

  it('does not count paused time when playback resumes on the same beat', () => {
    const p = new PositionTracker()
    p.positionMs(1, 3, 10_000, false, 0, grid)
    expect(p.positionMs(1, 3, 15_000, true, 0, grid)).toBe(2000)
    expect(p.positionMs(1, 3, 15_100, true, 0, grid)).toBe(2100)
  })

  it('has no position without a beat counter or a beat grid, and keeps decks apart', () => {
    const p = new PositionTracker()
    expect(p.positionMs(1, null, 0, true, 0, grid)).toBeNull()
    expect(p.positionMs(1, 0, 0, true, 0, grid)).toBeNull()
    expect(p.positionMs(1, 3, 0, true, 0, null)).toBeNull()
    expect(p.positionMs(1, 500, 0, true, 0, grid)).toBeNull()
    expect(p.positionMs(2, 5, 0, false, 0, grid)).toBe(3000)
    expect(p.positionMs(1, 5, 0, false, 0, grid)).toBe(3000)
  })
})

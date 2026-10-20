import { describe, expect, it } from 'vitest'
import { bandLevels, dbToLevel, rmsOf, rmsToDb, type Bands } from './bands'
import { DropDetector, type DropEvent } from './drop'
import { OnsetDetector, SpectralFlux } from './flux'

const spectrum = (fill: number, set?: (i: number) => number | undefined): Float32Array =>
  Float32Array.from({ length: 1024 }, (_, i) => set?.(i) ?? fill)

describe('bands and rms', () => {
  it('puts energy in the band whose bins carry it', () => {
    const low = bandLevels(
      spectrum(-90, (i) => (i >= 1 && i <= 5 ? -20 : undefined)),
      48000
    )
    expect(low.low).toBeGreaterThan(0.95)
    expect(low.mid).toBeLessThan(0.01)
    expect(low.high).toBeLessThan(0.01)
    const high = bandLevels(
      spectrum(-90, (i) => (i > 100 && i < 600 ? -30 : undefined)),
      48000
    )
    expect(high.high).toBeGreaterThan(0.8)
    expect(high.low).toBe(0)
  })

  it('treats silence and -Infinity bins as level 0', () => {
    const levels = bandLevels(spectrum(-Infinity), 48000)
    expect(levels).toEqual({ low: 0, mid: 0, high: 0 })
    expect(dbToLevel(-20)).toBe(1)
    expect(dbToLevel(-200)).toBe(0)
  })

  it('computes RMS of a sine as amplitude over root two', () => {
    const sine = Float32Array.from({ length: 2048 }, (_, i) =>
      Math.sin((2 * Math.PI * 8 * i) / 2048)
    )
    expect(rmsOf(sine)).toBeCloseTo(Math.SQRT1_2, 3)
    expect(rmsOf(new Float32Array(0))).toBe(0)
    expect(rmsToDb(1)).toBe(0)
    expect(rmsToDb(0)).toBe(-Infinity)
  })
})

describe('SpectralFlux and OnsetDetector', () => {
  it('measures only growth, in dB per bin', () => {
    const flux = new SpectralFlux()
    expect(flux.step(spectrum(-60), 48000)).toBe(0)
    expect(flux.step(spectrum(-60), 48000)).toBe(0)
    expect(flux.step(spectrum(-40), 48000)).toBeCloseTo(20, 0)
    expect(flux.step(spectrum(-60), 48000)).toBe(0)
  })

  const run = (detector: OnsetDetector, pulses: number[], rms = 0.1) => {
    const found: { ts: number; strength: number }[] = []
    for (let i = 0; i < 80; i++) {
      const ts = i * 25
      const hit = detector.step(pulses.includes(i) ? 5 : 0.2, ts, rms)
      if (hit) found.push(hit)
    }
    return found
  }

  it('finds an isolated peak and reports its own time', () => {
    const found = run(new OnsetDetector(), [30])
    expect(found).toHaveLength(1)
    expect(found[0]?.ts).toBe(750)
    expect(found[0]?.strength).toBeGreaterThan(0.5)
  })

  it('keeps a minimum gap, stays quiet in steady flux and under the silence gate', () => {
    expect(run(new OnsetDetector(), [30, 32])).toHaveLength(1)
    expect(run(new OnsetDetector(), [30, 36])).toHaveLength(2)
    expect(run(new OnsetDetector(), [])).toHaveLength(0)
    expect(run(new OnsetDetector(), [30], 0)).toHaveLength(0)
  })
})

describe('DropDetector', () => {
  const STEP = 25
  const steady: Bands = { low: 0.8, mid: 0.4, high: 0.3 }

  function feed(
    det: DropDetector,
    from: number,
    ms: number,
    at: (t: number) => Bands
  ): DropEvent[] {
    const out: DropEvent[] = []
    for (let t = 0; t <= ms; t += STEP) {
      const event = det.step(from + t, at(t))
      if (event) out.push(event)
    }
    return out
  }

  const breakdown = (t: number, ms: number): Bands => {
    const rise = Math.min(1, t / ms)
    return { low: 0.05, mid: 0.3 + 0.5 * rise, high: 0.3 + 0.4 * rise }
  }

  it('reports a buildup and then the drop when the bass returns', () => {
    const det = new DropDetector()
    expect(feed(det, 0, 10_000, () => steady)).toEqual([])
    const events = feed(det, 10_000, 6000, (t) => breakdown(t, 6000))
    expect(events).toEqual(['buildup'])
    expect(det.inBuildup).toBe(true)
    expect(feed(det, 16_000, 1500, () => steady)).toEqual(['drop'])
    expect(det.inBuildup).toBe(false)
  })

  it('needs rising upper bands and a long enough breakdown', () => {
    const flat = new DropDetector()
    feed(flat, 0, 10_000, () => steady)
    expect(feed(flat, 10_000, 6000, () => ({ low: 0.05, mid: 0.4, high: 0.3 }))).toEqual([])

    const brief = new DropDetector()
    feed(brief, 0, 10_000, () => steady)
    expect(feed(brief, 10_000, 1000, (t) => breakdown(t, 1000))).toEqual([])
  })

  it('does nothing for steady music or silence', () => {
    const det = new DropDetector()
    expect(feed(det, 0, 30_000, () => steady)).toEqual([])
    expect(feed(new DropDetector(), 0, 30_000, () => ({ low: 0, mid: 0, high: 0 }))).toEqual([])
  })

  it('waits out a cool-down after a drop and gives up on a buildup that never lands', () => {
    const det = new DropDetector()
    feed(det, 0, 10_000, () => steady)
    feed(det, 10_000, 6000, (t) => breakdown(t, 6000))
    feed(det, 16_000, 1500, () => steady)
    feed(det, 17_500, 1500, () => steady)
    expect(feed(det, 19_000, 4000, (t) => breakdown(t, 4000))).toEqual([])

    const lost = new DropDetector()
    feed(lost, 0, 10_000, () => steady)
    feed(lost, 10_000, 40_000, (t) => breakdown(t, 6000))
    expect(lost.inBuildup).toBe(false)
  })
})

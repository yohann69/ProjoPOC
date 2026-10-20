import { describe, expect, it } from 'vitest'
import { keyDisplay } from './camelot'
import { formatAge, formatBpm, formatMs, formatPacketRate, formatPitch } from './format'
import { PhaseSmoother } from './phaseSmoother'
import { phraseEnergy, phraseIndexAt, phraseProgress } from './phrases'

describe('formatters', () => {
  it('formats BPM with 1 or 2 decimals and signed pitch', () => {
    expect(formatBpm(127.456)).toBe('127.46')
    expect(formatBpm(127.456, 1)).toBe('127.5')
    expect(formatPitch(2)).toBe('+2.00%')
    expect(formatPitch(-3.456)).toBe('\u22123.46%')
  })

  it('formats milliseconds as mm:ss.t', () => {
    expect(formatMs(0)).toBe('00:00.0')
    expect(formatMs(61_234)).toBe('01:01.2')
    expect(formatMs(3_599_999)).toBe('59:59.9')
    expect(formatMs(-72_050)).toBe('-01:12.0')
  })

  it('formats ages and packet rates', () => {
    expect(formatAge(38)).toBe('38 ms')
    expect(formatAge(1234)).toBe('1.2 s')
    expect(formatAge(180_000)).toBe('3 min')
    expect(formatPacketRate(33.333)).toBe('33.3/s')
    expect(formatPacketRate(420)).toBe('420/s')
  })
})

describe('keyDisplay', () => {
  it('keeps Camelot codes and converts musical names', () => {
    expect(keyDisplay('8a')).toEqual({ name: '8a', camelot: '8A' })
    expect(keyDisplay('12B').camelot).toBe('12B')
    expect(keyDisplay('Am').camelot).toBe('8A')
    expect(keyDisplay('C').camelot).toBe('8B')
    expect(keyDisplay('F#m').camelot).toBe('11A')
    expect(keyDisplay('Bb').camelot).toBe('6B')
    expect(keyDisplay('Ebm').camelot).toBe('2A')
    expect(keyDisplay('G#m').camelot).toBe('1A')
    expect(keyDisplay('Dminor').camelot).toBe('7A')
  })

  it('returns null for keys it cannot read instead of guessing', () => {
    expect(keyDisplay('???')).toEqual({ name: '???', camelot: null })
    expect(keyDisplay('')).toEqual({ name: '', camelot: null })
  })
})

describe('phrases', () => {
  const phrases = [
    { startMs: 0, endMs: 1000, kind: 'intro' as const },
    { startMs: 1000, endMs: 3000, kind: 'drop' as const }
  ]

  it('finds the current phrase and the time to the next change', () => {
    expect(phraseIndexAt(phrases, 1500)).toBe(1)
    expect(phraseIndexAt(phrases, 5000)).toBe(-1)
    expect(phraseProgress(phrases, 400)).toMatchObject({ msToChange: 600, next: { kind: 'drop' } })
    expect(phraseProgress(phrases, 2500)).toMatchObject({ msToChange: 500, next: null })
    expect(phraseProgress(phrases, 9000)).toBeNull()
    expect(phraseEnergy('drop')).toBeGreaterThan(phraseEnergy('intro'))
  })
})

describe('PhaseSmoother', () => {
  const PERIOD = 500
  const signed = (x: number): number => x - Math.round(x)

  it('interpolates between beats and goes null when beats stop', () => {
    const s = new PhaseSmoother()
    expect(s.phase(0)).toBeNull()
    s.onBeat(1000, PERIOD, 1000)
    expect(s.phase(1000)).toBeCloseTo(0, 5)
    expect(s.phase(1250)).toBeCloseTo(0.5, 5)
    expect(s.phase(1000 + PERIOD * 3)).toBeNull()
  })

  it('never jumps when beats arrive early or late (jittered 120 BPM, 60 fps)', () => {
    const s = new PhaseSmoother()
    let previous: number | null = null
    let worst = 0
    let nextBeat = 0
    let beatIndex = 0
    for (let now = 0; now < 20_000; now += 1000 / 60) {
      while (nextBeat <= now) {
        const jitter = ((beatIndex * 37) % 31) - 15
        s.onBeat(nextBeat + jitter, PERIOD, now)
        beatIndex++
        nextBeat = beatIndex * PERIOD
      }
      const phase = s.phase(now)
      if (phase !== null && previous !== null) {
        const step = signed(phase - previous)
        worst = Math.max(worst, Math.abs(step - 1000 / 60 / PERIOD))
      }
      previous = phase
    }
    expect(worst).toBeLessThan(0.04)
  })

  it('absorbs a large tempo error gradually instead of snapping', () => {
    const s = new PhaseSmoother()
    s.onBeat(0, PERIOD, 0)
    s.onBeat(400, PERIOD, 480)
    const atBeat = s.phase(480) ?? 0
    expect(atBeat).toBeGreaterThan(0.1)
    const later = s.phase(480 + 600) ?? 0
    expect(signed(later - (80 + 600) / PERIOD)).toBeCloseTo(0, 1)
  })
})

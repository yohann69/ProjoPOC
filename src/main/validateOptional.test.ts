import { describe, expect, it } from 'vitest'
import {
  parseIngest,
  parseMidiLog,
  parseMidiMapping,
  parseOptionalSettings
} from './validateOptional'

describe('parseIngest', () => {
  it('accepts every event kind and clamps levels to 0..1', () => {
    const events = parseIngest([
      { kind: 'mixerValue', target: 'ch3.eqHigh', value: 1.5, ts: 1 },
      { kind: 'energy', ts: 2, rms: 0.2, bands: { low: 0.1, mid: -1, high: 0.3 } },
      { kind: 'onset', ts: 3, strength: 0.5 },
      { kind: 'drop', ts: 4, phase: 'buildup' }
    ])
    expect(events[0]).toMatchObject({ value: 1 })
    expect(events[1]).toMatchObject({ bands: { low: 0.1, mid: 0, high: 0.3 } })
  })

  it('rejects unknown targets, kinds, NaN and oversized batches', () => {
    expect(() =>
      parseIngest([{ kind: 'mixerValue', target: 'ch9.fader', value: 0, ts: 1 }])
    ).toThrow()
    expect(() => parseIngest([{ kind: 'nope', ts: 1 }])).toThrow()
    expect(() => parseIngest([{ kind: 'onset', ts: Number.NaN, strength: 1 }])).toThrow()
    expect(() => parseIngest(new Array(201).fill({ kind: 'onset', ts: 1, strength: 1 }))).toThrow()
    expect(() => parseIngest('x')).toThrow()
  })
})

describe('parseMidiMapping', () => {
  const entry = { key: 'cc:0:7', label: 'channel 1 fader', target: 'ch1.fader', invert: false }

  it('accepts labelled-only and mapped entries', () => {
    const mapping = parseMidiMapping({
      version: 1,
      entries: [entry, { ...entry, key: 'note:1:36', target: null }]
    })
    expect(mapping.entries).toHaveLength(2)
  })

  it('rejects bad versions, keys, targets and labels', () => {
    expect(() => parseMidiMapping({ version: 2, entries: [] })).toThrow()
    expect(() => parseMidiMapping({ version: 1, entries: [{ ...entry, key: '../x' }] })).toThrow()
    expect(() =>
      parseMidiMapping({ version: 1, entries: [{ ...entry, target: 'master' }] })
    ).toThrow()
    expect(() =>
      parseMidiMapping({ version: 1, entries: [{ ...entry, label: 'x'.repeat(81) }] })
    ).toThrow()
  })
})

describe('parseMidiLog and parseOptionalSettings', () => {
  it('validates bytes', () => {
    const ok = { ts: 1, port: 'XDJ', bytes: [144, 60, 127], guess: 'note on' }
    expect(parseMidiLog([ok])).toEqual([ok])
    expect(() => parseMidiLog([{ ...ok, bytes: [256] }])).toThrow()
    expect(() => parseMidiLog([{ ...ok, bytes: [1.5] }])).toThrow()
  })

  it('falls back to defaults for old settings files', () => {
    expect(parseOptionalSettings(undefined)).toEqual({ midiInputName: null, audioDeviceId: null })
    expect(parseOptionalSettings({ midiInputName: 'A', audioDeviceId: null }).midiInputName).toBe(
      'A'
    )
    expect(() => parseOptionalSettings({ midiInputName: 5 })).toThrow()
  })
})

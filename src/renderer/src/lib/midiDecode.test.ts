import { describe, expect, it } from 'vitest'
import { decodeMidi, noteName, normalizeMidi, parseControlKey } from './midiDecode'

describe('decodeMidi', () => {
  it('reads control change with 1-based channels', () => {
    const m = decodeMidi([0xb0, 7, 100])
    expect(m).toMatchObject({ kind: 'cc', channel: 1, control: 'cc:1:7', raw: 100 })
    expect(decodeMidi([0xbf, 7, 0]).control).toBe('cc:16:7')
  })

  it('reads notes, treating velocity 0 as off, and shares the control key', () => {
    const on = decodeMidi([0x91, 60, 90])
    const off = decodeMidi([0x91, 60, 0])
    const offExplicit = decodeMidi([0x81, 60, 64])
    expect([on.kind, off.kind, offExplicit.kind]).toEqual(['noteOn', 'noteOff', 'noteOff'])
    expect(new Set([on.control, off.control, offExplicit.control]).size).toBe(1)
    expect(on.guess).toContain('C4')
    expect(off.raw).toBe(0)
  })

  it('combines pitch bend into 14 bits', () => {
    const m = decodeMidi([0xe2, 0x7f, 0x7f])
    expect(m).toMatchObject({ kind: 'pitchBend', channel: 3, raw: 16383, max: 16383 })
    expect(normalizeMidi(m)).toBe(1)
    expect(decodeMidi([0xe0, 0, 0x40]).raw).toBe(8192)
  })

  it('reads aftertouch and program change', () => {
    expect(decodeMidi([0xa0, 61, 10])).toMatchObject({ kind: 'polyAftertouch', raw: 10 })
    expect(decodeMidi([0xd5, 33])).toMatchObject({ kind: 'channelAftertouch', channel: 6, raw: 33 })
    expect(decodeMidi([0xc0, 5])).toMatchObject({ kind: 'programChange', control: 'program:1:5' })
  })

  it('reads system messages without a control identity', () => {
    for (const [byte, kind] of [
      [0xf8, 'clock'],
      [0xfa, 'start'],
      [0xfb, 'continue'],
      [0xfc, 'stop'],
      [0xfe, 'activeSensing'],
      [0xff, 'reset']
    ] as const) {
      expect(decodeMidi([byte])).toMatchObject({ kind, control: null })
    }
    expect(decodeMidi([0xf2, 1, 1]).guess).toContain('129')
  })

  it('summarizes SysEx and flags malformed bytes instead of throwing', () => {
    const sysex = decodeMidi([0xf0, 0x7e, 0x7f, 6, 1, 0xf7])
    expect(sysex).toMatchObject({ kind: 'sysex', control: null })
    expect(sysex.guess).toContain('6 bytes')
    expect(decodeMidi([0x40, 1]).kind).toBe('unknown')
    expect(decodeMidi([]).kind).toBe('unknown')
    expect(decodeMidi([0xf4]).kind).toBe('unknown')
  })

  it('names notes with 60 as C4 and parses control keys', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(21)).toBe('A0')
    expect(parseControlKey('cc:2:11')).toEqual({ group: 'cc', channel: 2, number: 11 })
    expect(parseControlKey('bad')).toBeNull()
  })
})

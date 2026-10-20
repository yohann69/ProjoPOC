import { describe, expect, it } from 'vitest'
import { describeFields, flatten, toField } from './fields'

describe('fields', () => {
  it('spells out the codes the library names and keeps unknown ones visible', () => {
    expect(describeFields({ playState: 3, trackSlot: 3, trackType: 1, type: 1 })).toEqual({
      playState: '3 (playing)',
      trackSlot: '3 (USB)',
      trackType: '1 (rekordbox)',
      type: '1 (CDJ)'
    })
    expect(describeFields({ playState: 99 }).playState).toBe('99 (unknown)')
  })

  it('passes plain values through and never throws on odd ones', () => {
    expect(
      describeFields({ isSync: true, trackBPM: null, beat: 406, packetNum: 12, gone: undefined })
    ).toEqual({ isSync: true, trackBPM: null, beat: 406, packetNum: 12, gone: null })
    const loop: Record<string, unknown> = {}
    loop.self = loop
    expect(typeof toField(loop)).toBe('string')
    expect(toField(10n)).toBe('10')
    expect(toField(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z')
    expect(toField(Number.NaN)).toBe('NaN')
  })

  it('flattens nested rows with dotted keys and summarises lists and binary data', () => {
    expect(
      flatten({
        title: 'Hotline Bling',
        artist: { id: 3, name: 'Drake' },
        cues: [{}, {}, {}],
        tags: ['a', 'b'],
        waveform: new Uint8Array(400),
        fn: () => 1,
        empty: null
      })
    ).toEqual({
      title: 'Hotline Bling',
      'artist.id': 3,
      'artist.name': 'Drake',
      cues: '3 items',
      tags: 'a, b',
      waveform: '400 bytes',
      empty: null
    })
  })
})

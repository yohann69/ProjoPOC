import type { Track } from 'alphatheta-connect'
import { describe, expect, it } from 'vitest'
import { buildTrackInfo } from './trackMapper'

const track = {
  id: 7,
  title: 'Night Drive',
  duration: 300,
  tempo: 126,
  cueAndLoops: [{ type: 'hot_cue', offset: 1000, button: 1 }],
  artist: { id: 1, name: 'Nova' },
  album: { id: 1, name: 'EP' },
  key: { id: 1, name: '8A' },
  genre: { id: 1, name: 'House' }
} as unknown as Track

const grid = [
  { offset: 120, count: 1 as const, bpm: 128 },
  { offset: 589, count: 2 as const, bpm: 128 },
  { offset: 1057, count: 3 as const, bpm: 128 },
  { offset: 1526, count: 4 as const, bpm: 128 },
  { offset: 1995, count: 1 as const, bpm: 128 }
]

const dat = {
  beatGrid: grid,
  cueAndLoops: null,
  waveformPreview: { data: Uint8Array.from([0, 25, 0xff]) },
  waveformTiny: null
}

const ext = {
  waveformHd: null,
  waveformDetail: null,
  waveformColorPreview: null,
  extendedCues: [
    { hotCue: 1, type: 1 as const, time: 120, colorRgb: { r: 255, g: 0, b: 92 }, comment: 'Drop' },
    { hotCue: 0, type: 1 as const, time: 5000 },
    { hotCue: 2, type: 2 as const, time: 8000, loopTime: 9000 }
  ],
  songStructure: {
    mood: 'high' as const,
    bank: 'default' as const,
    endBeat: 5,
    phrases: [
      { index: 1, beat: 1, kind: 1, phraseType: 'Intro' },
      { index: 2, beat: 3, kind: 2, phraseType: 'Chorus' }
    ]
  }
}

const ex2 = {
  waveform3BandPreview: { numEntries: 2, data: Uint8Array.from([1, 2, 3, 4, 5, 6]) },
  waveform3BandDetail: null,
  vocalConfig: null
}

describe('buildTrackInfo', () => {
  it('combines the library row with all analysis files', () => {
    const { info, missing } = buildTrackInfo('1:3:7', track, { dat, ext, ex2 })
    expect(missing).toEqual([])
    expect(info).toMatchObject({
      id: '1:3:7',
      title: 'Night Drive',
      artist: 'Nova',
      album: 'EP',
      key: '8A',
      genre: 'House',
      durationMs: 300000,
      bpmGrid: { bpm: 128, firstBeatMs: 120 }
    })
    expect(info.cues).toEqual([
      { type: 'hot', positionMs: 120, color: '#ff005c', label: 'Drop' },
      { type: 'memory', positionMs: 5000, color: undefined, label: undefined },
      { type: 'hot', positionMs: 8000, color: undefined, label: 'B' }
    ])
    expect(info.loops).toEqual([{ startMs: 8000, endMs: 9000, label: 'B' }])
  })

  it('maps phrases through the beat grid and scales the preview waveform', () => {
    const { info } = buildTrackInfo('k', track, { dat, ext, ex2 })
    expect(info.phrases).toEqual([
      { kind: 'intro', startMs: 120, endMs: 1057 },
      { kind: 'chorus', startMs: 1057, endMs: 1995 }
    ])
    expect([...(info.waveform?.heights ?? [])]).toEqual([0, 255, 255])
    expect([...(info.waveform?.bands?.low ?? [])]).toEqual([1, 4])
    expect([...(info.waveform?.bands?.high ?? [])]).toEqual([3, 6])
  })

  it('falls back to library cues and reports what is missing when analysis is unreadable', () => {
    const { info, missing } = buildTrackInfo('k', track, { dat: null, ext: null, ex2: null })
    expect(missing).toEqual(['beatGrid', 'waveform', 'phrases'])
    expect(info.bpmGrid).toEqual({ bpm: 126, firstBeatMs: 0 })
    expect(info.cues).toEqual([{ type: 'hot', positionMs: 1000, label: 'A' }])
    expect(info.waveform).toBeUndefined()
  })
})

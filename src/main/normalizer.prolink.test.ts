import { describe, expect, it } from 'vitest'
import type { AppEvent } from '@shared/types'
import { Normalizer } from './normalizer'
import type { ProlinkDeckStatus, ProlinkRawEvent } from './sources/prolink/rawTypes'

const status = (over: Partial<ProlinkDeckStatus> = {}): ProlinkDeckStatus => ({
  deviceId: 1,
  trackId: 7,
  trackDeviceId: 1,
  trackSlot: 3,
  trackType: 1,
  playState: 3,
  isOnAir: true,
  isSync: false,
  isMaster: true,
  trackBpm: 120,
  effectivePitch: 5,
  beatInMeasure: 2,
  beat: 17,
  ...over
})

const deck = (over: Partial<ProlinkDeckStatus> = {}, d: 1 | 2 = 1, ts = 1000): ProlinkRawEvent => ({
  kind: 'deck',
  ts,
  deck: d,
  status: status(over)
})

describe('Normalizer.fromProlink', () => {
  it('tags live status ETH_LIVE and computes the effective BPM', () => {
    const [event] = new Normalizer().fromProlink(deck())
    if (event?.type !== 'deckState') throw new Error('expected deckState')
    expect(event.state.bpm).toEqual({ value: 126, origin: 'ETH_LIVE', ts: 1000 })
    expect(event.state.pitchPercent?.value).toBe(5)
    expect(event.state.beatInBar?.value).toBe(2)
    expect(event.state.trackId?.value).toBe('1:3:7')
  })

  it('leaves unknown values out instead of inventing them', () => {
    const [event] = new Normalizer().fromProlink(
      deck({ trackId: 0, trackBpm: null, playState: 0, beatInMeasure: 0 })
    )
    if (event?.type !== 'deckState') throw new Error('expected deckState')
    expect(event.state.playState.value).toBe('empty')
    expect(event.state.trackId?.value).toBeNull()
    expect(event.state.bpm).toBeUndefined()
    expect(event.state.pitchPercent).toBeUndefined()
    expect(event.state.beatInBar).toBeUndefined()
  })

  it('ignores the -100% pitch an idle deck reports instead of showing a zero tempo', () => {
    const [event] = new Normalizer().fromProlink(deck({ effectivePitch: -100 }))
    if (event?.type !== 'deckState') throw new Error('expected deckState')
    expect(event.state.pitchPercent).toBeUndefined()
    expect(event.state.bpm).toBeUndefined()
  })

  it('maps play-state codes, treating unknown codes as paused', () => {
    const state = (playState: number) => {
      const [event] = new Normalizer().fromProlink(deck({ playState }))
      return event?.type === 'deckState' ? event.state.playState.value : null
    }
    expect([3, 4, 5, 6, 7, 14, 99].map(state)).toEqual([
      'playing',
      'playing',
      'paused',
      'cued',
      'cued',
      'paused',
      'paused'
    ])
  })

  it('derives beat phase from the last beat and leaves transitions to the detector', () => {
    const n = new Normalizer()
    n.fromProlink({ kind: 'beat', ts: 1000, deck: 1, beatInBar: 1, trackBpm: 120, pitchPercent: 5 })
    const [state] = n.fromProlink(deck({}, 1, 1119))
    if (state?.type !== 'deckState') throw new Error('expected deckState')
    expect(state.state.beatPhase?.origin).toBe('DERIVED')
    expect(state.state.beatPhase?.value).toBeCloseTo(0.25, 2)

    const moved = n.fromProlink(deck({ isMaster: true, deviceId: 2 }, 2, 2000))
    expect(moved.map((e) => e.type)).toEqual(['deckState'])
  })

  it('tags library metadata ETH_LIBRARY and passes inspector and log events through', () => {
    const n = new Normalizer()
    const [track] = n.fromProlink({
      kind: 'track',
      ts: 5,
      deck: 1,
      track: {
        id: 'x',
        title: 't',
        artist: 'a',
        album: '',
        key: '',
        genre: '',
        durationMs: 1,
        bpmGrid: { bpm: 1, firstBeatMs: 0 },
        cues: [],
        loops: [],
        phrases: []
      }
    })
    expect(track).toMatchObject({ type: 'track', track: { origin: 'ETH_LIBRARY', ts: 5 } })
    expect(n.fromProlink({ kind: 'log', ts: 1, level: 'warn', message: 'm' })).toEqual([
      { type: 'sourceLog', source: 'prolink', level: 'warn', message: 'm', ts: 1 }
    ])
    const stats: AppEvent = { type: 'packetStats', source: 'prolink', ports: [] }
    expect(n.fromProlink({ kind: 'inspector', event: stats })).toEqual([stats])
  })

  it('maps source status states and device kinds', () => {
    const n = new Normalizer()
    expect(
      n.fromProlink({ kind: 'status', ts: 1, state: 'rekordboxConflict', message: 'busy' })
    ).toEqual([
      { type: 'sourceStatus', source: 'prolink', state: 'rekordboxConflict', message: 'busy' }
    ])
    const [list] = n.fromProlink({
      kind: 'devices',
      ts: 1,
      devices: [{ id: 17, name: 'rekordbox', ip: '10.0.0.2', kind: 'rekordbox' }]
    })
    expect(list).toMatchObject({
      type: 'deviceList',
      devices: [{ kind: 'other', deviceNumber: 17 }]
    })
  })
})

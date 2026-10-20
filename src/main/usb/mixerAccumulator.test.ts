import { describe, expect, it } from 'vitest'
import { MixerAccumulator } from './mixerAccumulator'

describe('MixerAccumulator', () => {
  it('folds single values into a USBC-tagged snapshot that keeps earlier values', () => {
    const acc = new MixerAccumulator()
    acc.apply({ kind: 'mixerValue', target: 'ch2.fader', value: 0.5, ts: 10 })
    acc.apply({ kind: 'mixerValue', target: 'crossfader', value: 1, ts: 11 })
    const mixer = acc.apply({ kind: 'mixerValue', target: 'ch2.eqLow', value: 0.25, ts: 12 })
    expect(mixer.source).toBe('usbc')
    expect(mixer.crossfader).toEqual({ value: 1, origin: 'USBC', ts: 11 })
    expect(mixer.channels[2]).toEqual({
      fader: { value: 0.5, origin: 'USBC', ts: 10 },
      eqLow: { value: 0.25, origin: 'USBC', ts: 12 }
    })
    expect(mixer.channels[1]).toBeUndefined()
  })

  it('returns snapshots that later values do not change', () => {
    const acc = new MixerAccumulator()
    const first = acc.apply({ kind: 'mixerValue', target: 'ch1.fader', value: 0.1, ts: 1 })
    acc.apply({ kind: 'mixerValue', target: 'ch1.fader', value: 0.9, ts: 2 })
    expect(first.channels[1]?.fader?.value).toBe(0.1)
  })

  it('has no values after reset', () => {
    const acc = new MixerAccumulator()
    acc.apply({ kind: 'mixerValue', target: 'crossfader', value: 1, ts: 1 })
    acc.reset()
    const mixer = acc.apply({ kind: 'mixerValue', target: 'ch4.eqMid', value: 0, ts: 2 })
    expect(mixer.crossfader).toBeUndefined()
  })
})

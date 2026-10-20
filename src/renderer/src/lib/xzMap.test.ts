import { describe, expect, it } from 'vitest'
import { assignLabel, profileFor, XZ_CONTROLS, xzControlOf } from './xzMap'

describe('XDJ-XZ control map', () => {
  it('has one control per CC, with ids that are unique', () => {
    const ccs = XZ_CONTROLS.map((c) => c.cc)
    expect(new Set(ccs).size).toBe(ccs.length)
    expect(new Set(XZ_CONTROLS.map((c) => c.id)).size).toBe(XZ_CONTROLS.length)
  })

  it('recognises the messages seen on the unit', () => {
    expect(xzControlOf('cc:5:9')).toMatchObject({ id: 'ch2.eqLow', target: 'ch2.eqLow' })
    expect(xzControlOf('cc:5:5')).toMatchObject({ id: 'ch1.color', centered: true })
  })

  it('follows the message list for the channel strips', () => {
    const id = (cc: number) => xzControlOf(`cc:5:${cc}`)?.id
    expect([1, 2, 3, 4, 5, 17].map(id)).toEqual([
      'ch1.trim',
      'ch1.eqHigh',
      'ch1.eqMid',
      'ch1.eqLow',
      'ch1.color',
      'ch1.fader'
    ])
    expect([80, 81, 92, 82, 83, 20].map(id)).toEqual([
      'ch4.trim',
      'ch4.eqHigh',
      'ch4.eqMid',
      'ch4.eqLow',
      'ch4.color',
      'ch4.fader'
    ])
    expect([11, 24, 47, 48, 49].map(id)).toEqual([
      'crossfader',
      'master.level',
      'master.eqHigh',
      'master.eqMid',
      'master.eqLow'
    ])
  })

  it('ignores other channels, other message kinds and unknown numbers', () => {
    expect(xzControlOf('cc:1:9')).toBeNull()
    expect(xzControlOf('note:5:9')).toBeNull()
    expect(xzControlOf('cc:5:100')).toBeNull()
    expect(xzControlOf(null)).toBeNull()
  })

  it('only gives mixer targets to controls the app models', () => {
    const targets = XZ_CONTROLS.flatMap((c) => (c.target ? [c.target] : []))
    expect(targets).toHaveLength(4 * 6 + 1)
    expect(xzControlOf('cc:5:24')?.target).toBeUndefined()
  })

  it('detects the unit by its port names and nothing else', () => {
    expect(profileFor('XDJ-XZ (1)')?.id).toBe('xdj-xz')
    expect(profileFor('XDJ-XZ (2)')?.id).toBe('xdj-xz')
    expect(profileFor('IAC Driver Bus 1')).toBeNull()
    expect(profileFor('XDJ-AZ')).toBeNull()
  })

  it('reads the crossfader assign switch', () => {
    expect([0, 0x40, 0x7f].map(assignLabel)).toEqual(['A', 'THRU', 'B'])
  })
})

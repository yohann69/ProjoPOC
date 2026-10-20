import { describe, expect, it } from 'vitest'
import type { Received } from '../store/useMidiStore'
import { decodeMidi } from './midiDecode'
import { emptyUsb, foldUsb } from './usbStats'

const row = (port: string, bytes: number[], id: number, ts = id): Received => ({
  id,
  ts,
  port,
  bytes,
  message: decodeMidi(bytes)
})

describe('foldUsb', () => {
  it('keeps controls apart per port and tracks value, range and count', () => {
    const out = foldUsb(
      emptyUsb(),
      [
        row('XDJ-XZ (1)', [0xb4, 9, 10], 1),
        row('XDJ-XZ (2)', [0xb4, 9, 20], 2),
        row('XDJ-XZ (2)', [0xb4, 9, 90], 3)
      ],
      1000
    )
    expect(Object.keys(out.controls).sort()).toEqual(['XDJ-XZ (1)|cc:5:9', 'XDJ-XZ (2)|cc:5:9'])
    expect(out.controls['XDJ-XZ (2)|cc:5:9']).toMatchObject({
      raw: 90,
      low: 20,
      high: 90,
      count: 2,
      channel: 5,
      number: 9,
      kind: 'cc'
    })
  })

  it('counts every kind per port, including clock, and keeps the newest sysex first', () => {
    const out = foldUsb(
      emptyUsb(),
      [
        row('p', [0xf8], 1),
        row('p', [0xf8], 2),
        row('p', [0xf0, 1, 2, 0xf7], 3),
        row('p', [0x90, 60, 100], 4),
        row('p', [0xf0, 9, 0xf7], 5)
      ],
      1000
    )
    expect(out.ports.p).toMatchObject({ total: 5, byKind: { clock: 2, sysex: 2, noteOn: 1 } })
    expect(out.sysex.map((s) => s.id)).toEqual([5, 3])
    expect(Object.keys(out.controls)).toEqual(['p|note:1:60'])
  })

  it('measures messages per second over a full window', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row('p', [0xb0, 1, i], i))
    let state = foldUsb(emptyUsb(), rows.slice(0, 5), 0)
    state = foldUsb(state, rows.slice(5), 2000)
    expect(state.ports.p?.rate).toBe(Math.round((10 * 1000) / 2000))
    expect(state.ports.p?.windowCount).toBe(0)
  })

  it('returns the same state for an empty batch', () => {
    const state = emptyUsb()
    expect(foldUsb(state, [], 5)).toBe(state)
  })
})

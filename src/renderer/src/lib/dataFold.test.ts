import { describe, expect, it } from 'vitest'
import type { AppEvent } from '@shared/types'
import { foldDump, foldSnapshot, parseHex } from './dataFold'

const snapshot = (fields: Record<string, string | number | boolean | null>) =>
  ({ type: 'dataSnapshot', source: 'prolink', group: 'g', title: 'G', fields, ts: 1 }) as Extract<
    AppEvent,
    { type: 'dataSnapshot' }
  >

const dump = (hex: string, count = 1) =>
  ({
    type: 'packetDump',
    source: 'prolink',
    key: 'k',
    port: 50002,
    kind: 'status',
    srcAddr: '10.0.0.5',
    device: 1,
    length: hex === '' ? 0 : hex.split(' ').length,
    hex,
    count,
    ts: 1
  }) as Extract<AppEvent, { type: 'packetDump' }>

describe('foldSnapshot', () => {
  it('stamps new fields, counts later changes and leaves steady ones alone', () => {
    const first = foldSnapshot(undefined, snapshot({ beat: 1, name: 'x' }), 100)
    expect(first.changedAt).toEqual({ beat: 100, name: 100 })
    expect(first.changes).toEqual({})
    const second = foldSnapshot(first, snapshot({ beat: 2, name: 'x', extra: true }), 200)
    expect(second.changedAt).toEqual({ beat: 200, name: 100, extra: 200 })
    expect(second.changes).toEqual({ beat: 1, extra: 1 })
    expect(second.fields).toEqual({ beat: 2, name: 'x', extra: true })
  })
})

describe('foldDump', () => {
  it('parses hex and tracks which bytes change', () => {
    expect(parseHex('00 ff 10')).toEqual([0, 255, 16])
    expect(parseHex('')).toEqual([])
    const first = foldDump(undefined, dump('51 73 03'), 100)
    expect(first.bytes).toEqual([0x51, 0x73, 3])
    expect(first.changes).toEqual([0, 0, 0])
    const second = foldDump(first, dump('51 73 04', 2), 200)
    expect(second.changes).toEqual([0, 0, 1])
    expect(second.changedAt).toEqual([0, 0, 200])
    const third = foldDump(second, dump('51 73 05 09', 3), 300)
    expect(third.changes).toEqual([0, 0, 2, 0])
    expect(third.changedAt[3]).toBe(0)
    expect(third.count).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'
import type { AppEvent } from '@shared/types'
import type { CapturedPacket } from './capture'
import { createContext } from './context'
import { PacketDumps } from './dumps'
import { SnapshotPublisher } from './snapshots'
import { statusPacket } from './testing/packetBuilders'

describe('SnapshotPublisher', () => {
  const setup = (throttleMs = 200) => {
    let now = 0
    const out: AppEvent[] = []
    const ctx = createContext(
      (r) => r.kind === 'inspector' && out.push(r.event),
      () => undefined,
      () => now
    )
    return { publisher: new SnapshotPublisher(ctx, throttleMs), out, at: (t: number) => (now = t) }
  }

  it('skips unchanged values and publishes changes', () => {
    const { publisher, out, at } = setup()
    publisher.publish('g', 'G', { a: 1 })
    publisher.publish('g', 'G', { a: 1 })
    at(1)
    publisher.publish('g', 'G', { a: 2 })
    expect(out).toHaveLength(2)
    expect(out[1]).toMatchObject({ type: 'dataSnapshot', group: 'g', fields: { a: 2 } })
  })

  it('rate-limits throttled groups but lets the next change after the gap through', () => {
    const { publisher, out, at } = setup(200)
    publisher.publish('d', 'D', { n: 1 }, true)
    at(50)
    publisher.publish('d', 'D', { n: 2 }, true)
    at(250)
    publisher.publish('d', 'D', { n: 3 }, true)
    expect(out.map((e) => e.type === 'dataSnapshot' && e.fields.n)).toEqual([1, 3])
  })

  it('never drops an unthrottled change, and keeps groups apart', () => {
    const { publisher, out, at } = setup()
    publisher.publish('a', 'A', { n: 1 })
    at(1)
    publisher.publish('a', 'A', { n: 2 })
    publisher.publish('b', 'B', { n: 2 })
    expect(out).toHaveLength(3)
  })
})

describe('PacketDumps', () => {
  const packet = (device: number, ts: number, srcAddr = '10.0.0.5'): CapturedPacket => ({
    ts,
    srcAddr,
    srcPort: 50002,
    dstPort: 50002,
    payload: statusPacket({ device })
  })

  it('emits the whole newest packet per sender, kind and device, with a running count', () => {
    let now = 0
    const out: AppEvent[] = []
    const dumps = new PacketDumps(
      (e) => out.push(e),
      () => now
    )
    dumps.record(packet(1, 1), 'status')
    dumps.record(packet(2, 2), 'status')
    now = 300
    dumps.record(packet(1, 3), 'status')
    expect(out).toHaveLength(3)
    const last = out[2]
    if (last?.type !== 'packetDump') throw new Error('no dump')
    expect(last).toMatchObject({
      port: 50002,
      kind: 'status',
      device: 1,
      count: 2,
      srcAddr: '10.0.0.5'
    })
    expect(last.hex.split(' ')).toHaveLength(last.length)
    expect(last.key).not.toBe((out[1] as { key: string }).key)
  })

  it('holds back fast repeats and sends the final one on flush', () => {
    let now = 0
    const out: AppEvent[] = []
    const dumps = new PacketDumps(
      (e) => out.push(e),
      () => now
    )
    dumps.record(packet(1, 1), 'status')
    now = 10
    dumps.record(packet(1, 2), 'status')
    expect(out).toHaveLength(1)
    dumps.flush()
    expect(out).toHaveLength(2)
    expect(out[1]).toMatchObject({ count: 2, ts: 2 })
    dumps.flush()
    expect(out).toHaveLength(2)
  })
})

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppEvent } from '@shared/types'
import type { CapturedPacket } from './capture'
import { PacketInspector } from './inspector'
import { JsonlLog } from './packetLog'
import { beatPacket, statusPacket } from './testing/packetBuilders'
import { readRecording } from './testing/replay'

const packet = (dstPort: number, payload: Buffer, ts: number): CapturedPacket => ({
  ts,
  srcAddr: '10.0.0.5',
  srcPort: 50000,
  dstPort,
  payload
})

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('PacketInspector', () => {
  it('computes packets per second per port over the flush window', () => {
    let now = 0
    const events: AppEvent[] = []
    const inspector = new PacketInspector(
      (e) => events.push(e),
      () => now
    )
    for (let i = 0; i < 30; i++)
      inspector.record(packet(50001, beatPacket({ device: 1, beatInBar: 1, bpm: 120 }), i))
    for (let i = 0; i < 5; i++) inspector.record(packet(50002, statusPacket({ device: 1 }), i))
    now = 2000
    inspector.flush()
    const stats = events.find((e) => e.type === 'packetStats')
    if (stats?.type !== 'packetStats') throw new Error('no stats')
    expect(stats.ports).toEqual([
      { port: 50001, packetsPerSecond: 15, total: 30, kinds: { beat: 30 } },
      { port: 50002, packetsPerSecond: 2.5, total: 5, kinds: { status: 5 } }
    ])
    now = 3000
    inspector.flush()
    const second = events.filter((e) => e.type === 'packetStats')[1]
    expect(second).toMatchObject({ ports: [{ packetsPerSecond: 0, total: 30 }, { total: 5 }] })
  })

  it('always samples the first packet of a kind and rate-limits the rest', () => {
    const events: AppEvent[] = []
    const inspector = new PacketInspector(
      (e) => events.push(e),
      () => 0
    )
    for (let i = 0; i < 100; i++)
      inspector.record(packet(50001, beatPacket({ device: 1, beatInBar: 1, bpm: 120 }), i))
    inspector.record(packet(50002, statusPacket({ device: 1 }), 1))
    const raw = events.filter((e) => e.type === 'rawPacket')
    expect(raw.length).toBe(21 + 1)
    expect(raw[0]).toMatchObject({ port: 50001, kind: 'beat', length: 96 })
    expect(raw[raw.length - 1]).toMatchObject({ port: 50002, kind: 'status' })
  })

  it('writes every packet to JSONL and the log can be replayed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deckpulse-'))
    dirs.push(dir)
    const path = join(dir, 'nested', 'log.jsonl')
    const inspector = new PacketInspector(
      () => undefined,
      () => 0
    )
    inspector.setLog(new JsonlLog(path, () => undefined))
    const beat = beatPacket({ device: 1, beatInBar: 4, bpm: 128 })
    inspector.record(packet(50001, beat, 42))
    inspector.writeObservation('info', 'hello')
    inspector.stop()

    return new Promise<void>((resolve) => setTimeout(resolve, 50)).then(() => {
      const text = readFileSync(path, 'utf8')
      const lines = text
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      expect(lines[0]).toMatchObject({
        type: 'packet',
        ts: 42,
        port: 50001,
        length: 96,
        kind: 'beat'
      })
      expect(lines[1]).toMatchObject({ type: 'observation', message: 'hello' })
      const replayed = readRecording(text)
      expect(replayed).toHaveLength(1)
      expect(replayed[0]?.payload.equals(beat)).toBe(true)
    })
  })
})

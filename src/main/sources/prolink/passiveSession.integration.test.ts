import * as library from 'alphatheta-connect'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppEvent } from '@shared/types'
import { Normalizer } from '../../normalizer'
import type { CapturedPacket } from './capture'
import { createContext } from './context'
import { PacketInspector } from './inspector'
import { PassiveSession } from './passiveSession'
import type { ProlinkRawEvent } from './rawTypes'
import { announcePacket, beatPacket, statusPacket } from './testing/packetBuilders'
import { ReplayCapture } from './testing/replay'

const packet = (dstPort: number, payload: Buffer, ts: number): CapturedPacket => ({
  ts,
  srcAddr: '169.254.20.5',
  srcPort: 50000,
  dstPort,
  payload
})

const sessions: PassiveSession[] = []
afterEach(() => sessions.splice(0).forEach((s) => s.stop()))

function replay(packets: CapturedPacket[]) {
  const raws: ProlinkRawEvent[] = []
  const inspected: AppEvent[] = []
  const ctx = createContext(
    (raw) => raws.push(raw),
    () => undefined,
    () => 5000
  )
  const inspector = new PacketInspector(
    (e) => inspected.push(e),
    () => 5000
  )
  const session = new PassiveSession(library, new ReplayCapture(packets), ctx, inspector)
  sessions.push(session)
  session.start()
  return {
    session,
    inspector,
    inspected,
    raws,
    /** Evaluated on access so asynchronous work (track loading) can finish first. */
    get events() {
      const normalizer = new Normalizer()
      return raws.flatMap((raw) => normalizer.fromProlink(raw))
    }
  }
}

const AZ_SESSION = [
  packet(50000, announcePacket({ name: 'XDJ-AZ', device: 1, ip: '169.254.20.5', type: 1 }), 1000),
  packet(50000, announcePacket({ name: 'XDJ-AZ', device: 33, ip: '169.254.20.5', type: 3 }), 1001),
  packet(
    50002,
    statusPacket({
      device: 1,
      trackId: 7,
      trackType: 2,
      playState: 3,
      flags: 0x68,
      bpm: 128,
      pitchPercent: 2,
      beatInMeasure: 3
    }),
    1200
  ),
  packet(50001, beatPacket({ device: 1, beatInBar: 3, bpm: 128, pitchPercent: 2 }), 1500),
  packet(50001, beatPacket({ device: 33, beatInBar: 1, bpm: 128 }), 1501),
  packet(50001, Buffer.from('not a pro dj link packet'), 1502)
]

describe('passive session with the real alphatheta-connect services', () => {
  it('lists devices that share one IP and maps the player to deck 1', () => {
    const { events } = replay(AZ_SESSION)
    const lists = events.filter((e) => e.type === 'deviceList')
    const last = lists[lists.length - 1]
    if (last?.type !== 'deviceList') throw new Error('no device list')
    expect(last.devices.map((d) => [d.deviceNumber, d.kind, d.ip])).toEqual([
      [1, 'player', '169.254.20.5'],
      [33, 'mixer', '169.254.20.5']
    ])
    expect(last.devices[0]?.deck).toBe(1)
    expect(last.devices[1]?.deck).toBeUndefined()
  })

  it('turns status packets into ETH_LIVE deck state', () => {
    const { events } = replay(AZ_SESSION)
    const deck = events.find((e) => e.type === 'deckState')
    if (deck?.type !== 'deckState') throw new Error('no deck state')
    expect(deck.state).toMatchObject({
      deck: 1,
      playState: { value: 'playing', origin: 'ETH_LIVE' },
      isMaster: { value: true },
      isOnAir: { value: true },
      trackId: { value: '1:3:7' },
      pitchPercent: { value: 2, origin: 'ETH_LIVE' },
      beatInBar: { value: 3 }
    })
    expect(deck.state.bpm?.value).toBeCloseTo(130.56, 2)
  })

  it('emits beat packets with their capture time and ignores the mixer metronome', () => {
    const { events, raws } = replay(AZ_SESSION)
    const beats = events.filter((e) => e.type === 'beat')
    expect(beats).toEqual([{ type: 'beat', deck: 1, beatInBar: 3, ts: 1500, origin: 'ETH_LIVE' }])
    expect(raws.some((r) => r.kind === 'log' && r.message.includes('device 33'))).toBe(true)
  })

  it('reports a non-rekordbox track as unavailable instead of failing', async () => {
    const result = replay(AZ_SESSION)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const status = result.events.find((e) => e.type === 'trackStatus' && e.state === 'unavailable')
    expect(status).toMatchObject({
      deck: 1,
      message: expect.stringContaining('Not a rekordbox library track')
    })
  })

  it('records every packet in the inspector, including foreign traffic', () => {
    const { inspector, inspected } = replay(AZ_SESSION)
    inspector.flush()
    const stats = inspected.find((e) => e.type === 'packetStats')
    if (stats?.type !== 'packetStats') throw new Error('no stats')
    const byPort = Object.fromEntries(stats.ports.map((p) => [p.port, p]))
    expect(byPort[50000]?.total).toBe(2)
    expect(byPort[50002]?.kinds).toEqual({ status: 1 })
    expect(byPort[50001]?.kinds).toEqual({ beat: 2, foreign: 1 })
  })

  it('logs one raw status sample per device so play-state bytes can be studied', () => {
    const { raws } = replay(AZ_SESSION)
    const sample = raws.find((r) => r.kind === 'log' && r.message.includes('playState@0x7b'))
    expect(sample).toMatchObject({ message: expect.stringContaining('flags@0x89 0x68') })
  })

  it('derives beats from status when a deck sends no beat packets', () => {
    const status = (beat: number, ts: number) =>
      packet(50002, statusPacket({ device: 2, trackId: 9, playState: 3, beatInMeasure: beat }), ts)
    const { events } = replay([
      packet(
        50000,
        announcePacket({ name: 'XDJ-AZ', device: 2, ip: '169.254.20.5', type: 1 }),
        1000
      ),
      status(1, 1100),
      status(1, 1300),
      status(2, 1500)
    ])
    expect(events.filter((e) => e.type === 'beat')).toEqual([
      { type: 'beat', deck: 2, beatInBar: 2, ts: 5000, origin: 'ETH_LIVE' }
    ])
  })
})

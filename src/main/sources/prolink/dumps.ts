import type { AppEvent } from '@shared/types'
import type { CapturedPacket } from './capture'
import { hasProlinkHeader, toHex } from './packets'

const MAX_DUMP_BYTES = 2048
const MAX_KEYS = 64
const MIN_GAP_MS = 250

interface DumpState {
  count: number
  lastEmit: number
  latest: CapturedPacket
  kind: string
  dirty: boolean
}

/** Keeps the newest packet of each (sender, port, kind, device) and emits it whole, a few times a second. */
export class PacketDumps {
  private readonly states = new Map<string, DumpState>()

  constructor(
    private readonly emit: (event: AppEvent) => void,
    private readonly now: () => number
  ) {}

  record(packet: CapturedPacket, kind: string): void {
    const device = hasProlinkHeader(packet.payload) ? (packet.payload[0x21] ?? 0) : null
    const key = `${packet.srcAddr}|${packet.dstPort}|${kind}|${device ?? '-'}`
    let state = this.states.get(key)
    if (!state) {
      if (this.states.size >= MAX_KEYS) return
      state = { count: 0, lastEmit: -Infinity, latest: packet, kind, dirty: false }
      this.states.set(key, state)
    }
    state.count++
    state.latest = packet
    if (this.now() - state.lastEmit >= MIN_GAP_MS) this.send(key, state)
    else state.dirty = true
  }

  /** Sends what changed since the last emit so a quiet sender still shows its final packet. */
  flush(): void {
    for (const [key, state] of this.states) if (state.dirty) this.send(key, state)
  }

  private send(key: string, state: DumpState): void {
    const { latest } = state
    state.dirty = false
    state.lastEmit = this.now()
    this.emit({
      type: 'packetDump',
      source: 'prolink',
      key,
      port: latest.dstPort,
      kind: state.kind,
      srcAddr: latest.srcAddr,
      device: hasProlinkHeader(latest.payload) ? (latest.payload[0x21] ?? 0) : null,
      length: latest.payload.length,
      hex: toHex(latest.payload, MAX_DUMP_BYTES),
      count: state.count,
      ts: latest.ts
    })
  }
}

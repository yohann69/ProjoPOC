import type { AppEvent, PortStats } from '@shared/types'
import type { CapturedPacket } from './capture'
import { JsonlLog } from './packetLog'
import { PacketDumps } from './dumps'
import { packetKind, toHex } from './packets'

const MAX_LOGGED_BYTES = 2048
const PREVIEW_BYTES = 32
const SAMPLES_PER_SECOND = 20

interface PortCounter {
  total: number
  window: number
  kinds: Map<string, number>
}

/** Counts every packet per port, samples some to the UI, and optionally logs all of them to JSONL. */
export class PacketInspector {
  private readonly ports = new Map<number, PortCounter>()
  private readonly seenKinds = new Set<string>()
  private readonly dumps: PacketDumps
  private log: JsonlLog | null = null
  private lastFlush: number
  private samplesLeft = SAMPLES_PER_SECOND
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly emit: (event: AppEvent) => void,
    private readonly now: () => number = Date.now
  ) {
    this.lastFlush = now()
    this.dumps = new PacketDumps(emit, now)
  }

  start(): void {
    this.timer ??= setInterval(() => this.flush(), 1000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.setLog(null)
  }

  setLog(log: JsonlLog | null): void {
    this.log?.close()
    this.log = log
  }

  get logPath(): string | null {
    return this.log?.path ?? null
  }

  writeObservation(level: 'info' | 'warn' | 'error', message: string): void {
    this.log?.write({ type: 'observation', ts: this.now(), level, message })
  }

  record(packet: CapturedPacket): void {
    const kind = packetKind(packet.dstPort, packet.payload)
    const counter = this.ports.get(packet.dstPort) ?? { total: 0, window: 0, kinds: new Map() }
    counter.total++
    counter.window++
    counter.kinds.set(kind, (counter.kinds.get(kind) ?? 0) + 1)
    this.ports.set(packet.dstPort, counter)
    this.dumps.record(packet, kind)

    const hexPreview = toHex(packet.payload, PREVIEW_BYTES)
    const truncated = packet.payload.length > MAX_LOGGED_BYTES
    this.log?.write({
      type: 'packet',
      ts: packet.ts,
      srcAddr: packet.srcAddr,
      srcPort: packet.srcPort,
      port: packet.dstPort,
      length: packet.payload.length,
      kind,
      hexPreview,
      hex: toHex(packet.payload, MAX_LOGGED_BYTES),
      ...(truncated ? { truncated } : {})
    })

    const firstOfKind = !this.seenKinds.has(`${packet.dstPort}:${kind}`)
    if (firstOfKind || this.samplesLeft > 0) {
      this.seenKinds.add(`${packet.dstPort}:${kind}`)
      if (!firstOfKind) this.samplesLeft--
      this.emit({
        type: 'rawPacket',
        source: 'prolink',
        port: packet.dstPort,
        length: packet.payload.length,
        hexPreview,
        kind
      })
    }
  }

  /** Emits packets/second per port for the window since the last flush. */
  flush(): void {
    const now = this.now()
    const seconds = Math.max((now - this.lastFlush) / 1000, 0.001)
    this.lastFlush = now
    this.samplesLeft = SAMPLES_PER_SECOND
    this.dumps.flush()
    const ports: PortStats[] = [...this.ports.entries()]
      .sort(([a], [b]) => a - b)
      .map(([port, c]) => {
        const stats = {
          port,
          packetsPerSecond: Math.round((c.window / seconds) * 10) / 10,
          total: c.total,
          kinds: Object.fromEntries(c.kinds)
        }
        c.window = 0
        return stats
      })
    this.emit({ type: 'packetStats', source: 'prolink', ports })
  }
}

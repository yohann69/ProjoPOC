import type { MediaSlot } from 'alphatheta-connect'
import type { CapturedPacket, PacketCapture } from './capture'
import type { SessionContext } from './context'
import { DeckPipeline } from './deckPipeline'
import type { ProlinkError } from './errors'
import { classifyError } from './errors'
import type { PacketInspector } from './inspector'
import type { Library } from './library'
import { createLibraryAdapter } from './libraryAdapter'
import { BEAT_PORT, hasProlinkHeader, packetKind, STATUS_PORT } from './packets'

type DatabaseSlot = MediaSlot.USB | MediaSlot.SD

export interface SessionInfo {
  /** Set when the session broke on its own and must be rebuilt. */
  failure: ProlinkError | null
  lastPacketAt: number
  deviceCount: number
  /** Passive sessions only: whether any deck status packet (UDP 50002) has been captured. */
  statusSeen?: boolean
  stop(): void | Promise<void>
}

/**
 * Passive mode: our own pcap capture feeds alphatheta-connect's passive services (devices, status,
 * local rekordbox database over NFS). Nothing is sent to the network.
 */
export class PassiveSession implements SessionInfo {
  failure: ProlinkError | null = null
  lastPacketAt = 0
  statusSeen = false
  private readonly dm
  private readonly status
  private readonly position
  private readonly localdb
  private readonly pipeline: DeckPipeline
  private readonly route

  constructor(
    library: Library,
    private readonly capture: PacketCapture,
    private readonly ctx: SessionContext,
    private readonly inspector: PacketInspector
  ) {
    const { adapter, route } = createLibraryAdapter(capture.interfaceName)
    this.route = route
    this.dm = new library.PassiveDeviceManager(adapter)
    this.status = new library.PassiveStatusEmitter(adapter)
    this.position = new library.PassivePositionEmitter(adapter)
    this.localdb = new library.PassiveLocalDatabase(this.dm, this.status, 'auto')
    this.pipeline = new DeckPipeline(
      ctx,
      {
        getDevice: (id) => this.dm.devices.get(id),
        findTrack: async (id, slot, trackId) => {
          const db = await this.localdb.get(id, slot as DatabaseSlot)
          return { track: db?.findTrack(trackId) ?? null, hasDb: db !== null }
        },
        loadAnlz: library.loadAnlz,
        fetchFile: library.fetchFile
      },
      () => [...this.dm.devices.values()]
    )
  }

  get deviceCount(): number {
    return this.dm.devices.size
  }

  start(): void {
    this.dm.on('connected', (d) => this.pipeline.onDevice('connected', d))
    this.dm.on('disconnected', (d) => this.pipeline.onDevice('disconnected', d))
    this.status.on('status', (s) => this.pipeline.onStatus(s))
    this.status.on('mediaSlot', (m) => {
      this.pipeline.onMediaSlot(m)
      this.ctx.observe(
        `media:${m.deviceId}:${m.slot}`,
        `mediaSlot broadcast from device ${m.deviceId} slot ${m.slot}: ${m.name}`
      )
    })
    this.status.on('onAir', (o) => {
      this.pipeline.onAir(o)
      this.ctx.observe(
        `onAir:${o.deviceId}`,
        `mixer on-air packet from device ${o.deviceId}: ${JSON.stringify(o.channels)} (per-deck on-air comes from player status flags)`
      )
    })
    this.status.on('mixerState', (m) => this.pipeline.onMixerState(m))
    this.position.on('position', (p) => this.pipeline.onPosition(p))
    this.capture.on('packet', (p) => this.onPacket(p))
    this.capture.on('error', (e) => {
      this.failure = classifyError(e)
    })
    this.capture.start()
  }

  stop(): void {
    this.capture.stop()
    this.pipeline.stop()
    this.localdb.stop()
    this.position.stop()
    this.status.stop()
    this.dm.stop()
  }

  private onPacket(packet: CapturedPacket): void {
    this.lastPacketAt = packet.ts
    this.inspector.record(packet)
    if (packet.dstPort === STATUS_PORT && packetKind(packet.dstPort, packet.payload) === 'status') {
      this.statusSeen = true
    }
    this.observeStatus(packet)
    this.route(packet)
    if (packet.dstPort === BEAT_PORT) this.pipeline.onBeatPacket(packet)
  }

  /** Keeps one raw status sample per device so unknown play-state bytes can be studied. */
  private observeStatus(packet: CapturedPacket): void {
    const bytes = packet.payload
    if (!hasProlinkHeader(bytes) || packetKind(packet.dstPort, bytes) !== 'status') return
    const device = bytes[0x21] ?? 0
    const hex = (i: number): string => `0x${(bytes[i] ?? 0).toString(16).padStart(2, '0')}`
    this.ctx.observe(
      `status-sample:${packet.srcAddr}:${device}`,
      `status packet from ${packet.srcAddr} device ${device}: length ${bytes.length}, playState@0x7b ${hex(0x7b)}, flags@0x89 ${hex(0x89)}`
    )
  }
}

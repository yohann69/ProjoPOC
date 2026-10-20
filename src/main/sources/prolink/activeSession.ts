import type { MediaSlot, ProlinkNetwork } from 'alphatheta-connect'
import type { NetworkInterfaceInfoIPv4 } from 'node:os'
import type { CapturedPacket, PacketCapture } from './capture'
import type { SessionContext } from './context'
import { DeckPipeline } from './deckPipeline'
import { classifyError, findRekordboxProcess, ProlinkError } from './errors'
import type { PacketInspector } from './inspector'
import type { Library } from './library'
import { BEAT_PORT } from './packets'
import type { SessionInfo } from './passiveSession'

type DatabaseSlot = MediaSlot.USB | MediaSlot.SD

const NO_PEER_NOTICE_MS = 10_000

/**
 * Active mode: joins the network as a virtual CDJ (alphatheta-connect `bringOnline`). All-in-one
 * units may not accept this; an optional pcap capture still feeds the packet inspector and beats.
 */
export class ActiveSession implements SessionInfo {
  failure: ProlinkError | null = null
  lastPacketAt = 0
  private network: ProlinkNetwork | null = null
  private pipeline: DeckPipeline | null = null

  constructor(
    private readonly library: Library,
    private readonly ctx: SessionContext,
    private readonly inspector: PacketInspector,
    private readonly iface: NetworkInterfaceInfoIPv4 | null,
    private readonly capture: PacketCapture | null
  ) {}

  get deviceCount(): number {
    return this.network?.deviceManager.devices.size ?? 0
  }

  async start(): Promise<void> {
    const running = await findRekordboxProcess()
    if (running) {
      throw new ProlinkError(
        'rekordboxConflict',
        `rekordbox is running on this computer (${running}). The library cannot go online while it holds the Pro DJ Link ports: quit rekordbox or use passive mode.`
      )
    }
    let network: ProlinkNetwork
    try {
      network = await this.library.bringOnline()
    } catch (error) {
      throw classifyError(error)
    }
    this.network = network
    const pipeline = new DeckPipeline(
      this.ctx,
      {
        getDevice: (id) => network.deviceManager.devices.get(id),
        findTrack: async (id, slot, trackId, trackBpm) => {
          const found = await network.localdb?.findTrack(id, slot as DatabaseSlot, trackId, {
            trackBPM: trackBpm
          })
          return {
            track: found?.track ?? null,
            hasDb: !!found?.adapter,
            switchedTo: found?.switchedTo ?? null
          }
        },
        loadAnlz: this.library.loadAnlz,
        fetchFile: this.library.fetchFile
      },
      () => [...network.deviceManager.devices.values()]
    )
    this.pipeline = pipeline
    network.deviceManager.on('connected', (d) => pipeline.onDevice('connected', d))
    network.deviceManager.on('disconnected', (d) => pipeline.onDevice('disconnected', d))

    if (this.iface) {
      network.configure({ iface: this.iface, vcdjId: 7 })
    } else {
      const notice = setTimeout(
        () =>
          this.ctx.log('warn', 'still waiting for a Pro DJ Link device to choose the interface'),
        NO_PEER_NOTICE_MS
      )
      await network.autoconfigFromPeers().finally(() => clearTimeout(notice))
    }
    network.connect()
    network.statusEmitter?.on('status', (s) => {
      this.lastPacketAt = this.ctx.now()
      pipeline.onStatus(s)
    })
    network.statusEmitter?.on('mediaSlot', (m) => pipeline.onMediaSlot(m))
    network.statusEmitter?.on('onAir', (o) => pipeline.onAir(o))
    network.statusEmitter?.on('mixerState', (m) => pipeline.onMixerState(m))
    network.positionEmitter?.on('position', (p) => pipeline.onPosition(p))
    this.startCapture(pipeline)
  }

  async stop(): Promise<void> {
    this.capture?.stop()
    this.pipeline?.stop()
    const network = this.network
    this.network = null
    if (!network) return
    try {
      network.disconnect()
      await network.close()
    } catch (error) {
      this.ctx.log('warn', `closing the virtual CDJ failed: ${String(error)}`)
    }
  }

  private startCapture(pipeline: DeckPipeline): void {
    if (!this.capture) return
    this.capture.on('packet', (p: CapturedPacket) => {
      this.inspector.record(p)
      if (p.dstPort === BEAT_PORT) pipeline.onBeatPacket(p)
    })
    try {
      this.capture.start()
    } catch (error) {
      this.ctx.log(
        'warn',
        `packet inspector unavailable in active mode: ${classifyError(error).message}`
      )
    }
  }
}

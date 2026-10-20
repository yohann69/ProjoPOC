import { networkInterfaces } from 'node:os'
import { TypedEmitter } from '../../utils/typedEmitter'
import { loadCap, type CapModule } from './capTypes'
import { classifyError, ProlinkError } from './errors'

export const CAPTURE_FILTER = 'udp and portrange 50000-50100'

export interface CapturedPacket {
  ts: number
  srcAddr: string
  srcPort: number
  /** Destination UDP port, which selects the Pro DJ Link channel. */
  dstPort: number
  payload: Buffer
}

export interface CaptureEvents {
  packet: CapturedPacket
  error: Error
}

export type PacketCapture = TypedEmitter<CaptureEvents> & {
  readonly interfaceName: string
  start(): void
  stop(): void
}

const BUFFER_SIZE = 10 * 1024 * 1024
const UDP_HEADER_BYTES = 8
const failedCaps: unknown[] = []

/** Node reports friendly names on Windows while Npcap wants `\Device\NPF_{GUID}`; match by IPv4. */
function resolveWindowsDevice(iface: string, cap: CapModule): string {
  if (iface.startsWith('\\Device\\')) return iface
  const wanted = new Set(
    (networkInterfaces()[iface] ?? []).filter((i) => i.family === 'IPv4').map((i) => i.address)
  )
  const match = cap.Cap.deviceList().find((d) =>
    d.addresses?.some((a) => a.addr && wanted.has(a.addr))
  )
  return match?.name ?? iface
}

/** libpcap capture through the native `cap` module, decoded down to UDP payloads. */
export class PcapCapture extends TypedEmitter<CaptureEvents> implements PacketCapture {
  private cap: InstanceType<CapModule['Cap']> | null = null

  constructor(
    readonly interfaceName: string,
    private readonly options: {
      filter?: string
      load?: () => CapModule
      now?: () => number
    } = {}
  ) {
    super()
  }

  start(): void {
    if (this.cap) return
    let module: CapModule
    try {
      module = (this.options.load ?? loadCap)()
    } catch (error) {
      throw classifyError(error)
    }
    const { Cap, decoders } = module
    const cap = new Cap()
    const buffer = Buffer.alloc(65535)
    const device =
      process.platform === 'win32'
        ? resolveWindowsDevice(this.interfaceName, module)
        : this.interfaceName
    let linkType: string
    try {
      linkType = cap.open(device, this.options.filter ?? CAPTURE_FILTER, BUFFER_SIZE, buffer)
    } catch (error) {
      // cap 0.2.1 leaves a half-initialised handle after a failed open and crashes the process
      // when that instance is garbage collected or reused, so it is kept alive and never touched.
      failedCaps.push(cap)
      throw classifyError(error)
    }
    if (linkType !== 'ETHERNET') {
      cap.close()
      throw new ProlinkError(
        'noInterface',
        `${this.interfaceName} is a ${linkType} link; only Ethernet is supported.`
      )
    }
    cap.setMinBytes?.(0)
    cap.on('packet', (nbytes, truncated) => {
      if (truncated) return
      try {
        const eth = decoders.Ethernet(buffer)
        if (eth.info.type !== decoders.PROTOCOL.ETHERNET.IPV4) return
        const ip = decoders.IPV4(buffer, eth.offset)
        if (ip.info.protocol !== decoders.PROTOCOL.IP.UDP) return
        const udp = decoders.UDP(buffer, ip.offset)
        const length = Math.min(udp.info.length - UDP_HEADER_BYTES, nbytes - udp.offset)
        if (length <= 0) return
        this.emit('packet', {
          ts: (this.options.now ?? Date.now)(),
          srcAddr: ip.info.srcaddr,
          srcPort: udp.info.srcport,
          dstPort: udp.info.dstport,
          payload: Buffer.from(buffer.subarray(udp.offset, udp.offset + length))
        })
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)))
      }
    })
    cap.on('error', (error) => this.emit('error', error))
    this.cap = cap
  }

  stop(): void {
    this.cap?.close()
    this.cap = null
  }
}

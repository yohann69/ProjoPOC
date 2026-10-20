/** The subset of the `cap` module (native libpcap binding) that DeckPulse uses; it ships no types. */
export interface CapDecoders {
  Ethernet(buffer: Buffer): { info: { type: number }; offset: number }
  IPV4(
    buffer: Buffer,
    offset: number
  ): { info: { protocol: number; srcaddr: string }; offset: number }
  UDP(
    buffer: Buffer,
    offset: number
  ): { info: { srcport: number; dstport: number; length: number }; offset: number }
  PROTOCOL: { ETHERNET: { IPV4: number }; IP: { UDP: number } }
}

export interface CapDevice {
  name: string
  addresses?: { addr?: string }[]
}

export interface CapInstance {
  open(device: string, filter: string, bufferSize: number, buffer: Buffer): string
  close(): void
  setMinBytes?(bytes: number): void
  on(event: 'packet', listener: (nbytes: number, truncated: boolean) => void): void
  on(event: 'error', listener: (error: Error) => void): void
}

export interface CapModule {
  Cap: { new (): CapInstance; deviceList(): CapDevice[] }
  decoders: CapDecoders
}

/** Loaded lazily so a missing or wrongly built native module cannot crash app start-up. */
export function loadCap(): CapModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('cap') as CapModule
}

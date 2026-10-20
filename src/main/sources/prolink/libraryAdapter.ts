import { EventEmitter } from 'node:events'
import type { PcapAdapter } from 'alphatheta-connect'
import type { CapturedPacket } from './capture'
import { ANNOUNCE_PORT, BEAT_PORT, STATUS_PORT } from './packets'

export interface LibraryAdapter {
  adapter: PcapAdapter
  route(packet: CapturedPacket): void
}

const EVENT_BY_PORT: Record<number, 'announce' | 'beat' | 'status'> = {
  [ANNOUNCE_PORT]: 'announce',
  [BEAT_PORT]: 'beat',
  [STATUS_PORT]: 'status'
}

/**
 * alphatheta-connect 0.28.5 cannot start its own PcapAdapter (its bundle fails to resolve `cap`),
 * but its passive services only subscribe to `announce`/`status`/`beat` on the adapter they are
 * given. This stand-in feeds them the same events from our own capture.
 */
export function createLibraryAdapter(interfaceName: string): LibraryAdapter {
  const emitter = new EventEmitter()
  const bridge = {
    on: emitter.addListener.bind(emitter),
    off: emitter.removeListener.bind(emitter),
    once: emitter.once.bind(emitter),
    start: () => undefined,
    stop: () => undefined,
    isCapturing: true,
    interfaceName
  }
  return {
    adapter: bridge as unknown as PcapAdapter,
    route(packet) {
      const event = EVENT_BY_PORT[packet.dstPort]
      if (event)
        emitter.emit(event, packet.payload, { payload: packet.payload, srcAddr: packet.srcAddr })
    }
  }
}

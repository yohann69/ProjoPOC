import type {
  AppEvent,
  DeckId,
  DeviceInfo,
  PortStats,
  SourceId,
  SourceState,
  TrackInfo,
  TrackLoadState
} from '@shared/types'
import { create } from 'zustand'

export interface PacketSample {
  id: number
  port: number
  length: number
  hexPreview: string
  kind?: string
}

export interface LogEntry {
  id: number
  level: 'info' | 'warn' | 'error'
  message: string
  ts: number
}

const MAX_PACKETS = 60
const MAX_LOGS = 100
const MAX_RATE_SAMPLES = 60

interface LiveStore {
  source: SourceId | null
  sourceState: SourceState
  sourceMessage?: string
  devices: DeviceInfo[]
  ports: PortStats[]
  /** Packets per second per port, oldest first, one sample per second. */
  portHistory: Record<number, number[]>
  packets: PacketSample[]
  logs: LogEntry[]
  trackStatus: Partial<Record<DeckId, { state: TrackLoadState; message?: string }>>
  tracks: Partial<Record<DeckId, TrackInfo>>
  apply(events: AppEvent[]): void
  /** Clears everything that belongs to a previous source run. */
  reset(): void
}

let nextId = 0

const empty = {
  devices: [],
  ports: [],
  portHistory: {},
  packets: [],
  logs: [],
  trackStatus: {},
  tracks: {}
}

export const useLiveStore = create<LiveStore>((set) => ({
  source: null,
  sourceState: 'stopped',
  ...empty,
  reset: () => set({ ...empty }),
  apply: (events) =>
    set((state) => {
      const next: Partial<LiveStore> = {}
      const packets: PacketSample[] = []
      const logs: LogEntry[] = []
      for (const event of events) {
        switch (event.type) {
          case 'sourceStatus':
            next.source = event.source
            next.sourceState = event.state
            next.sourceMessage = event.message
            break
          case 'deviceList':
            next.devices = event.devices
            break
          case 'packetStats': {
            next.ports = event.ports
            const history = { ...(next.portHistory ?? state.portHistory) }
            for (const p of event.ports) {
              history[p.port] = [...(history[p.port] ?? []), p.packetsPerSecond].slice(
                -MAX_RATE_SAMPLES
              )
            }
            next.portHistory = history
            break
          }
          case 'rawPacket':
            packets.unshift({ id: nextId++, ...event })
            break
          case 'sourceLog':
            logs.unshift({ id: nextId++, level: event.level, message: event.message, ts: event.ts })
            break
          case 'trackStatus':
            next.trackStatus = {
              ...(next.trackStatus ?? state.trackStatus),
              [event.deck]: { state: event.state, message: event.message }
            }
            break
          case 'track': {
            const tracks = { ...(next.tracks ?? state.tracks) }
            if (event.track) tracks[event.deck] = event.track.value
            else delete tracks[event.deck]
            next.tracks = tracks
            break
          }
          default:
            break
        }
      }
      if (packets.length) next.packets = [...packets, ...state.packets].slice(0, MAX_PACKETS)
      if (logs.length) next.logs = [...logs, ...state.logs].slice(0, MAX_LOGS)
      return Object.keys(next).length > 0 ? next : state
    })
}))

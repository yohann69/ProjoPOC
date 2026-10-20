import type { AppEvent, AppEventType } from '@shared/types'
import { create } from 'zustand'

export interface LoggedEvent {
  id: number
  receivedAt: number
  event: AppEvent
}

const MAX_LOG = 300
const NOISY_TYPES: AppEventType[] = [
  'deckState',
  'mixer',
  'rawPacket',
  'packetStats',
  'dataSnapshot',
  'packetDump',
  'hook',
  'energy'
]

interface EventStore {
  /** Newest first. */
  log: LoggedEvent[]
  /** While paused, incoming events are dropped so the log can be read. */
  paused: boolean
  togglePause(): void
  /** Types skipped on arrival; toggling only affects events received afterwards. */
  hiddenTypes: AppEventType[]
  push(events: AppEvent[]): void
  toggleType(type: AppEventType): void
  clear(): void
}

let nextId = 0

export const useEventStore = create<EventStore>((set) => ({
  log: [],
  paused: false,
  togglePause: () => set((state) => ({ paused: !state.paused })),
  hiddenTypes: NOISY_TYPES,
  push: (events) =>
    set((state) => {
      if (state.paused) return state
      const receivedAt = Date.now()
      const added: LoggedEvent[] = []
      for (const event of events) {
        if (!state.hiddenTypes.includes(event.type)) added.push({ id: nextId++, receivedAt, event })
      }
      return added.length ? { log: [...added.reverse(), ...state.log].slice(0, MAX_LOG) } : state
    }),
  toggleType: (type) =>
    set((state) => ({
      hiddenTypes: state.hiddenTypes.includes(type)
        ? state.hiddenTypes.filter((t) => t !== type)
        : [...state.hiddenTypes, type]
    })),
  clear: () => set({ log: [] })
}))

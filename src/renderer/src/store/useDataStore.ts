import type { AppEvent } from '@shared/types'
import { create } from 'zustand'
import { foldDump, foldSnapshot, type DumpView, type SnapshotView } from '../lib/dataFold'

interface DataStore {
  snapshots: Record<string, SnapshotView>
  dumps: Record<string, DumpView>
  apply(events: AppEvent[]): void
  reset(): void
}

export const useDataStore = create<DataStore>((set) => ({
  snapshots: {},
  dumps: {},
  reset: () => set({ snapshots: {}, dumps: {} }),
  apply: (events) =>
    set((state) => {
      let snapshots = state.snapshots
      let dumps = state.dumps
      const now = Date.now()
      for (const event of events) {
        if (event.type === 'dataSnapshot') {
          snapshots = {
            ...snapshots,
            [event.group]: foldSnapshot(snapshots[event.group], event, now)
          }
        } else if (event.type === 'packetDump') {
          dumps = { ...dumps, [event.key]: foldDump(dumps[event.key], event, now) }
        }
      }
      return snapshots === state.snapshots && dumps === state.dumps ? state : { snapshots, dumps }
    })
}))

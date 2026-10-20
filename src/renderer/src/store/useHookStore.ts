import type { HookEvent, HookServerStatus } from '@shared/hooks'
import type { AppEvent } from '@shared/types'
import { create } from 'zustand'

const MAX_PER_TYPE = 20

/** Newest first, keeping at most MAX_PER_TYPE of each type so rare events are not pushed out by beats. */
export function mergeHooks(recent: HookEvent[], incoming: HookEvent[]): HookEvent[] {
  const counts = new Map<string, number>()
  return [...incoming, ...recent].filter((hook) => {
    const count = (counts.get(hook.type) ?? 0) + 1
    counts.set(hook.type, count)
    return count <= MAX_PER_TYPE
  })
}

interface HookStore {
  /** Newest first. */
  recent: HookEvent[]
  server: HookServerStatus
  apply(events: AppEvent[]): void
  clear(): void
}

export const useHookStore = create<HookStore>((set) => ({
  recent: [],
  server: { listening: false, port: null, clients: 0 },
  apply: (events) => {
    const hooks: HookEvent[] = []
    let server: HookServerStatus | undefined
    for (const event of events) {
      if (event.type === 'hook') hooks.unshift(event.hook)
      else if (event.type === 'hookServer') server = event.status
    }
    if (hooks.length === 0 && !server) return
    set((state) => ({
      recent: hooks.length ? mergeHooks(state.recent, hooks) : state.recent,
      server: server ?? state.server
    }))
  },
  clear: () => set({ recent: [] })
}))

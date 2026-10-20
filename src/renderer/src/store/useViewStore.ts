import { create } from 'zustand'

export type DataTab = 'ethernet' | 'usb'

interface ViewStore {
  /** The full-screen data view replaces the dashboard while open. */
  dataOpen: boolean
  dataTab: DataTab
  setDataOpen(open: boolean): void
  setDataTab(tab: DataTab): void
}

export const useViewStore = create<ViewStore>((set) => ({
  dataOpen: false,
  dataTab: 'ethernet',
  setDataOpen: (dataOpen) => set({ dataOpen }),
  setDataTab: (dataTab) => set({ dataTab })
}))

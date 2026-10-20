import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from '@shared/hooks'
import { DEFAULT_PROLINK_CONFIG, type ProlinkConfig } from '@shared/prolink'
import { DEFAULT_REPLAY_CONFIG, type ReplayConfig } from '@shared/recording'
import { DEFAULT_SIMULATOR_CONFIG, type SimulatorConfig } from '@shared/simulator'
import { DEFAULT_UI_SETTINGS, type UiSettings } from '@shared/ui'
import { DEFAULT_OPTIONAL_SETTINGS, type OptionalSettings } from '@shared/usb'
import { create } from 'zustand'

interface SettingsStore {
  prolink: ProlinkConfig
  dashboard: DashboardSettings
  optional: OptionalSettings
  ui: UiSettings
  simulator: SimulatorConfig
  /** Recording chosen for replay; the path is not persisted. */
  replay: ReplayConfig
  /** Source selected in the top bar; remembered in `ui`. */
  selected: UiSettings['selectedSource']
  loaded: boolean
  select(source: UiSettings['selectedSource']): void
  updateSimulator(patch: Partial<SimulatorConfig>): void
  updateReplay(patch: Partial<ReplayConfig>): void
  load(): Promise<void>
  /** Updates the prolink settings and remembers them. */
  updateProlink(patch: Partial<ProlinkConfig>): void
  updateDashboard(patch: Partial<DashboardSettings>): void
  /** Remembers the chosen MIDI port and audio device. */
  updateOptional(patch: Partial<OptionalSettings>): void
  /** Remembers interface preferences such as the open side tab. */
  updateUi(patch: Partial<UiSettings>): void
}

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const save = (): void => {
    const { prolink, dashboard, optional, ui } = get()
    void window.deckpulse.saveSettings({ prolink, dashboard, optional, ui })
  }
  return {
    prolink: DEFAULT_PROLINK_CONFIG,
    dashboard: DEFAULT_DASHBOARD_SETTINGS,
    optional: DEFAULT_OPTIONAL_SETTINGS,
    ui: DEFAULT_UI_SETTINGS,
    simulator: DEFAULT_SIMULATOR_CONFIG,
    replay: DEFAULT_REPLAY_CONFIG,
    selected: DEFAULT_UI_SETTINGS.selectedSource,
    loaded: false,
    select: (selected) => {
      set({ selected, ui: { ...get().ui, selectedSource: selected } })
      save()
    },
    updateSimulator: (patch) => set({ simulator: { ...get().simulator, ...patch } }),
    updateReplay: (patch) => set({ replay: { ...get().replay, ...patch } }),
    load: async () => {
      const { prolink, dashboard, optional, ui } = await window.deckpulse.getSettings()
      const first = !get().loaded
      set({
        prolink,
        dashboard,
        optional,
        ui,
        loaded: true,
        ...(first ? { selected: ui.selectedSource } : {})
      })
    },
    updateProlink: (patch) => {
      set({ prolink: { ...get().prolink, ...patch } })
      save()
    },
    updateDashboard: (patch) => {
      set({ dashboard: { ...get().dashboard, ...patch } })
      save()
    },
    updateOptional: (patch) => {
      set({ optional: { ...get().optional, ...patch } })
      save()
    },
    updateUi: (patch) => {
      set({ ui: { ...get().ui, ...patch } })
      save()
    }
  }
})

import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from './hooks'
import { DEFAULT_UI_SETTINGS, type UiSettings } from './ui'
import { DEFAULT_OPTIONAL_SETTINGS, type OptionalSettings } from './usb'

export const PROLINK_MODES = ['auto', 'passive', 'active'] as const
export type ProlinkMode = (typeof PROLINK_MODES)[number]

export const PROLINK_MODE_LABELS: Record<ProlinkMode, string> = {
  auto: 'Auto (active; passive if rekordbox is running)',
  passive: 'Passive (pcap only; the XDJ-XZ sends no deck status this way)',
  active: 'Active (virtual CDJ; works with the XDJ-XZ)'
}

export interface ProlinkConfig {
  mode: ProlinkMode
  /** Network interface name, e.g. `en15`; null lets the app pick an AlphaTheta interface. */
  iface: string | null
  /** Write every captured packet to a JSONL file in the user data folder. */
  packetLog: boolean
}

export const DEFAULT_PROLINK_CONFIG: ProlinkConfig = {
  mode: 'auto',
  iface: null,
  packetLog: false
}

export interface InterfaceInfo {
  name: string
  address: string
  /** Link-local, USB or ARP hints suggesting AlphaTheta hardware is on this interface. */
  hint?: string
  /** True when alphatheta-connect's detection matched hardware on this interface. */
  alphaTheta: boolean
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  /** Devices heard during the test window. */
  devices: string[]
}

/** Everything persisted between runs. */
export interface AppSettings {
  prolink: ProlinkConfig
  dashboard: DashboardSettings
  optional: OptionalSettings
  ui: UiSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  prolink: DEFAULT_PROLINK_CONFIG,
  dashboard: DEFAULT_DASHBOARD_SETTINGS,
  optional: DEFAULT_OPTIONAL_SETTINGS,
  ui: DEFAULT_UI_SETTINGS
}

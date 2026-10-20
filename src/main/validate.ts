import { PROLINK_MODES, type AppSettings, type ProlinkConfig } from '@shared/prolink'
import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings, type HookRequest } from '@shared/hooks'
import type { StartSourceRequest } from '@shared/ipc'
import { SCENARIOS, type SimulatorConfig } from '@shared/simulator'
import type { SourceId } from '@shared/types'
import { parseOptionalSettings } from './validateOptional'
import { parseReplayConfig, parseUiSettings } from './validateUi'

const SOURCE_IDS: readonly SourceId[] = ['simulator', 'prolink', 'usbc', 'audio', 'replay']
const INTERFACE_NAME = /^[\w .:{}\\-]{1,128}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function parseSimulatorConfig(value: unknown): SimulatorConfig {
  if (!isRecord(value)) throw new Error('Invalid simulator config')
  const { seed, scenario } = value
  if (typeof seed !== 'number' || !Number.isInteger(seed)) throw new Error('Invalid seed')
  if (typeof scenario !== 'string' || !SCENARIOS.some((s) => s === scenario)) {
    throw new Error('Invalid scenario')
  }
  return { seed, scenario: scenario as SimulatorConfig['scenario'] }
}

export function parseInterfaceName(value: unknown): string {
  if (typeof value !== 'string' || !INTERFACE_NAME.test(value))
    throw new Error('Invalid interface name')
  return value
}

export function parseProlinkConfig(value: unknown): ProlinkConfig {
  if (!isRecord(value)) throw new Error('Invalid prolink config')
  const { mode, iface, packetLog } = value
  const parsedMode = PROLINK_MODES.find((m) => m === mode)
  if (!parsedMode) throw new Error('Invalid prolink mode')
  if (typeof packetLog !== 'boolean') throw new Error('Invalid packetLog flag')
  return {
    mode: parsedMode,
    iface: iface === null || iface === undefined ? null : parseInterfaceName(iface),
    packetLog
  }
}

export function parseSettings(value: unknown): AppSettings {
  if (!isRecord(value)) throw new Error('Invalid settings')
  return {
    prolink: parseProlinkConfig(value.prolink),
    dashboard: parseDashboard(value.dashboard),
    optional: parseOptionalSettings(value.optional),
    ui: parseUiSettings(value.ui)
  }
}

export function parseHookPort(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error('Port must be an integer between 1024 and 65535')
  }
  return value
}

export function parseDashboard(value: unknown): DashboardSettings {
  if (value === undefined) return DEFAULT_DASHBOARD_SETTINGS
  if (!isRecord(value)) throw new Error('Invalid dashboard settings')
  const { showAllDecks, reduceMotion, hookPort } = value
  return {
    showAllDecks: parseBoolean(showAllDecks),
    reduceMotion: parseBoolean(reduceMotion),
    hookPort: parseHookPort(hookPort)
  }
}

export function parseHookRequest(value: unknown): HookRequest {
  if (!isRecord(value)) throw new Error('Invalid hook request')
  return { enabled: parseBoolean(value.enabled), port: parseHookPort(value.port) }
}

export function parseStartRequest(value: unknown): StartSourceRequest {
  if (!isRecord(value)) throw new Error('Invalid start request')
  if (value.source === 'simulator') {
    return { source: 'simulator', config: parseSimulatorConfig(value.config) }
  }
  if (value.source === 'prolink') {
    return { source: 'prolink', config: parseProlinkConfig(value.config) }
  }
  if (value.source === 'replay') {
    return { source: 'replay', config: parseReplayConfig(value.config) }
  }
  throw new Error('Unknown source')
}

export function parseSourceId(value: unknown): SourceId {
  const id = SOURCE_IDS.find((s) => s === value)
  if (!id) throw new Error('Unknown source')
  return id
}

export function parseBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Expected a boolean')
  return value
}

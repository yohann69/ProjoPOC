import { isAbsolute } from 'node:path'
import type { RendererErrorReport } from '@shared/diagnostics'
import type { ReplayConfig } from '@shared/recording'
import { DEFAULT_UI_SETTINGS, SIDE_TAB_IDS, type UiSettings } from '@shared/ui'

const SELECTED_SOURCES: readonly UiSettings['selectedSource'][] = ['simulator', 'prolink', 'replay']
const MAX_PATH = 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Old settings files have no `ui` block, and unknown values fall back to the defaults. */
export function parseUiSettings(value: unknown): UiSettings {
  if (value === undefined) return DEFAULT_UI_SETTINGS
  if (!isRecord(value)) throw new Error('Invalid UI settings')
  const source = SELECTED_SOURCES.find((s) => s === value.selectedSource)
  const tab = SIDE_TAB_IDS.find((t) => t === value.sideTab)
  return {
    selectedSource: source ?? DEFAULT_UI_SETTINGS.selectedSource,
    sideTab: tab ?? DEFAULT_UI_SETTINGS.sideTab,
    checklistDismissed: value.checklistDismissed === true
  }
}

export function parseReplayConfig(value: unknown): ReplayConfig {
  if (!isRecord(value)) throw new Error('Invalid replay config')
  const { path, loop } = value
  if (typeof path !== 'string' || path.length > MAX_PATH || !isAbsolute(path)) {
    throw new Error('Replay path must be an absolute file path')
  }
  if (!path.endsWith('.jsonl')) throw new Error('Replay file must be a .jsonl recording')
  if (typeof loop !== 'boolean') throw new Error('Expected a boolean')
  return { path, loop }
}

const clip = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined

export function parseRendererError(value: unknown): RendererErrorReport {
  if (!isRecord(value)) throw new Error('Invalid error report')
  const report: RendererErrorReport = { message: clip(value.message, 2000) ?? 'unknown error' }
  const stack = clip(value.stack, 8000)
  const componentStack = clip(value.componentStack, 4000)
  if (stack) report.stack = stack
  if (componentStack) report.componentStack = componentStack
  return report
}

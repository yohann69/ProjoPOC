import { DEFAULT_SETTINGS, type AppSettings } from '@shared/prolink'
import { parseDashboard, parseProlinkConfig, parseSettings } from './validate'
import { parseOptionalSettings } from './validateOptional'
import { parseUiSettings } from './validateUi'

/** The part of an electron-store instance the settings need. */
export interface KeyValueStore {
  readonly store: Record<string, unknown>
  set(key: string, value: unknown): void
}

function orDefault<T>(parse: () => T, fallback: T): T {
  try {
    return parse()
  } catch {
    return fallback
  }
}

/** Settings kept in an electron-store file; each section falls back to its defaults on its own. */
export class SettingsStore {
  constructor(private readonly backend: KeyValueStore) {}

  load(): AppSettings {
    const raw = this.backend.store
    return {
      prolink: orDefault(() => parseProlinkConfig(raw.prolink), DEFAULT_SETTINGS.prolink),
      dashboard: orDefault(() => parseDashboard(raw.dashboard), DEFAULT_SETTINGS.dashboard),
      optional: orDefault(() => parseOptionalSettings(raw.optional), DEFAULT_SETTINGS.optional),
      ui: orDefault(() => parseUiSettings(raw.ui), DEFAULT_SETTINGS.ui)
    }
  }

  /** Other keys in the same file, such as the window bounds, are left alone. */
  save(settings: AppSettings): void {
    const valid = parseSettings(settings)
    this.backend.set('prolink', valid.prolink)
    this.backend.set('dashboard', valid.dashboard)
    this.backend.set('optional', valid.optional)
    this.backend.set('ui', valid.ui)
  }
}

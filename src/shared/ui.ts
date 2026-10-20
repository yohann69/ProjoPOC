/** Window-independent interface preferences that survive restarts. */
export interface UiSettings {
  /** Source tab chosen in the top bar. */
  selectedSource: 'simulator' | 'prolink' | 'replay'
  /** Id of the open side-panel tab. */
  sideTab: string
  /** The first-run checklist was dismissed. */
  checklistDismissed: boolean
}

export const SIDE_TAB_IDS = [
  'overview',
  'usbc',
  'audio',
  'events',
  'hooks',
  'packets',
  'devices',
  'diagnostics'
] as const

export const DEFAULT_UI_SETTINGS: UiSettings = {
  selectedSource: 'simulator',
  sideTab: 'overview',
  checklistDismissed: false
}

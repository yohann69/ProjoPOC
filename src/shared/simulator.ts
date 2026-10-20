export const SCENARIOS = ['single', 'mixing2', 'chaos4'] as const
export type Scenario = (typeof SCENARIOS)[number]

export const SCENARIO_LABELS: Record<Scenario, string> = {
  single: 'Single deck',
  mixing2: 'Mixing 2 decks',
  chaos4: '4-deck chaos'
}

export const SCENARIO_DECK_COUNT: Record<Scenario, 1 | 2 | 4> = {
  single: 1,
  mixing2: 2,
  chaos4: 4
}

export interface SimulatorConfig {
  seed: number
  scenario: Scenario
}

export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = { seed: 1, scenario: 'mixing2' }

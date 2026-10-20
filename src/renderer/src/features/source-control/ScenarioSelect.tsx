import { SCENARIOS, SCENARIO_LABELS, type Scenario } from '@shared/simulator'

interface Props {
  value: Scenario
  onChange: (scenario: Scenario) => void
}

export function ScenarioSelect({ value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      Scenario
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Scenario)}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
      >
        {SCENARIOS.map((scenario) => (
          <option key={scenario} value={scenario}>
            {SCENARIO_LABELS[scenario]}
          </option>
        ))}
      </select>
    </label>
  )
}

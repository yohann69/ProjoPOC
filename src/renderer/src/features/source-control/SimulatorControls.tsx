import { useSettingsStore } from '../../store/useSettingsStore'
import { ScenarioSelect } from './ScenarioSelect'

export function SimulatorControls() {
  const { seed, scenario } = useSettingsStore((s) => s.simulator)
  const update = useSettingsStore((s) => s.updateSimulator)
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ScenarioSelect value={scenario} onChange={(next) => update({ scenario: next })} />
      <label className="flex items-center gap-2 text-sm text-slate-300">
        Seed
        <input
          type="number"
          step={1}
          value={seed}
          onChange={(e) => update({ seed: Math.trunc(Number(e.target.value)) })}
          className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
        />
      </label>
    </div>
  )
}

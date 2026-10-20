import { useSettingsStore } from '../../store/useSettingsStore'
import type { UiSettings } from '@shared/ui'

const OPTIONS: { id: UiSettings['selectedSource']; label: string }[] = [
  { id: 'simulator', label: 'Simulator' },
  { id: 'prolink', label: 'XDJ (Pro DJ Link)' },
  { id: 'replay', label: 'Replay' }
]

export function SourceTabs() {
  const selected = useSettingsStore((s) => s.selected)
  const select = useSettingsStore((s) => s.select)
  return (
    <div className="flex overflow-hidden rounded border border-slate-700">
      {OPTIONS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => select(id)}
          className={`px-3 py-1 text-sm ${
            selected === id ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

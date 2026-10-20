import { useLiveStore } from '../../store/useLiveStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { resetDashboard } from '../../live/resetDashboard'

/** Starts the simulator with a mixing scenario so the dashboard can be reviewed without hardware. */
export function DemoButton() {
  const select = useSettingsStore((s) => s.select)
  const update = useSettingsStore((s) => s.updateSimulator)
  const start = (): void => {
    select('simulator')
    update({ scenario: 'mixing2', seed: 1 })
    resetDashboard()
    useLiveStore.setState({ source: 'simulator' })
    void window.deckpulse.startSource({
      source: 'simulator',
      config: { seed: 1, scenario: 'mixing2' }
    })
  }
  return (
    <button
      type="button"
      onClick={start}
      className="rounded-lg bg-amber-400 px-4 py-2 text-base font-bold text-slate-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white"
    >
      Start demo mode (simulated data)
    </button>
  )
}

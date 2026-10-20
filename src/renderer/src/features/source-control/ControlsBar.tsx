import { useState } from 'react'
import { resetDashboard } from '../../live/resetDashboard'
import { useLiveStore } from '../../store/useLiveStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { ReplayPicker } from './ReplayPicker'

const buttonClass =
  'rounded-md px-3 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40'

const IDLE_STATES = ['stopped', 'permissionDenied', 'rekordboxConflict', 'error']

/** Start / Stop for the selected source. */
export function ControlsBar() {
  const selected = useSettingsStore((s) => s.selected)
  const simulator = useSettingsStore((s) => s.simulator)
  const prolink = useSettingsStore((s) => s.prolink)
  const replay = useSettingsStore((s) => s.replay)
  const sourceState = useLiveStore((s) => s.sourceState)
  const [error, setError] = useState<string | null>(null)
  const running = !IDLE_STATES.includes(sourceState)

  const start = (): void => {
    setError(null)
    if (selected === 'replay' && !replay.path) {
      setError('Choose a recording first.')
      return
    }
    resetDashboard()
    const request =
      selected === 'simulator'
        ? ({ source: 'simulator', config: simulator } as const)
        : selected === 'replay'
          ? ({ source: 'replay', config: replay } as const)
          : ({ source: 'prolink', config: prolink } as const)
    window.deckpulse.startSource(request).catch((e: unknown) => setError(String(e)))
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={start}
        className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-500`}
      >
        {running ? 'Restart' : 'Start'}
      </button>
      <button
        type="button"
        disabled={!running}
        onClick={() => void window.deckpulse.stopSource(useLiveStore.getState().source ?? selected)}
        className={`${buttonClass} bg-slate-700 text-white hover:bg-slate-600`}
      >
        Stop
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
      {selected === 'replay' && <ReplayPicker />}
    </div>
  )
}

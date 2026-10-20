import { useAudioStore } from '../../store/useAudioStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { NotAvailable, Waiting } from '../../ui/primitives'
import { allowAudioAccess, startAudio, stopAudio } from './audioEngine'

const button =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-white outline-none'

const MISSING = {
  idle: 'Audio analysis is off. No audio-derived events are published.',
  denied: 'N/A: audio input was refused.',
  noDevice: 'N/A: no audio input is available.',
  error: 'N/A: audio analysis could not start.'
} as const

/** Chooses the input device and starts or stops analysis; failures name what is missing. */
export function AudioControls() {
  const status = useAudioStore((s) => s.status)
  const message = useAudioStore((s) => s.message)
  const devices = useAudioStore((s) => s.devices)
  const labelsVisible = useAudioStore((s) => s.labelsVisible)
  const selected = useAudioStore((s) => s.selectedId)
  const saved = useSettingsStore((s) => s.optional.audioDeviceId)
  const choice = selected ?? saved ?? ''
  const running = status === 'running'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Input
          <select
            value={devices.some((d) => d.id === choice) ? choice : ''}
            onChange={(e) => useAudioStore.getState().select(e.target.value || null)}
            disabled={running}
            className="max-w-56 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          >
            <option value="">System default</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <button type="button" onClick={stopAudio} className={button}>
            Stop analysis
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startAudio(useAudioStore.getState().selectedId ?? (saved || null))}
            className={button}
          >
            Start analysis
          </button>
        )}
        {!labelsVisible && !running && (
          <button type="button" onClick={() => void allowAudioAccess()} className={button}>
            Allow input to show names
          </button>
        )}
      </div>
      {status === 'requesting' && <Waiting text="waiting for audio permission" />}
      {status !== 'running' && status !== 'requesting' && (
        <NotAvailable text={message ? `${MISSING[status]} ${message}` : MISSING[status]} />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useLiveStore } from '../../store/useLiveStore'

/** Records raw and normalized events to a JSONL file for later replay. */
export function RecordButton() {
  const replaying = useLiveStore((s) => s.source === 'replay')
  const [path, setPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recording = path !== null
  // The main process closes the file when a replay starts.
  useEffect(() => {
    if (replaying) setPath(null)
  }, [replaying])

  const toggle = (): void => {
    setError(null)
    window.deckpulse
      .setRecording(!recording)
      .then(setPath)
      .catch((e: unknown) => setError(String(e)))
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={replaying}
        aria-pressed={recording}
        title={replaying ? 'Recording is off while a recording is replayed' : undefined}
        className={`rounded-md border px-3 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40 ${
          recording
            ? 'border-red-400 bg-red-700 text-white hover:bg-red-600'
            : 'border-slate-600 text-slate-100 hover:bg-slate-800'
        }`}
      >
        {recording ? '\u25cf Stop recording' : 'Record'}
      </button>
      {recording && path && (
        <span className="max-w-56 truncate text-xs text-slate-300" title={path}>
          {path}
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

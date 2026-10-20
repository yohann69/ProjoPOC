import { useMidiStore } from '../../store/useMidiStore'

const hex = (bytes: number[]): string =>
  bytes
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ') + (bytes.length > 12 ? ' …' : '')

/** Live list of incoming messages: raw bytes plus the decoded guess. */
export function MidiStream() {
  const stream = useMidiStore((s) => s.stream)
  const paused = useMidiStore((s) => s.paused)
  const ignore = useMidiStore((s) => s.ignoreRealtime)
  const hidden = useMidiStore((s) => s.hiddenRealtime)
  const total = useMidiStore((s) => s.total)
  const store = useMidiStore.getState()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="tabular-nums">{total} messages</span>
        <button
          type="button"
          onClick={() => store.setPaused(!paused)}
          aria-pressed={paused}
          className="rounded border border-slate-600 px-2 py-0.5 hover:bg-slate-800"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={store.clear}
          className="rounded border border-slate-600 px-2 py-0.5 hover:bg-slate-800"
        >
          Clear
        </button>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={ignore}
            onChange={(e) => store.setIgnoreRealtime(e.target.checked)}
          />
          Hide clock and active sensing
        </label>
      </div>
      {ignore && hidden > 0 && (
        <p className="text-xs text-slate-400">
          {hidden} clock/active-sensing messages hidden (still counted).
        </p>
      )}
      {stream.length === 0 ? (
        <p className="text-sm text-slate-400">No messages yet. Move a control on the unit.</p>
      ) : (
        <ol className="max-h-56 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-1 font-mono text-xs">
          {stream.map((row) => (
            <li key={row.id} className="flex gap-2 whitespace-nowrap">
              <span className="w-28 shrink-0 text-sky-300">{hex(row.bytes)}</span>
              <span className="truncate text-slate-200">{row.message.guess}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

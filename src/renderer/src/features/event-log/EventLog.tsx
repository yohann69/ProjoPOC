import { useEventStore } from '../../store/useEventStore'
import { EventRow } from './EventRow'
import { TypeFilter } from './TypeFilter'

export function EventLog() {
  const log = useEventStore((s) => s.log)
  const paused = useEventStore((s) => s.paused)
  const togglePause = useEventStore((s) => s.togglePause)
  const clear = useEventStore((s) => s.clear)
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3" aria-label="Event log">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TypeFilter />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={togglePause}
            aria-pressed={paused}
            className="rounded border border-slate-500 px-3 py-1 text-xs font-semibold text-slate-100 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-white"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded border border-slate-500 px-3 py-1 text-xs font-semibold text-slate-100 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-white"
          >
            Clear
          </button>
        </div>
      </div>
      {paused && <p className="text-xs text-amber-300">Paused: new events are not recorded.</p>}
      <ul className="min-h-0 flex-1 overflow-y-auto rounded border border-slate-800 bg-slate-950">
        {log.map((entry) => (
          <EventRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  )
}

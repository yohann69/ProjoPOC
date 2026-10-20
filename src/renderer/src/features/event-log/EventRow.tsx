import { memo } from 'react'
import type { LoggedEvent } from '../../store/useEventStore'
import { OriginBadge } from '../../ui/OriginBadge'
import { summarize } from './summarize'

const formatTime = (ms: number): string => {
  const d = new Date(ms)
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

export const EventRow = memo(function EventRow({ entry }: { entry: LoggedEvent }) {
  const { detail, origins } = summarize(entry.event)
  return (
    <li className="flex items-baseline gap-3 border-b border-white/5 px-3 py-1 font-mono text-xs">
      <span className="shrink-0 text-slate-400">{formatTime(entry.receivedAt)}</span>
      <span className="w-24 shrink-0 text-slate-200">{entry.event.type}</span>
      <span className="flex w-28 shrink-0 gap-1">
        {origins.map((origin) => (
          <OriginBadge key={origin} origin={origin} ts={entry.receivedAt} />
        ))}
      </span>
      <span className="truncate text-slate-50">{detail}</span>
    </li>
  )
})

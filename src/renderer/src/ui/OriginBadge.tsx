import type { Origin } from '@shared/types'
import { useEffect, useId, useState } from 'react'
import { epochNow } from '../lib/frameLoop'
import { ageMs } from '../lib/freshness'
import { formatAge } from '../lib/format'
import { ORIGIN_INFO } from './originInfo'
import { OriginIcon } from './OriginIcon'

interface Props {
  origin: Origin
  /** Key in the freshness registry; the tooltip shows `updated N ms ago` for it. */
  stampKey?: string
  /** Fixed timestamp to age instead (for values that are not tracked in the registry). */
  ts?: number
}

export function OriginBadge({ origin, stampKey, ts }: Props) {
  const info = ORIGIN_INFO[origin]
  const [open, setOpen] = useState(false)
  const [age, setAge] = useState<number | null>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return
    const read = (): void => {
      if (stampKey) setAge(ageMs(stampKey))
      else setAge(ts === undefined ? null : Math.max(0, epochNow() - ts))
    }
    read()
    const timer = setInterval(read, 100)
    return () => clearInterval(timer)
  }, [open, stampKey, ts])

  return (
    <span className="relative inline-flex">
      <span
        tabIndex={0}
        role="note"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`${info.label}: ${info.description}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-white ${info.classes}`}
      >
        <OriginIcon origin={origin} />
        {info.label}
      </span>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 w-max max-w-64 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs font-normal normal-case tracking-normal text-slate-100 shadow-lg"
        >
          {info.description}
          {age !== null && (
            <span className="block text-slate-300">updated {formatAge(age)} ago</span>
          )}
        </span>
      )}
    </span>
  )
}

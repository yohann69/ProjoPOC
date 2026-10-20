import type { ReactNode } from 'react'
import { formatAge } from '../../lib/format'
import type { Row } from './formatters'

const FLASH_MS = 1200

/** A titled list of label/value pairs; values that changed in the last moment are highlighted. */
export function InfoGroup({
  title,
  rows,
  changedAt,
  now
}: {
  title: string
  rows: Row[]
  changedAt: Record<string, number>
  now: number
}) {
  if (rows.length === 0) return null
  return (
    <div className="min-w-0">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-0.5 text-sm">
        {rows.map((r) => {
          const fresh = now - (changedAt[r.key] ?? 0) < FLASH_MS
          return (
            <div key={r.key} className="contents">
              <dt className="text-slate-400">{r.label}</dt>
              <dd
                className={`min-w-0 break-words tabular-nums ${
                  fresh ? 'rounded bg-amber-500/25 px-1 text-amber-50' : 'text-slate-50'
                }`}
              >
                {r.text}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

export function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        on
          ? 'border-emerald-400 bg-emerald-950 text-emerald-200'
          : 'border-slate-700 text-slate-500'
      }`}
    >
      {label}
    </span>
  )
}

/** Card with a title and the age of its newest update. */
export function InfoCard({
  title,
  updatedAt,
  now,
  children
}: {
  title: string
  updatedAt: number
  now: number
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-50">
        <span className="truncate">{title}</span>
        <span className="shrink-0 text-xs font-normal text-slate-400">
          updated {formatAge(now - updatedAt)} ago
        </span>
      </h3>
      {children}
    </section>
  )
}

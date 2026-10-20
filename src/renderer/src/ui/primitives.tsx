import { originFor, type CapabilityField } from '@shared/capabilities'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLiveStore } from '../store/useLiveStore'
import { OriginBadge } from './OriginBadge'
import type { Origin } from '@shared/types'

/** True unless the running source is known not to provide the field. */
export function useFieldSupport(field: CapabilityField): boolean {
  const source = useLiveStore((s) => s.source)
  return source === null || originFor([source], field) !== null
}

/** Re-renders the caller every `ms`; for slow panels that read mutable live data. */
export function useTicker(ms: number): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(timer)
  }, [ms])
  return tick
}

/** Muted placeholder for a field the source cannot provide; never a blank or a fake zero. */
export function NotAvailable({ text = 'N/A on this hardware' }: { text?: string }) {
  return <span className="text-sm italic text-slate-400">{text}</span>
}

export function Waiting({ text = 'waiting for data' }: { text?: string }) {
  return <span className="text-sm text-slate-400">{text}…</span>
}

interface LabeledProps {
  label: string
  origin?: Origin
  stampKey?: string
  ts?: number
  className?: string
  children: ReactNode
}

/** A value with its label and origin badge in one consistent layout. */
export function Labeled({ label, origin, stampKey, ts, className = '', children }: LabeledProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
        <span>{label}</span>
        {origin && <OriginBadge origin={origin} stampKey={stampKey} ts={ts} />}
      </div>
      {children}
    </div>
  )
}

export function Panel({
  title,
  badges,
  children,
  className = ''
}: {
  title: string
  badges?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 ${className}`}
    >
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-50">
        {title}
        {badges}
      </h3>
      {children}
    </section>
  )
}

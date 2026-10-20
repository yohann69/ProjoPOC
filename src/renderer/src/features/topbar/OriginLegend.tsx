import { ORIGINS } from '../../ui/originInfo'
import { OriginBadge } from '../../ui/OriginBadge'

export function OriginLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Origin legend">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-300">Legend</span>
      {ORIGINS.map((origin) => (
        <OriginBadge key={origin} origin={origin} />
      ))}
    </div>
  )
}

import { useLiveStore } from '../../store/useLiveStore'
import { PacketLogToggle } from './PacketLogToggle'
import { PortStatsTable } from './PortStatsTable'
import { RecentPackets } from './RecentPackets'

const LEVEL_STYLES = { info: 'text-slate-300', warn: 'text-amber-300', error: 'text-red-400' }

export function InspectorPanel() {
  const logs = useLiveStore((s) => s.logs)
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <PacketLogToggle />
      <PortStatsTable />
      <h3 className="text-xs font-semibold text-slate-400">Observations</h3>
      <ul className="max-h-40 overflow-y-auto rounded border border-white/10 bg-black/30 p-2 font-mono text-xs">
        {logs.map((l) => (
          <li key={l.id} className={LEVEL_STYLES[l.level]}>
            {l.message}
          </li>
        ))}
      </ul>
      <h3 className="text-xs font-semibold text-slate-400">Sampled packets (newest first)</h3>
      <RecentPackets />
    </section>
  )
}

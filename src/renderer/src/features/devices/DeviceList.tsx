import { useLiveStore } from '../../store/useLiveStore'

export function DeviceList() {
  const devices = useLiveStore((s) => s.devices)
  return (
    <section className="flex flex-col gap-2 rounded border border-white/10 p-3">
      <h2 className="text-sm font-semibold text-white">Devices ({devices.length})</h2>
      {devices.length === 0 && <p className="text-xs text-slate-500">No devices seen yet.</p>}
      <ul className="flex flex-col gap-1 text-xs">
        {devices.map((d) => (
          <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 font-mono text-slate-200">
            <span className="text-slate-100">{d.name}</span>
            <span className="text-slate-400">{d.ip ?? 'no ip'}</span>
            <span className="text-slate-400">number {d.deviceNumber ?? '?'}</span>
            <span className="text-slate-400">{d.kind}</span>
            {d.deck && <span className="text-emerald-300">deck {d.deck}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

import { useLiveStore } from '../../store/useLiveStore'

export function PortStatsTable() {
  const ports = useLiveStore((s) => s.ports)
  if (ports.length === 0) return <p className="text-xs text-slate-500">No packets captured yet.</p>
  return (
    <table className="w-full text-left font-mono text-xs">
      <thead className="text-slate-500">
        <tr>
          <th className="pr-4">port</th>
          <th className="pr-4">packets/s</th>
          <th className="pr-4">total</th>
          <th>kinds</th>
        </tr>
      </thead>
      <tbody className="text-slate-200">
        {ports.map((p) => (
          <tr key={p.port} className="align-top">
            <td className="pr-4">{p.port}</td>
            <td className="pr-4">{p.packetsPerSecond}</td>
            <td className="pr-4">{p.total}</td>
            <td className="text-slate-400">
              {Object.entries(p.kinds)
                .map(([kind, count]) => `${kind} ${count}`)
                .join(' · ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

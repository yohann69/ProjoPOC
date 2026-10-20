import { useLiveStore } from '../../store/useLiveStore'

export function RecentPackets() {
  const packets = useLiveStore((s) => s.packets)
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto rounded border border-white/10 bg-black/30">
      {packets.map((p) => (
        <li key={p.id} className="flex gap-3 border-b border-white/5 px-3 py-1 font-mono text-xs">
          <span className="w-12 shrink-0 text-slate-300">{p.port}</span>
          <span className="w-12 shrink-0 text-slate-500">{p.length} B</span>
          <span className="w-28 shrink-0 text-sky-300">{p.kind ?? '?'}</span>
          <span className="truncate text-slate-400">{p.hexPreview}</span>
        </li>
      ))}
    </ul>
  )
}

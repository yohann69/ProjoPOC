import { useState } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'

export function PacketLogToggle() {
  const enabled = useSettingsStore((s) => s.prolink.packetLog)
  const update = useSettingsStore((s) => s.updateProlink)
  const [path, setPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = (next: boolean): void => {
    update({ packetLog: next })
    setError(null)
    window.deckpulse
      .setPacketLog(next)
      .then(setPath)
      .catch((e: unknown) => setError(String(e)))
  }

  return (
    <div className="flex flex-col gap-1 text-sm text-slate-300">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        Write every packet to a JSONL file
      </label>
      {enabled && path && <p className="break-all text-xs text-slate-400">{path}</p>}
      {enabled && !path && (
        <p className="text-xs text-slate-500">The file is created when the prolink source runs.</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

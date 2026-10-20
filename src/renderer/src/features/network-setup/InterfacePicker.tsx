import type { InterfaceInfo } from '@shared/prolink'
import { useCallback, useEffect, useState } from 'react'

interface Props {
  value: string | null
  onChange: (iface: string | null) => void
}

export function InterfacePicker({ value, onChange }: Props) {
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    window.deckpulse
      .listInterfaces()
      .then((list) => {
        setInterfaces(list)
        setError(null)
      })
      .catch((e: unknown) => setError(String(e)))
  }, [])

  useEffect(refresh, [refresh])

  const known = value === null || interfaces.some((i) => i.name === value)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Interface
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="max-w-xs rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          >
            <option value="">Auto-detect AlphaTheta interface</option>
            {!known && <option value={value}>{value} (not currently available)</option>}
            {interfaces.map((i) => (
              <option key={`${i.name}-${i.address}`} value={i.name}>
                {i.name} — {i.address}
                {i.hint ? ` — ${i.hint}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

import type { ConnectionTestResult } from '@shared/prolink'
import { useState } from 'react'

export function ConnectionTest({ iface }: { iface: string | null }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ConnectionTestResult | null>(null)

  const run = (): void => {
    if (!iface) return
    setTesting(true)
    setResult(null)
    window.deckpulse
      .testConnection(iface)
      .then(setResult)
      .catch((e: unknown) => setResult({ ok: false, message: String(e), devices: [] }))
      .finally(() => setTesting(false))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!iface || testing}
          onClick={run}
          className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testing ? 'Listening…' : 'Test connection'}
        </button>
        {!iface && <span className="text-xs text-slate-500">Pick an interface to test it.</span>}
      </div>
      {result && (
        <div className={`text-xs ${result.ok ? 'text-emerald-300' : 'text-red-400'}`}>
          <p>{result.message}</p>
          {result.devices.map((d) => (
            <p key={d} className="text-slate-300">
              {d}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

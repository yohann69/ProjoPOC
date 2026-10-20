import { DEFAULT_HOOK_PORT, type HookEvent, type HookEventType } from '@shared/hooks'
import { useState } from 'react'
import { useHookStore } from '../../store/useHookStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { OriginBadge } from '../../ui/OriginBadge'
import { Panel } from '../../ui/primitives'

const TYPES: HookEventType[] = [
  'beat',
  'phraseChange',
  'transition',
  'bpmChange',
  'energy',
  'onset',
  'drop'
]

const EXAMPLE = `const ws = new WebSocket('ws://127.0.0.1:${DEFAULT_HOOK_PORT}')
ws.onmessage = (e) => {
  const hook = JSON.parse(e.data) // { type, deck, ts, origin, source, simulated, ... }
}`

function BroadcastControls() {
  const server = useHookStore((s) => s.server)
  const port = useSettingsStore((s) => s.dashboard.hookPort)
  const update = useSettingsStore((s) => s.updateDashboard)
  const [error, setError] = useState<string | null>(null)

  const toggle = (): void => {
    setError(null)
    window.deckpulse
      .setHookBroadcast({ enabled: !server.listening, port })
      .then((status) => setError(status.error ?? null))
      .catch((e: unknown) => setError(String(e)))
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-100">
          Port
          <input
            type="number"
            min={1024}
            max={65535}
            value={port}
            disabled={server.listening}
            onChange={(e) => update({ hookPort: Math.trunc(Number(e.target.value)) })}
            className="w-24 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-slate-50 disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={server.listening}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${
            server.listening
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {server.listening ? 'Stop broadcasting' : 'Broadcast over WebSocket'}
        </button>
      </div>
      <p className="text-sm text-slate-100" role="status">
        {server.listening
          ? `Listening on ws://127.0.0.1:${server.port} \u2014 ${server.clients} client(s)`
          : 'Not broadcasting (loopback only when enabled).'}
      </p>
      {(error ?? server.error) && <p className="text-sm text-red-400">{error ?? server.error}</p>}
    </div>
  )
}

function HookRow({ hook }: { hook: HookEvent }) {
  return (
    <li className="border-b border-slate-800 px-2 py-1 font-mono text-xs break-all text-slate-100">
      {JSON.stringify(hook)}
    </li>
  )
}

export function HooksPanel() {
  const recent = useHookStore((s) => s.recent)
  const [hidden, setHidden] = useState<HookEventType[]>(['beat', 'energy'])
  const shown = recent.filter((h) => !hidden.includes(h.type))
  return (
    <Panel title="Visual hooks" badges={<OriginBadge origin="DERIVED" />}>
      <p className="text-xs text-slate-300">
        Exact normalized events a visuals engine would subscribe to. Each carries origin, source and
        a simulated flag.
      </p>
      <BroadcastControls />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show hook event types">
        {TYPES.map((type) => {
          const on = !hidden.includes(type)
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => setHidden(on ? [...hidden, type] : hidden.filter((t) => t !== type))}
              className={`rounded-full border px-3 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${
                on ? 'border-slate-300 bg-slate-700 text-white' : 'border-slate-700 text-slate-300'
              }`}
            >
              {type}
            </button>
          )
        })}
      </div>
      <ul className="max-h-80 overflow-y-auto rounded border border-slate-800 bg-slate-950">
        {shown.length === 0 && <li className="p-2 text-sm text-slate-300">No hook events yet.</li>}
        {shown.map((hook, i) => (
          <HookRow key={`${hook.ts}-${hook.type}-${i}`} hook={hook} />
        ))}
      </ul>
      <pre className="overflow-x-auto rounded bg-slate-950 p-2 text-xs text-slate-200">
        {EXAMPLE}
      </pre>
    </Panel>
  )
}

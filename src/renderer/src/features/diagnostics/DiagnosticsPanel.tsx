import type { ReactNode } from 'react'
import { useState } from 'react'
import { useLiveStore } from '../../store/useLiveStore'
import { OriginBadge } from '../../ui/OriginBadge'
import { NotAvailable, Panel } from '../../ui/primitives'
import { ChecklistList } from './ChecklistList'
import { formatDiagnostics } from './formatDiagnostics'
import { useChecklist, useDiagnostics, useLiveSnapshot } from './useDiagnostics'

const button =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-white outline-none'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-36 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-slate-100">{children}</dd>
    </div>
  )
}

function Traffic() {
  const ports = useLiveStore((s) => s.ports)
  const devices = useLiveStore((s) => s.devices)
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        Devices seen ({devices.length})
      </h4>
      {devices.length === 0 ? (
        <NotAvailable text="No devices heard." />
      ) : (
        <ul className="text-sm text-slate-100">
          {devices.map((d) => (
            <li key={d.id}>
              {d.name} ({d.kind}
              {d.deck ? `, deck ${d.deck}` : ''}){d.ip ? ` ${d.ip}` : ''}
            </li>
          ))}
        </ul>
      )}
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        Packets per port
      </h4>
      {ports.length === 0 ? (
        <NotAvailable text="No packets counted (only the Ethernet source reports ports)." />
      ) : (
        <ul className="text-sm tabular-nums text-slate-100">
          {ports.map((p) => (
            <li key={p.port}>
              {p.port}: {p.total} total, {p.packetsPerSecond}/s
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** System, pcap, connection and error details, with a button that copies them as text. */
export function DiagnosticsPanel() {
  const { info, error, refresh } = useDiagnostics()
  const live = useLiveSnapshot()
  const checks = useChecklist(info)
  const [note, setNote] = useState<string | null>(null)

  const copy = (): void => {
    if (!info) return
    navigator.clipboard
      .writeText(formatDiagnostics(info, live, checks))
      .then(() => setNote('Diagnostics copied.'))
      .catch(() => setNote('Copy was refused by the system.'))
  }

  return (
    <div className="flex flex-col gap-3">
      <Panel title="First-run checklist" badges={<OriginBadge origin="DERIVED" />}>
        <ChecklistList items={checks} />
      </Panel>
      <Panel title="Diagnostics">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={refresh} className={button}>
            Refresh
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={!info}
            className={`${button} disabled:opacity-40`}
          >
            Copy diagnostics
          </button>
          {note && <span className="text-xs text-slate-300">{note}</span>}
        </div>
        {error && <p className="text-sm text-red-400">Could not read diagnostics: {error}</p>}
        {info && (
          <dl className="flex flex-col gap-1">
            <Row label="App">
              {info.app.name} {info.app.version}
            </Row>
            <Row label="OS">
              {info.app.platform} {info.app.arch} ({info.app.osRelease})
            </Row>
            <Row label="Electron / Node">
              {info.app.electron} / {info.app.node}
            </Row>
            <Row label="pcap module">
              {info.pcap.moduleLoaded ? 'loaded' : `not loaded: ${info.pcap.error ?? 'unknown'}`}
              {info.pcap.deviceCount !== null && `, ${info.pcap.deviceCount} capture devices`}
            </Row>
            <Row label="Capture permission">
              {info.pcap.permission}: {info.pcap.permissionDetail}
            </Row>
            <Row label="Mode / interface">
              {live.mode} / {live.iface ?? 'automatic'}
            </Row>
            <Row label="Source">
              {live.source ?? 'none'} {live.sourceState}
              {live.sourceMessage ? `: ${live.sourceMessage}` : ''}
            </Row>
            <Row label="Log file">{info.app.logFile ?? 'unavailable'}</Row>
          </dl>
        )}
        <Traffic />
        {info && (
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Last errors ({info.errors.length})
            </h4>
            {info.errors.length === 0 ? (
              <p className="text-sm text-slate-400">No errors recorded this session.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-1 font-mono text-xs text-slate-200">
                {info.errors
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <li key={`${e.ts}-${i}`} className="break-words">
                      {new Date(e.ts).toLocaleTimeString()} [{e.origin}] {e.message}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}

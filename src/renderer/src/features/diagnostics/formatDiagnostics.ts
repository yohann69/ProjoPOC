import type { DiagnosticsInfo } from '@shared/diagnostics'
import type { ProlinkMode } from '@shared/prolink'
import type { DeckId, DeviceInfo, PortStats, SourceId, SourceState } from '@shared/types'
import type { CheckItem } from './checklist'

export interface LiveSnapshot {
  iface: string | null
  mode: ProlinkMode
  source: SourceId | null
  sourceState: SourceState
  sourceMessage?: string
  devices: DeviceInfo[]
  ports: PortStats[]
  trackStatus: Partial<Record<DeckId, { state: string; message?: string }>>
}

const time = (ts: number): string => new Date(ts).toISOString()

/** Plain-text report for bug reports; contains no track titles or file contents. */
export function formatDiagnostics(
  info: DiagnosticsInfo,
  live: LiveSnapshot,
  checks: CheckItem[]
): string {
  const { app, pcap } = info
  const lines = [
    `DeckPulse ${app.version} diagnostics`,
    `OS: ${app.platform} ${app.arch} (${app.osRelease})`,
    `Electron ${app.electron}, Node ${app.node}, Chrome ${app.chrome}`,
    `User data: ${app.userData}`,
    `Log file: ${app.logFile ?? 'unavailable'}`,
    '',
    'pcap',
    `  module: ${pcap.moduleLoaded ? 'loaded' : `NOT loaded (${pcap.error ?? 'unknown'})`}`,
    `  capture devices: ${pcap.deviceCount ?? 'n/a'}`,
    `  permission: ${pcap.permission} - ${pcap.permissionDetail}`,
    '',
    'Connection',
    `  mode: ${live.mode}`,
    `  selected interface: ${live.iface ?? 'none (automatic)'}`,
    `  source: ${live.source ?? 'none'} ${live.sourceState}${live.sourceMessage ? ` - ${live.sourceMessage}` : ''}`,
    `  rekordbox process: ${info.rekordbox ?? 'not running'}`,
    '  interfaces: ' + (info.interfaces.map((i) => `${i.name} ${i.cidr}`).join(', ') || 'none'),
    '',
    `Devices seen (${live.devices.length})`,
    ...live.devices.map(
      (d) => `  ${d.name} [${d.kind}]${d.deck ? ` deck ${d.deck}` : ''}${d.ip ? ` ${d.ip}` : ''}`
    ),
    '',
    'Packets per port',
    ...(live.ports.length === 0
      ? ['  none']
      : live.ports.map((p) => {
          const kinds = Object.entries(p.kinds)
            .map(([k, n]) => `${k}:${n}`)
            .join(' ')
          return `  ${p.port}: ${p.total} total, ${p.packetsPerSecond}/s ${kinds}`
        })),
    '',
    'Track metadata',
    ...Object.entries(live.trackStatus).map(
      ([deck, s]) => `  deck ${deck}: ${s.state}${s.message ? ` - ${s.message}` : ''}`
    ),
    '',
    'First-run checklist',
    ...checks.map((c) => `  [${c.status}] ${c.title}: ${c.detail}`),
    '',
    `Last errors (${info.errors.length})`,
    ...(info.errors.length === 0
      ? ['  none']
      : info.errors.map((e) => `  ${time(e.ts)} [${e.origin}] ${e.message}`))
  ]
  return lines.join('\n')
}

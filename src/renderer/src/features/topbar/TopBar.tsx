import type { ReactNode } from 'react'
import { formatPacketRate } from '../../lib/format'
import { useLiveStore } from '../../store/useLiveStore'
import { NotAvailable } from '../../ui/primitives'
import { ControlsBar } from '../source-control/ControlsBar'
import { DataButton } from '../data/DataButton'
import { RecordButton } from '../source-control/RecordButton'
import { SourceStatusBadge } from '../source-control/SourceStatusBadge'
import { SourceTabs } from '../source-control/SourceTabs'
import { DemoButton } from './DemoButton'
import { OriginLegend } from './OriginLegend'
import { OptionalStatus } from './OptionalStatus'
import { SettingsDialog } from './SettingsDialog'

const SOURCE_LABELS = {
  simulator: 'Simulator',
  prolink: 'Ethernet Pro DJ Link',
  usbc: 'USB-C',
  audio: 'Audio input',
  replay: 'Replay'
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-300">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums text-slate-50">{children}</span>
    </div>
  )
}

function Stats() {
  const source = useLiveStore((s) => s.source)
  const devices = useLiveStore((s) => s.devices.length)
  const rate = useLiveStore((s) => s.ports.reduce((sum, p) => sum + p.packetsPerSecond, 0))
  return (
    <div className="flex items-center gap-6">
      <Stat label="Source">{source ? SOURCE_LABELS[source] : 'none'}</Stat>
      <Stat label="Devices">{source ? devices : '\u2013'}</Stat>
      <Stat label="Packets/s">
        {source === 'prolink' ? formatPacketRate(rate) : <NotAvailable text="N/A (no packets)" />}
      </Stat>
    </div>
  )
}

export function TopBar() {
  return (
    <header className="flex flex-col gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-xl font-bold text-slate-50">DeckPulse</h1>
        <SourceTabs />
        <ControlsBar />
        <RecordButton />
        <DemoButton />
        <DataButton />
        <SourceStatusBadge />
        <Stats />
        <OptionalStatus />
        <div className="ml-auto">
          <SettingsDialog />
        </div>
      </div>
      <OriginLegend />
    </header>
  )
}

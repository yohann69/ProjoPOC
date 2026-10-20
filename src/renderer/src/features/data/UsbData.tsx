import type { ReactNode } from 'react'
import { formatAge } from '../../lib/format'
import { epochNow } from '../../lib/frameLoop'
import { useMidiStore } from '../../store/useMidiStore'
import { useUsbStore } from '../../store/useUsbStore'
import { useTicker } from '../../ui/primitives'
import { MidiPortPicker } from '../midi/MidiPortPicker'
import { MidiStream } from '../midi/MidiStream'
import { XzMixerPanel } from '../midi/xz/XzMixerPanel'
import { SysexList, UsbControlsTable } from './UsbControlsTable'

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold text-slate-50">{title}</h2>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </section>
  )
}

function PortsTable() {
  useTicker(500)
  const inputs = useMidiStore((s) => s.inputs)
  const listening = useMidiStore((s) => s.listening)
  const stats = useUsbStore((s) => s.usb.ports)
  const now = epochNow()
  if (inputs.length === 0) {
    return <p className="text-sm text-slate-400">The system lists no MIDI input.</p>
  }
  return (
    <table className="w-full text-left font-mono text-xs">
      <thead className="text-slate-400">
        <tr>
          <th className="pr-4">port</th>
          <th className="pr-4">maker</th>
          <th className="pr-4">state</th>
          <th className="pr-4">messages</th>
          <th className="pr-4">per s</th>
          <th className="pr-4">last</th>
          <th>by type</th>
        </tr>
      </thead>
      <tbody className="align-top text-slate-200">
        {inputs.map((i) => {
          const s = stats[i.name]
          return (
            <tr key={i.id} className="border-t border-slate-800">
              <td className="pr-4">{i.name}</td>
              <td className="pr-4 text-slate-400">{i.manufacturer || '\u2013'}</td>
              <td className="pr-4">
                {i.connected ? (listening.includes(i.name) ? 'listening' : 'connected') : 'gone'}
              </td>
              <td className="pr-4 tabular-nums">{s?.total ?? 0}</td>
              <td className="pr-4 tabular-nums">{s && now - s.lastTs < 2000 ? s.rate : 0}</td>
              <td className="pr-4 text-slate-400">{s ? formatAge(now - s.lastTs) : '\u2013'}</td>
              <td className="text-slate-400">
                {Object.entries(s?.byKind ?? {})
                  .map(([kind, n]) => `${kind} ${n}`)
                  .join(' \u00b7 ')}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Everything the USB-C MIDI ports send: per-port counts, every control, SysEx and the raw stream. */
export function UsbData() {
  const status = useMidiStore((s) => s.status)
  const clear = useUsbStore((s) => s.clear)
  return (
    <div className="flex flex-col gap-6">
      {status !== 'ready' && <MidiPortPicker />}
      <XzMixerPanel />
      <Section
        title="MIDI ports"
        hint="Every connected MIDI input is read. Counts include clock and active-sensing messages."
      >
        <PortsTable />
        <button
          type="button"
          onClick={clear}
          className="w-fit rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-800"
        >
          Reset counters
        </button>
      </Section>
      <Section
        title="Controls"
        hint="One row per port and control, from the standard MIDI reading of the bytes. Names appear only where the unit's MIDI list is known (XDJ-XZ mixer) or you labelled them in the explorer."
      >
        <UsbControlsTable />
      </Section>
      <details className="rounded-lg border border-slate-800 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">
          Advanced: SysEx messages and raw MIDI stream
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <SysexList />
          <MidiStream />
        </div>
      </details>
    </div>
  )
}

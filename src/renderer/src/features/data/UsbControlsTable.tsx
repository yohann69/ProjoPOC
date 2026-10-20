import { useState } from 'react'
import { formatAge } from '../../lib/format'
import { epochNow } from '../../lib/frameLoop'
import { profileFor, xzControlOf } from '../../lib/xzMap'
import type { UsbControl } from '../../lib/usbStats'
import { useMappingStore } from '../../store/useMappingStore'
import { useUsbStore } from '../../store/useUsbStore'
import { useTicker } from '../../ui/primitives'

const RECENT_MS = 1000

const hex = (bytes: number[]): string =>
  bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')

const KIND_LABEL: Record<string, string> = {
  cc: 'CC',
  noteOn: 'note on',
  noteOff: 'note off',
  pitchBend: 'pitch bend',
  polyAftertouch: 'key pressure',
  channelAftertouch: 'channel pressure',
  programChange: 'program'
}

/** The XDJ-XZ's documented mixer controls by name; anything else has only its raw identity. */
function meaning(c: UsbControl, saved: string | undefined): string {
  const known = profileFor(c.port) ? xzControlOf(c.control) : null
  if (known) return `${known.deck ? `CH ${known.deck} ` : ''}${known.label}`
  return saved ?? ''
}

/** Every control that ever sent a value, per port, with live value, range and rate of use. */
export function UsbControlsTable() {
  useTicker(400)
  const controls = useUsbStore((s) => s.usb.controls)
  const entries = useMappingStore((s) => s.entries)
  const [filter, setFilter] = useState('')
  const now = epochNow()
  const needle = filter.trim().toLowerCase()
  const rows = Object.values(controls)
    .map((c) => ({ c, meaning: meaning(c, entries[c.control]?.label) }))
    .filter(
      ({ c, meaning: m }) =>
        needle === '' ||
        `${c.port} ${c.control} ${c.kind} ${m} ${c.guess}`.toLowerCase().includes(needle)
    )
    .sort(
      (a, b) =>
        a.c.port.localeCompare(b.c.port) ||
        a.c.control.localeCompare(b.c.control, undefined, { numeric: true })
    )
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by port, type, number or name"
        aria-label="Filter MIDI controls"
        className="w-72 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
      />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">
          No control has sent anything yet. Touch a knob, fader, jog wheel or button.
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded border border-slate-800">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>
                <th className="px-2 py-1">port</th>
                <th className="px-2">type</th>
                <th className="px-2">ch</th>
                <th className="px-2">#</th>
                <th className="px-2">meaning</th>
                <th className="px-2">value</th>
                <th className="w-32 px-2" />
                <th className="px-2">range</th>
                <th className="px-2">count</th>
                <th className="px-2">last</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {rows.map(({ c, meaning: m }) => {
                const recent = now - c.lastTs < RECENT_MS
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-slate-800 ${recent ? 'bg-amber-500/15' : ''}`}
                  >
                    <td className="px-2 py-0.5 text-slate-400">{c.port}</td>
                    <td className="px-2">{KIND_LABEL[c.kind] ?? c.kind}</td>
                    <td className="px-2">{c.channel ?? ''}</td>
                    <td className="px-2">{c.number ?? ''}</td>
                    <td className="px-2 font-sans text-slate-100">{m}</td>
                    <td className="px-2 tabular-nums">
                      {c.raw}/{c.max}
                    </td>
                    <td className="px-2">
                      <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                        <div
                          className="h-full bg-sky-500"
                          style={{ width: `${(c.raw / c.max) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-2 tabular-nums text-slate-400">
                      {c.low}–{c.high}
                    </td>
                    <td className="px-2 tabular-nums">{c.count}</td>
                    <td className="px-2 text-slate-400">{formatAge(now - c.lastTs)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function SysexList() {
  const sysex = useUsbStore((s) => s.usb.sysex)
  if (sysex.length === 0)
    return <p className="text-sm text-slate-400">No SysEx message received.</p>
  return (
    <ol className="max-h-48 overflow-auto rounded border border-slate-800 p-2 font-mono text-xs text-slate-200">
      {sysex.map((s) => (
        <li key={s.id} className="break-all">
          <span className="text-slate-400">{s.port}</span> {hex(s.bytes)}
        </li>
      ))}
    </ol>
  )
}

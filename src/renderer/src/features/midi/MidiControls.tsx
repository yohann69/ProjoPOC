import { MIXER_TARGETS, isMixerTarget } from '@shared/usb'
import { memo } from 'react'
import { useMappingStore } from '../../store/useMappingStore'
import { useMidiStore, type ControlStat } from '../../store/useMidiStore'

const field =
  'rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100 focus-visible:ring-2 focus-visible:ring-white outline-none'

const ControlRow = memo(function ControlRow({
  stat,
  id
}: {
  stat: ControlStat | null
  id: string
}) {
  const entry = useMappingStore((s) => s.entries[id])
  const update = useMappingStore((s) => s.update)
  const level = stat ? stat.raw / stat.max : 0
  return (
    <li className="flex flex-col gap-1 rounded border border-slate-800 p-2">
      <div className="flex items-center gap-2 text-xs">
        <code className="shrink-0 text-sky-300">{id}</code>
        <div
          className="h-2 flex-1 overflow-hidden rounded bg-slate-800"
          role="meter"
          aria-label={`${id} value`}
          aria-valuemin={0}
          aria-valuemax={stat?.max ?? 127}
          aria-valuenow={stat?.raw ?? 0}
        >
          <div className="h-full bg-sky-500" style={{ width: `${level * 100}%` }} />
        </div>
        <span className="w-24 shrink-0 text-right tabular-nums text-slate-300">
          {stat ? `${stat.raw} (${stat.low}–${stat.high}) ×${stat.count}` : 'not seen yet'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={entry?.label ?? ''}
          maxLength={80}
          placeholder="Label, e.g. channel 1 fader"
          aria-label={`Label for ${id}`}
          onChange={(e) => update(id, { label: e.target.value })}
          className={`${field} min-w-0 flex-1`}
        />
        <select
          value={entry?.target ?? ''}
          aria-label={`Mixer target for ${id}`}
          onChange={(e) =>
            update(id, { target: isMixerTarget(e.target.value) ? e.target.value : null })
          }
          className={field}
        >
          <option value="">No mixer target</option>
          {MIXER_TARGETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={entry?.invert ?? false}
            onChange={(e) => update(id, { invert: e.target.checked })}
          />
          Invert
        </label>
      </div>
    </li>
  )
})

/** Every control seen so far, plus saved ones not yet seen, each with a label and optional mixer target. */
export function MidiControls() {
  const controls = useMidiStore((s) => s.controls)
  const entries = useMappingStore((s) => s.entries)
  const ids = [...new Set([...Object.keys(controls), ...Object.keys(entries)])].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )
  if (ids.length === 0) {
    return (
      <p className="text-sm text-slate-400">No controls seen yet. Move a fader, knob or button.</p>
    )
  }
  return (
    <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
      {ids.map((id) => (
        <ControlRow key={id} id={id} stat={controls[id] ?? null} />
      ))}
    </ul>
  )
}

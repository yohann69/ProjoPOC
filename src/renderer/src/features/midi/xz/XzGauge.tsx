import { useMidiStore, type ControlStat } from '../../../store/useMidiStore'
import { assignLabel, xzKey, type XzControl } from '../../../lib/xzMap'
import { Fader, Knob } from './gauges'

/** Latest message for one control (a stable object until that control changes). */
export const useStat = (cc: number): ControlStat | undefined =>
  useMidiStore((s) => s.controls[xzKey(cc)])

const level = (stat: ControlStat | undefined): number | null => (stat ? stat.raw / stat.max : null)

const tip = (c: XzControl): string =>
  c.ends ? `${c.label}: ${c.ends[0]} to ${c.ends[1]}` : c.label

/** One XDJ-XZ knob or fader, drawn from its latest MIDI value. */
export function XzGauge({ control, color }: { control: XzControl; color: string }) {
  const stat = useStat(control.cc)
  if (control.kind === 'fader') {
    return (
      <Fader
        label={control.label}
        value={level(stat)}
        raw={stat?.raw}
        color={color}
        vertical={control.section !== 'crossfader'}
        title={tip(control)}
      />
    )
  }
  return (
    <Knob
      label={control.label}
      value={level(stat)}
      raw={stat?.raw}
      color={color}
      centered={control.centered}
      title={tip(control)}
    />
  )
}

/** A press or toggle shown as a lit or dark pill; the crossfader assign switch shows A, THRU or B. */
export function XzButton({ control, color }: { control: XzControl; color: string }) {
  const stat = useStat(control.cc)
  const text = control.kind === 'switch' && stat ? `XF ${assignLabel(stat.raw)}` : control.label
  const lit = control.kind === 'button' && !!stat && stat.raw > 0
  return (
    <span
      className="rounded border px-1.5 py-0.5 text-[10px] font-semibold"
      style={
        lit
          ? { background: color, borderColor: color, color: '#0f172a' }
          : { borderColor: '#475569', color: stat ? '#e2e8f0' : '#64748b' }
      }
    >
      {text}
    </span>
  )
}

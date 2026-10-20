const SWEEP = 135

function xy(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

const point = (cx: number, cy: number, r: number, deg: number): string =>
  xy(cx, cy, r, deg)
    .map((n) => n.toFixed(2))
    .join(' ')

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [start, end] = from <= to ? [from, to] : [to, from]
  return `M${point(cx, cy, r, start)} A${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${point(cx, cy, r, end)}`
}

interface KnobProps {
  label: string
  /** 0..1, or null before the first message. */
  value: number | null
  raw?: number
  color: string
  /** Neutral position is the centre, so the arc grows from there. */
  centered?: boolean
  title?: string
  size?: number
}

/** Round knob: a 270 degree track, the value arc and a pointer; shows the raw number below. */
export function Knob({ label, value, raw, color, centered, title, size = 40 }: KnobProps) {
  const c = size / 2
  const r = c - 4
  const angle = value === null ? -SWEEP : -SWEEP + 2 * SWEEP * value
  const from = centered ? 0 : -SWEEP
  const inner = xy(c, c, r - 9, angle)
  const outer = xy(c, c, r - 2, angle)
  return (
    <div
      className="flex flex-col items-center"
      title={title}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={127}
      aria-valuenow={raw ?? 0}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path
          d={arc(c, c, r, -SWEEP, SWEEP)}
          fill="none"
          stroke="#334155"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {value !== null && (
          <path
            d={arc(c, c, r, from, angle)}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
        <line
          x1={inner[0]}
          y1={inner[1]}
          x2={outer[0]}
          y2={outer[1]}
          stroke={value === null ? '#475569' : '#f8fafc'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[10px] font-semibold leading-tight text-slate-300">{label}</span>
      <span className="text-[10px] tabular-nums leading-tight text-slate-400">
        {raw ?? '\u2013'}
      </span>
    </div>
  )
}

interface FaderProps {
  label: string
  value: number | null
  raw?: number
  color: string
  vertical?: boolean
  title?: string
}

/** Fader as a filled bar: bottom-up for channel faders, left-right for the crossfader. */
export function Fader({ label, value, raw, color, vertical = true, title }: FaderProps) {
  const percent = `${(value ?? 0) * 100}%`
  return (
    <div
      className={vertical ? 'flex flex-col items-center gap-1' : 'flex items-center gap-2'}
      title={title}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={127}
      aria-valuenow={raw ?? 0}
    >
      <div
        className={`relative overflow-hidden rounded bg-slate-800 ${vertical ? 'h-28 w-4' : 'h-4 flex-1'}`}
      >
        {value !== null && (
          <div
            className="absolute"
            style={
              vertical
                ? { left: 0, right: 0, bottom: 0, height: percent, background: color }
                : { top: 0, bottom: 0, left: 0, width: percent, background: color }
            }
          />
        )}
        {value !== null && (
          <div
            className="absolute bg-white"
            style={
              vertical
                ? { left: 0, right: 0, height: 3, bottom: `calc(${percent} - 1.5px)` }
                : { top: 0, bottom: 0, width: 3, left: `calc(${percent} - 1.5px)` }
            }
          />
        )}
      </div>
      <span className="text-[10px] font-semibold leading-tight text-slate-300">{label}</span>
      <span className="w-6 text-center text-[10px] tabular-nums leading-tight text-slate-400">
        {raw ?? '\u2013'}
      </span>
    </div>
  )
}

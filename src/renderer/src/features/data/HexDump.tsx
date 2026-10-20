import { memo, useState } from 'react'
import type { DumpView } from '../../lib/dataFold'
import { formatAge } from '../../lib/format'
import { epochNow } from '../../lib/frameLoop'
import { useTicker } from '../../ui/primitives'

const ROW = 16
const RECENT_MS = 1500

const h = (n: number, width = 2): string => n.toString(16).padStart(width, '0')

function readings(bytes: number[], i: number): string {
  const at = (k: number): number => bytes[i + k] ?? 0
  const parts = [`u8 ${at(0)}`, `i8 ${(at(0) << 24) >> 24}`]
  if (i + 1 < bytes.length) {
    parts.push(`u16 BE ${(at(0) << 8) | at(1)}`, `u16 LE ${(at(1) << 8) | at(0)}`)
  }
  if (i + 3 < bytes.length) {
    const be = ((at(0) << 24) | (at(1) << 16) | (at(2) << 8) | at(3)) >>> 0
    const le = ((at(3) << 24) | (at(2) << 16) | (at(1) << 8) | at(0)) >>> 0
    parts.push(`u32 BE ${be}`, `u32 LE ${le}`)
  }
  return parts.join(' · ')
}

/** Hex view of the newest packet: constant bytes are dim, bytes that ever changed are blue, fresh changes amber. */
export const HexDump = memo(function HexDump({ dump }: { dump: DumpView }) {
  useTicker(500)
  const [picked, setPicked] = useState<number | null>(null)
  const now = epochNow()
  const rows = Array.from({ length: Math.ceil(dump.bytes.length / ROW) }, (_, r) => r * ROW)
  const moving = dump.changes.filter((c) => c > 0).length
  return (
    <details open className="rounded-lg border border-slate-800 bg-slate-900">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm font-semibold text-slate-50">
        <span>
          {dump.srcAddr}:{dump.port}
        </span>
        <span className="text-sky-300">{dump.kind}</span>
        {dump.device !== null && <span className="text-slate-300">device {dump.device}</span>}
        <span className="text-xs font-normal text-slate-400">
          {dump.length} B · #{dump.count} · {moving} changing bytes ·{' '}
          {formatAge(now - dump.updatedAt)} ago
        </span>
      </summary>
      <div className="overflow-x-auto px-3 pb-2 font-mono text-[11px] leading-5">
        {rows.map((start) => (
          <div key={start} className="flex gap-3 whitespace-pre">
            <span className="w-10 text-slate-500">{h(start, 4)}</span>
            <span>
              {dump.bytes.slice(start, start + ROW).map((b, k) => {
                const i = start + k
                const fresh = now - (dump.changedAt[i] ?? 0) < RECENT_MS
                const moved = (dump.changes[i] ?? 0) > 0
                const tone = fresh
                  ? 'bg-amber-500/30 text-amber-50'
                  : moved
                    ? 'text-sky-300'
                    : 'text-slate-500'
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPicked(i)}
                    aria-label={`byte ${i}`}
                    className={`mr-1 rounded-sm px-px ${tone} ${picked === i ? 'outline outline-1 outline-white' : ''}`}
                  >
                    {h(b)}
                  </button>
                )
              })}
            </span>
            <span className="text-slate-400">
              {dump.bytes
                .slice(start, start + ROW)
                .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
                .join('')}
            </span>
          </div>
        ))}
        <p className="mt-1 text-slate-300">
          {picked === null
            ? 'Click a byte to read it as a number.'
            : `0x${h(picked, 4)} (${picked}): ${readings(dump.bytes, picked)} · changed ×${dump.changes[picked] ?? 0}`}
        </p>
      </div>
    </details>
  )
})

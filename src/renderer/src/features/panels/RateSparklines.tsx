import { useEffect, useRef } from 'react'
import { formatPacketRate } from '../../lib/format'
import { useLiveStore } from '../../store/useLiveStore'
import { OriginBadge } from '../../ui/OriginBadge'
import { NotAvailable, Panel } from '../../ui/primitives'

const W = 140
const H = 32

function Sparkline({ values }: { values: number[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    el.width = W * dpr
    el.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const max = Math.max(1, ...values)
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    values.forEach((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * (W - 2) + 1
      const y = H - 2 - (v / max) * (H - 4)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [values])
  return <canvas ref={canvas} style={{ width: W, height: H }} aria-hidden="true" />
}

export function RateSparklines() {
  const source = useLiveStore((s) => s.source)
  const ports = useLiveStore((s) => s.ports)
  const history = useLiveStore((s) => s.portHistory)
  return (
    <Panel title="Packet rate per port" badges={<OriginBadge origin="ETH_LIVE" />}>
      {source !== 'prolink' ? (
        <NotAvailable text="N/A: only the Pro DJ Link source sees packets" />
      ) : ports.length === 0 ? (
        <span className="text-sm text-slate-300">No packets captured yet.</span>
      ) : (
        <ul className="flex flex-col gap-2">
          {ports.map((p) => (
            <li key={p.port} className="flex items-center gap-3 text-sm">
              <span className="w-14 font-mono text-slate-50">{p.port}</span>
              <Sparkline values={history[p.port] ?? []} />
              <span className="w-16 text-right tabular-nums text-slate-50">
                {formatPacketRate(p.packetsPerSecond)}
              </span>
              <span className="truncate text-xs text-slate-300">
                {Object.entries(p.kinds)
                  .map(([k, n]) => `${k} ${n}`)
                  .join(' \u00b7 ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

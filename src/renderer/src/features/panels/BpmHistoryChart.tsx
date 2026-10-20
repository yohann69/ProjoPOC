import { DECK_IDS } from '@shared/types'
import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { DECK_COLORS } from '../../lib/deckColors'
import { epochNow } from '../../lib/frameLoop'
import { HISTORY_SECONDS, historyData, type HistoryData } from '../../live/bpmHistory'
import { OriginBadge } from '../../ui/OriginBadge'
import { Panel } from '../../ui/primitives'

const HEIGHT = 170
const AXIS = {
  stroke: '#cbd5e1',
  grid: { stroke: '#1e293b', width: 1 },
  ticks: { stroke: '#334155' }
}

export function BpmHistoryChart() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let nowSec = epochNow() / 1000
    const plot = new uPlot(
      {
        width: Math.max(200, el.clientWidth),
        height: HEIGHT,
        legend: { show: false },
        cursor: { show: false },
        scales: {
          x: { time: true, range: () => [nowSec - HISTORY_SECONDS, nowSec] },
          y: {
            range: (_u, min, max) =>
              min == null || max == null ? [100, 150] : [Math.floor(min - 2), Math.ceil(max + 2)]
          }
        },
        axes: [
          { ...AXIS, size: 30 },
          { ...AXIS, size: 44 }
        ],
        series: [
          {},
          ...DECK_IDS.map((deck) => ({
            label: `Deck ${deck}`,
            stroke: DECK_COLORS[deck],
            width: 2,
            points: { show: false }
          }))
        ]
      },
      historyData() as uPlot.AlignedData,
      el
    )
    const refresh = (): void => {
      nowSec = epochNow() / 1000
      plot.setData(historyData() as HistoryData as uPlot.AlignedData, true)
    }
    const timer = setInterval(refresh, 1000)
    const observer = new ResizeObserver(() =>
      plot.setSize({ width: Math.max(200, el.clientWidth), height: HEIGHT })
    )
    observer.observe(el)
    return () => {
      clearInterval(timer)
      observer.disconnect()
      plot.destroy()
    }
  }, [])

  return (
    <Panel title="BPM history (5 min)" badges={<OriginBadge origin="ETH_LIVE" />}>
      <div
        ref={host}
        className="w-full"
        role="img"
        aria-label="BPM history chart, one line per deck"
      />
      <ul className="flex gap-4 text-xs text-slate-200">
        {DECK_IDS.map((deck) => (
          <li key={deck} className="flex items-center gap-1">
            <span
              className="inline-block h-1 w-4 rounded"
              style={{ backgroundColor: DECK_COLORS[deck] }}
            />
            Deck {deck}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

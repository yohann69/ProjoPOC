import type { MidiKind } from './midiDecode'
import { parseControlKey } from './midiDecode'
import type { Received } from '../store/useMidiStore'

export interface PortStat {
  port: string
  total: number
  byKind: Partial<Record<MidiKind, number>>
  lastTs: number
  /** Messages per second over the last full window. */
  rate: number
  windowStart: number
  windowCount: number
}

/** One physical control on one port, with everything seen of it. */
export interface UsbControl {
  id: string
  port: string
  control: string
  kind: MidiKind
  channel: number | null
  number: number | null
  guess: string
  bytes: number[]
  raw: number
  max: number
  low: number
  high: number
  count: number
  lastTs: number
}

export interface SysexRow {
  id: number
  port: string
  ts: number
  bytes: number[]
}

export interface UsbState {
  ports: Record<string, PortStat>
  controls: Record<string, UsbControl>
  sysex: SysexRow[]
}

export const emptyUsb = (): UsbState => ({ ports: {}, controls: {}, sysex: [] })

const WINDOW_MS = 1000
const MAX_SYSEX = 20
const MAX_SYSEX_BYTES = 512
const MAX_CONTROLS = 2000

/** Folds every received message, including the ones the stream hides, into per-port and per-control stats. */
export function foldUsb(state: UsbState, rows: Received[], now: number): UsbState {
  if (rows.length === 0) return state
  const ports = { ...state.ports }
  const controls = { ...state.controls }
  let sysex = state.sysex
  for (const row of rows) {
    const { message: m, port, ts } = row
    const old = ports[port]
    const stat: PortStat = old
      ? { ...old, byKind: { ...old.byKind } }
      : { port, total: 0, byKind: {}, lastTs: 0, rate: 0, windowStart: now, windowCount: 0 }
    stat.total++
    stat.windowCount++
    stat.lastTs = ts
    stat.byKind[m.kind] = (stat.byKind[m.kind] ?? 0) + 1
    ports[port] = stat
    if (m.kind === 'sysex') {
      sysex = [
        { id: row.id, port, ts, bytes: row.bytes.slice(0, MAX_SYSEX_BYTES) },
        ...sysex
      ].slice(0, MAX_SYSEX)
    }
    if (!m.control || m.raw === null) continue
    const id = `${port}|${m.control}`
    const before = controls[id]
    if (!before && Object.keys(controls).length >= MAX_CONTROLS) continue
    controls[id] = {
      id,
      port,
      control: m.control,
      kind: m.kind,
      channel: m.channel,
      number: parseControlKey(m.control)?.number ?? null,
      guess: m.guess,
      bytes: row.bytes.slice(0, 16),
      raw: m.raw,
      max: m.max,
      low: before ? Math.min(before.low, m.raw) : m.raw,
      high: before ? Math.max(before.high, m.raw) : m.raw,
      count: (before?.count ?? 0) + 1,
      lastTs: ts
    }
  }
  for (const port of new Set(rows.map((r) => r.port))) {
    const stat = ports[port]
    if (stat && now - stat.windowStart >= WINDOW_MS) {
      const rate = Math.round((stat.windowCount * 1000) / (now - stat.windowStart))
      ports[port] = { ...stat, rate, windowStart: now, windowCount: 0 }
    }
  }
  return { ports, controls, sysex }
}

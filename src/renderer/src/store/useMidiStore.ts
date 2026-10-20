import { create } from 'zustand'
import type { MidiKind, MidiMessage } from '../lib/midiDecode'

export type MidiStatus = 'idle' | 'unsupported' | 'requesting' | 'denied' | 'ready' | 'error'

export interface MidiInputInfo {
  id: string
  name: string
  manufacturer: string
  connected: boolean
}

export interface Received {
  id: number
  ts: number
  port: string
  bytes: number[]
  message: MidiMessage
}

export interface ControlStat {
  key: string
  kind: MidiKind
  channel: number | null
  guess: string
  raw: number
  max: number
  /** Smallest and largest raw value seen so far. */
  low: number
  high: number
  count: number
  lastTs: number
}

const MAX_STREAM = 150

/** Folds a batch of messages into the per-control summary; pure so it can be tested. */
export function foldControls(
  controls: Record<string, ControlStat>,
  rows: Received[]
): Record<string, ControlStat> {
  const next = { ...controls }
  for (const { message: m, ts } of rows) {
    if (!m.control || m.raw === null) continue
    const old = next[m.control]
    next[m.control] = {
      key: m.control,
      kind: m.kind,
      channel: m.channel,
      guess: m.guess,
      raw: m.raw,
      max: m.max,
      low: old ? Math.min(old.low, m.raw) : m.raw,
      high: old ? Math.max(old.high, m.raw) : m.raw,
      count: (old?.count ?? 0) + 1,
      lastTs: ts
    }
  }
  return next
}

interface MidiStore {
  status: MidiStatus
  message?: string
  inputs: MidiInputInfo[]
  /** Name of the chosen input; kept even while the device is unplugged. */
  selected: string | null
  /** Ports messages are read from: the chosen input plus every port of a recognised device. */
  listening: string[]
  controls: Record<string, ControlStat>
  stream: Received[]
  paused: boolean
  ignoreRealtime: boolean
  /** Messages received since the port was chosen, including ones hidden from the stream. */
  total: number
  hiddenRealtime: number
  lastMessageTs: number | null
  logEnabled: boolean
  logPath: string | null
  setStatus(status: MidiStatus, message?: string): void
  setInputs(inputs: MidiInputInfo[]): void
  select(name: string | null): void
  setListening(ports: string[]): void
  push(rows: Received[], hidden: number): void
  setPaused(paused: boolean): void
  setIgnoreRealtime(ignore: boolean): void
  clear(): void
  setLog(enabled: boolean, path: string | null): void
}

export const useMidiStore = create<MidiStore>((set) => ({
  status: 'idle',
  inputs: [],
  selected: null,
  listening: [],
  controls: {},
  stream: [],
  paused: false,
  ignoreRealtime: true,
  total: 0,
  hiddenRealtime: 0,
  lastMessageTs: null,
  logEnabled: false,
  logPath: null,
  setStatus: (status, message) => set({ status, message }),
  setInputs: (inputs) => set({ inputs }),
  setListening: (listening) => set({ listening }),
  select: (selected) =>
    set({ selected, controls: {}, stream: [], total: 0, hiddenRealtime: 0, lastMessageTs: null }),
  push: (rows, hidden) =>
    set((s) => ({
      controls: foldControls(s.controls, rows),
      stream: s.paused ? s.stream : [...rows.slice().reverse(), ...s.stream].slice(0, MAX_STREAM),
      total: s.total + rows.length + hidden,
      hiddenRealtime: s.hiddenRealtime + hidden,
      lastMessageTs: rows.at(-1)?.ts ?? s.lastMessageTs
    })),
  setPaused: (paused) => set({ paused }),
  setIgnoreRealtime: (ignoreRealtime) => set({ ignoreRealtime }),
  clear: () => set({ controls: {}, stream: [], total: 0, hiddenRealtime: 0 }),
  setLog: (logEnabled, logPath) => set({ logEnabled, logPath })
}))

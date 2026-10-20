import type { IngestEvent, MidiLogEntry, MixerTarget } from '@shared/usb'
import { decodeMidi } from '../../lib/midiDecode'
import { epochNow } from '../../lib/frameLoop'
import { profileFor, xzControlOf } from '../../lib/xzMap'
import { useMappingStore } from '../../store/useMappingStore'
import { useMidiStore, type Received } from '../../store/useMidiStore'
import { useUsbStore } from '../../store/useUsbStore'

const UI_FLUSH_MS = 100
const INGEST_FLUSH_MS = 33
const LOG_FLUSH_MS = 250
const MAX_LOG_BYTES = 256

let nextId = 0
let rows: Received[] = []
let everything: Received[] = []
let hidden = 0
let uiTimer: ReturnType<typeof setTimeout> | undefined
let ingestTimer: ReturnType<typeof setTimeout> | undefined
let logTimer: ReturnType<typeof setTimeout> | undefined
const pending = new Map<MixerTarget, IngestEvent>()
let logRows: MidiLogEntry[] = []

function flushUi(): void {
  uiTimer = undefined
  const batch = rows
  const count = hidden
  const all = everything
  rows = []
  everything = []
  hidden = 0
  useMidiStore.getState().push(batch, count)
  useUsbStore.getState().push(all, epochNow())
}

function flushIngest(): void {
  ingestTimer = undefined
  const events = [...pending.values()]
  pending.clear()
  if (events.length > 0) window.deckpulse.ingest(events)
}

function flushLog(): void {
  logTimer = undefined
  const entries = logRows
  logRows = []
  if (entries.length > 0) window.deckpulse.logMidi(entries)
}

/** Drops anything queued; used when the port changes or MIDI stops. */
export function resetPipeline(): void {
  clearTimeout(uiTimer)
  clearTimeout(ingestTimer)
  clearTimeout(logTimer)
  uiTimer = ingestTimer = logTimer = undefined
  rows = []
  everything = []
  hidden = 0
  logRows = []
  pending.clear()
}

/** Decodes one message and routes it to the explorer, the mixer mapping and the optional log. */
export function handleMidi(port: string, data: ArrayLike<number>, timeStamp: number): void {
  const bytes = Array.from(data)
  const message = decodeMidi(bytes)
  const ts = performance.timeOrigin + timeStamp
  const store = useMidiStore.getState()
  const realtime = message.kind === 'clock' || message.kind === 'activeSensing'
  const row: Received = { id: nextId++, ts, port, bytes, message }
  everything.push(row)
  if (store.ignoreRealtime && realtime) hidden++
  else rows.push(row)
  uiTimer ??= setTimeout(flushUi, UI_FLUSH_MS)

  const entry = message.control ? useMappingStore.getState().entries[message.control] : undefined
  // A saved mapping wins; otherwise a recognised device (XDJ-XZ) feeds its documented mixer controls.
  const known = profileFor(port) ? xzControlOf(message.control) : null
  const target = entry?.target ?? known?.target ?? null
  if (target && message.raw !== null) {
    const level = message.raw / message.max
    const value = entry?.target && entry.invert ? 1 - level : level
    pending.set(target, { kind: 'mixerValue', target, value, ts })
    ingestTimer ??= setTimeout(flushIngest, INGEST_FLUSH_MS)
  }
  if (store.logEnabled) {
    logRows.push({ ts, port, bytes: bytes.slice(0, MAX_LOG_BYTES), guess: message.guess })
    logTimer ??= setTimeout(flushLog, LOG_FLUSH_MS)
  }
}

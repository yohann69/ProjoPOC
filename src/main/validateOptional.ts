import {
  DEFAULT_OPTIONAL_SETTINGS,
  isMixerTarget,
  type IngestEvent,
  type MidiLogEntry,
  type OptionalSettings
} from '@shared/usb'

export { parseMidiMapping } from '@shared/usbMapping'

const MAX_INGEST_BATCH = 200
const MAX_LOG_BATCH = 512
const MAX_LOG_BYTES = 4096

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function num(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expected a number')
  return value
}

const unit = (value: unknown): number => Math.min(1, Math.max(0, num(value)))

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text')
  return value
}

const nullableText = (value: unknown, max: number): string | null =>
  value === null || value === undefined ? null : text(value, max)

export function parseOptionalSettings(value: unknown): OptionalSettings {
  if (value === undefined) return DEFAULT_OPTIONAL_SETTINGS
  if (!isRecord(value)) throw new Error('Invalid optional-source settings')
  return {
    midiInputName: nullableText(value.midiInputName, 256),
    audioDeviceId: nullableText(value.audioDeviceId, 512)
  }
}

function parseIngestEvent(value: unknown): IngestEvent {
  if (!isRecord(value)) throw new Error('Invalid ingest event')
  const ts = num(value.ts)
  switch (value.kind) {
    case 'mixerValue':
      if (!isMixerTarget(value.target)) throw new Error('Invalid mixer target')
      return { kind: 'mixerValue', target: value.target, value: unit(value.value), ts }
    case 'energy': {
      const bands = isRecord(value.bands) ? value.bands : {}
      return {
        kind: 'energy',
        ts,
        rms: unit(value.rms),
        bands: { low: unit(bands.low), mid: unit(bands.mid), high: unit(bands.high) }
      }
    }
    case 'onset':
      return { kind: 'onset', ts, strength: unit(value.strength) }
    case 'drop':
      if (value.phase !== 'buildup' && value.phase !== 'drop') throw new Error('Invalid phase')
      return { kind: 'drop', ts, phase: value.phase }
    default:
      throw new Error('Unknown ingest event')
  }
}

export function parseIngest(value: unknown): IngestEvent[] {
  if (!Array.isArray(value) || value.length > MAX_INGEST_BATCH) throw new Error('Invalid ingest')
  return value.map(parseIngestEvent)
}

export function parseMidiLog(value: unknown): MidiLogEntry[] {
  if (!Array.isArray(value) || value.length > MAX_LOG_BATCH) throw new Error('Invalid MIDI log')
  return value.map((entry: unknown) => {
    if (!isRecord(entry) || !Array.isArray(entry.bytes) || entry.bytes.length > MAX_LOG_BYTES) {
      throw new Error('Invalid MIDI log entry')
    }
    const bytes = entry.bytes.map((b: unknown) => {
      const n = num(b)
      if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error('Invalid MIDI byte')
      return n
    })
    return { ts: num(entry.ts), port: text(entry.port, 256), bytes, guess: text(entry.guess, 200) }
  })
}

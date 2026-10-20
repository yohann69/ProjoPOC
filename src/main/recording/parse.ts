import { RECORDING_VERSION, type RecordingHeader, type RecordingRecord } from '@shared/recording'
import { decodeRecord } from './serialize'

export interface ParsedRecording {
  header: RecordingHeader | null
  records: RecordingRecord[]
  /** Lines that were not valid JSON or not a known record. */
  skipped: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRawSource = (value: unknown): boolean => value === 'prolink' || value === 'simulator'

function toRecord(value: Record<string, unknown>): RecordingRecord | null {
  const { type, t } = value
  if (typeof t !== 'number' || !Number.isFinite(t)) return null
  if (type === 'raw' && isRawSource(value.source) && isRecord(value.raw)) {
    return value as unknown as RecordingRecord
  }
  if (type === 'event' && isRecord(value.event) && typeof value.event.type === 'string') {
    return value as unknown as RecordingRecord
  }
  if (type === 'ingest' && Array.isArray(value.events)) return value as unknown as RecordingRecord
  return null
}

/** Reads a recording; bad lines are counted and skipped so one damaged line cannot block a replay. */
export function parseRecording(text: string): ParsedRecording {
  const parsed: ParsedRecording = { header: null, records: [], skipped: 0 }
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    let value: unknown
    try {
      value = decodeRecord(line)
    } catch {
      parsed.skipped++
      continue
    }
    if (!isRecord(value)) {
      parsed.skipped++
    } else if (value.type === 'header') {
      if (value.version !== RECORDING_VERSION)
        throw new Error(`Unsupported recording version ${String(value.version)}`)
      parsed.header = value as unknown as RecordingHeader
    } else {
      const record = toRecord(value)
      if (record) parsed.records.push(record)
      else parsed.skipped++
    }
  }
  return parsed
}

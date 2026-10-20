import type { FieldValue } from '@shared/types'

export type Fields = Record<string, FieldValue>

const SLOTS: Record<number, string> = {
  0: 'empty',
  1: 'CD',
  2: 'SD',
  3: 'USB',
  4: 'rekordbox',
  6: 'streaming direct play',
  9: 'Beatport'
}
const TRACK_TYPES: Record<number, string> = {
  0: 'none',
  1: 'rekordbox',
  2: 'unanalyzed',
  5: 'audio CD',
  6: 'streaming'
}

/** Codes of alphatheta-connect's CDJStatus.PlayState, TrackType, MediaSlot, DeviceType and MediaColor. */
const NAMES: Record<string, Record<number, string>> = {
  playState: {
    0: 'empty',
    2: 'loading',
    3: 'playing',
    4: 'looping',
    5: 'paused',
    6: 'cued',
    7: 'cuing',
    8: 'platter held',
    9: 'searching',
    14: 'spun down',
    17: 'ended'
  },
  trackType: TRACK_TYPES,
  trackSlot: SLOTS,
  slot: SLOTS,
  type: { 1: 'CDJ', 3: 'mixer', 4: 'rekordbox', 5: 'stagehand' },
  tracksType: TRACK_TYPES,
  color: {
    0: 'default',
    1: 'pink',
    2: 'red',
    3: 'orange',
    4: 'yellow',
    5: 'green',
    6: 'aqua',
    7: 'blue',
    8: 'purple'
  }
}

const MAX_TEXT = 300
const MAX_DEPTH = 3
const MAX_LIST = 8

const named = (key: string, value: number): string => {
  const name = NAMES[key]?.[value]
  return name === undefined ? `${value} (unknown)` : `${value} (${name})`
}

/** One value as something a table cell can show; never throws. */
export function toField(value: unknown): FieldValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'string') return value.slice(0, MAX_TEXT)
  if (typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (value instanceof Uint8Array) return `${value.length} bytes`
  try {
    return (JSON.stringify(value) ?? '').slice(0, MAX_TEXT)
  } catch {
    return String(value).slice(0, MAX_TEXT)
  }
}

/** Flat key/value view of an object: nested objects get dotted keys, lists become a count or a short list. */
export function flatten(value: unknown, prefix = '', depth = 0, out: Fields = {}): Fields {
  if (typeof value !== 'object' || value === null || value instanceof Date) {
    if (prefix) out[prefix] = toField(value)
    return out
  }
  if (value instanceof Uint8Array) {
    out[prefix] = toField(value)
    return out
  }
  if (Array.isArray(value)) {
    const simple = value.every((v) => v === null || typeof v !== 'object')
    out[prefix] =
      simple && value.length <= MAX_LIST
        ? value.map((v) => String(toField(v))).join(', ')
        : `${value.length} items`
    return out
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'function') continue
    const path = prefix ? `${prefix}.${key}` : key
    if (depth >= MAX_DEPTH && typeof child === 'object' && child !== null) {
      out[path] = toField(child)
    } else flatten(child, path, depth + 1, out)
  }
  return out
}

/** Every field of a library state object, with the numeric codes spelled out where the library names them. */
export function describeFields(state: object): Fields {
  const out: Fields = {}
  for (const [key, value] of Object.entries(state)) {
    out[key] = typeof value === 'number' && NAMES[key] ? named(key, value) : toField(value)
  }
  return out
}

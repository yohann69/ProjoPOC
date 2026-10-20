import type { AppEvent, FieldValue } from '@shared/types'

type SnapshotEvent = Extract<AppEvent, { type: 'dataSnapshot' }>
type DumpEvent = Extract<AppEvent, { type: 'packetDump' }>

export interface SnapshotView {
  group: string
  title: string
  fields: Record<string, FieldValue>
  /** Receive time of the last change of each field. */
  changedAt: Record<string, number>
  /** How many times each field changed; a field that never moves is probably constant. */
  changes: Record<string, number>
  updatedAt: number
}

export interface DumpView {
  key: string
  port: number
  kind: string
  srcAddr: string
  device: number | null
  length: number
  /** Byte values, 0..255. */
  bytes: number[]
  /** Receive time of the last change of each byte; 0 when it never changed. */
  changedAt: number[]
  changes: number[]
  count: number
  updatedAt: number
}

export function foldSnapshot(
  prev: SnapshotView | undefined,
  event: SnapshotEvent,
  now: number
): SnapshotView {
  const changedAt = { ...prev?.changedAt }
  const changes = { ...prev?.changes }
  for (const [name, value] of Object.entries(event.fields)) {
    if (prev && name in prev.fields && prev.fields[name] === value) continue
    changedAt[name] = now
    if (prev) changes[name] = (changes[name] ?? 0) + 1
  }
  return {
    group: event.group,
    title: event.title,
    fields: event.fields,
    changedAt,
    changes,
    updatedAt: now
  }
}

export function parseHex(hex: string): number[] {
  return hex === '' ? [] : hex.split(' ').map((b) => parseInt(b, 16))
}

export function foldDump(prev: DumpView | undefined, event: DumpEvent, now: number): DumpView {
  const bytes = parseHex(event.hex)
  const changedAt = bytes.map((_, i) => prev?.changedAt[i] ?? 0)
  const changes = bytes.map((_, i) => prev?.changes[i] ?? 0)
  if (prev) {
    bytes.forEach((b, i) => {
      if (i >= prev.bytes.length || prev.bytes[i] === b) return
      changedAt[i] = now
      changes[i] = (changes[i] ?? 0) + 1
    })
  }
  return {
    key: event.key,
    port: event.port,
    kind: event.kind,
    srcAddr: event.srcAddr,
    device: event.device,
    length: event.length,
    bytes,
    changedAt,
    changes,
    count: event.count,
    updatedAt: now
  }
}

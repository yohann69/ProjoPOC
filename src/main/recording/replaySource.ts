import { EventEmitter } from 'node:events'
import { basename } from 'node:path'
import type { ReplayConfig, ReplayItem } from '@shared/recording'
import type { AppEvent, SourceId, SourceState } from '@shared/types'
import type { DataSource } from '../sources/types'
import { parseRecording } from './parse'
import { shiftTimestamps } from './serialize'

export interface ReplayDeps {
  readFile(path: string): string
  now?: () => number
}

/** Normalized events that are derived again on replay or describe the recorded live session. */
const DERIVED_ON_REPLAY: readonly AppEvent['type'][] = [
  'hook',
  'hookServer',
  'transition',
  'sourceStatus'
]
const LOOP_GAP_MS = 1000

interface Timed {
  t: number
  item: ReplayItem
}

/**
 * Replays a recording at real-time speed. Raw source events (and renderer-side ingest events) go
 * back through the normalizer, so the whole pipeline runs as it did live; a file with only
 * normalized events is replayed from those. Timestamps are moved to the present.
 */
export class ReplaySource implements DataSource<ReplayItem> {
  readonly id: SourceId = 'replay'
  private readonly emitter = new EventEmitter()
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopped = true
  private items: Timed[] = []
  private index = 0
  private startWall = 0
  private offset = 0

  constructor(
    private readonly config: ReplayConfig,
    private readonly deps: ReplayDeps
  ) {}

  on(event: 'event', listener: (raw: ReplayItem) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  off(event: 'event', listener: (raw: ReplayItem) => void): this {
    this.emitter.off(event, listener)
    return this
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    try {
      const parsed = parseRecording(this.deps.readFile(this.config.path))
      const hasRaw = parsed.records.some((r) => r.type !== 'event')
      this.items = parsed.records.flatMap((r): Timed[] => {
        if (r.type === 'raw') {
          const skip = (r.raw as { kind?: string }).kind === 'status'
          return skip ? [] : [{ t: r.t, item: { kind: 'raw', source: r.source, raw: r.raw } }]
        }
        if (r.type === 'ingest') return [{ t: r.t, item: { kind: 'ingest', events: r.events } }]
        const keep = !hasRaw && !DERIVED_ON_REPLAY.includes(r.event.type)
        return keep ? [{ t: r.t, item: { kind: 'event', event: r.event } }] : []
      })
      const seconds = this.durationMs() / 1000
      const origin = parsed.header?.source ? `, recorded from ${parsed.header.source}` : ''
      const damaged = parsed.skipped > 0 ? `, ${parsed.skipped} damaged lines skipped` : ''
      this.status(
        this.items.length > 0 ? 'running' : 'error',
        this.items.length > 0
          ? `Replaying ${basename(this.config.path)}: ${this.items.length} records, ${seconds.toFixed(1)} s${origin}${damaged}`
          : 'The recording has no replayable events',
        parsed.header?.source
      )
    } catch (error) {
      this.status(
        'error',
        `Cannot replay: ${error instanceof Error ? error.message : String(error)}`
      )
      return
    }
    if (this.items.length > 0) this.begin()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    clearTimeout(this.timer)
    this.status('stopped', 'Replay stopped')
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private durationMs(): number {
    return this.items.length > 1 ? (this.items.at(-1)?.t ?? 0) - (this.items[0]?.t ?? 0) : 0
  }

  private status(state: SourceState, message: string, recordedFrom?: SourceId | null): void {
    const item: ReplayItem = { kind: 'status', state, message, recordedFrom }
    this.emitter.emit('event', item)
  }

  private begin(): void {
    this.index = 0
    this.startWall = this.now()
    this.offset = this.startWall - (this.items[0]?.t ?? 0)
    this.pump()
  }

  private pump(): void {
    const now = this.now()
    while (!this.stopped && this.index < this.items.length) {
      const next = this.items[this.index]
      if (!next) break
      const due = this.startWall + (next.t - (this.items[0]?.t ?? 0))
      if (due > now) {
        this.timer = setTimeout(() => this.pump(), due - now)
        return
      }
      this.index++
      this.emitter.emit('event', this.shifted(next.item))
    }
    if (!this.stopped) this.finish()
  }

  private shifted(item: ReplayItem): ReplayItem {
    return item.kind === 'status' || item.kind === 'restart'
      ? item
      : (shiftTimestamps(item, this.offset) as ReplayItem)
  }

  private finish(): void {
    if (this.config.loop) {
      this.timer = setTimeout(() => {
        this.emitter.emit('event', { kind: 'restart' } satisfies ReplayItem)
        this.begin()
      }, LOOP_GAP_MS)
      return
    }
    this.stopped = true
    this.status('stopped', `Replay finished (${this.items.length} records)`)
  }
}

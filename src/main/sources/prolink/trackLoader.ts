import type { DeckId } from '@shared/types'
import type { SessionContext } from './context'
import type { ProlinkDeckStatus } from './rawTypes'
import { SnapshotPublisher } from './snapshots'
import { trackKey } from './trackKey'
import {
  fetchTrack,
  Unavailable,
  type Loaded,
  type TrackLoaderDeps,
  type TrackLookupResult
} from './trackFetch'
import type { Fields } from './fields'
import type { BuiltTrack } from './trackMapper'

export type { TrackLoaderDeps, TrackLookupResult }

export interface TrackLoaderOptions {
  cacheSize?: number
  retryMs?: number
  maxAttempts?: number
}

type CacheEntry = { ok: true; loaded: Loaded } | { ok: false; message: string; at: number }

/** Loads metadata, cues, waveform and phrases when a deck's track changes, with a cache. */
export class TrackLoader {
  private readonly current = new Map<DeckId, string | null>()
  private readonly built = new Map<DeckId, BuiltTrack>()
  private readonly cache = new Map<string, CacheEntry>()
  private readonly retries = new Set<NodeJS.Timeout>()
  private readonly cacheSize: number
  private readonly retryMs: number
  private readonly maxAttempts: number
  private readonly snapshots: SnapshotPublisher

  constructor(
    private readonly deps: TrackLoaderDeps,
    private readonly ctx: SessionContext,
    options: TrackLoaderOptions = {}
  ) {
    this.snapshots = new SnapshotPublisher(ctx)
    this.cacheSize = options.cacheSize ?? 100
    this.retryMs = options.retryMs ?? 15_000
    this.maxAttempts = options.maxAttempts ?? 3
  }

  stop(): void {
    this.retries.forEach(clearTimeout)
    this.retries.clear()
  }

  /** Beat grid lookup of the track on a deck, or null until its analysis has loaded. */
  beatToMs(deck: DeckId): ((beat: number) => number | null) | null {
    return this.built.get(deck)?.beatToMs ?? null
  }

  /** Call for every status packet; only a change of loaded track starts work. */
  onStatus(deck: DeckId, status: ProlinkDeckStatus): void {
    const key = trackKey(status)
    if (this.current.has(deck) && this.current.get(deck) === key) return
    this.current.set(deck, key)
    this.built.delete(deck)
    if (key === null) {
      this.snapshot(deck, { state: 'no track loaded' })
      this.ctx.emit({ kind: 'track', ts: this.ctx.now(), deck, track: null })
      this.ctx.emit({ kind: 'trackStatus', ts: this.ctx.now(), deck, state: 'idle' })
      return
    }
    void this.load(deck, key, status, 1)
  }

  private snapshot(deck: DeckId, fields: Fields): void {
    this.snapshots.publish(`eth.track.${deck}`, `Deck ${deck}: track metadata`, fields)
  }

  private publish(deck: DeckId, loaded: Loaded): void {
    const { built } = loaded
    const ts = this.ctx.now()
    this.built.set(deck, built)
    this.snapshot(deck, loaded.details)
    this.ctx.emit({ kind: 'track', ts, deck, track: built.info })
    const message = built.missing.length
      ? `Partial metadata: ${built.missing.join(', ')} unavailable`
      : undefined
    this.ctx.emit({ kind: 'trackStatus', ts, deck, state: 'ready', message })
  }

  private async load(
    deck: DeckId,
    key: string,
    status: ProlinkDeckStatus,
    attempt: number
  ): Promise<void> {
    const cached = this.cache.get(key)
    if (cached?.ok) return this.publish(deck, cached.loaded)
    const emitStatus = (state: 'loading' | 'unavailable', message?: string): void => {
      this.snapshot(deck, { state, key, ...(message ? { reason: message } : {}) })
      this.ctx.emit({ kind: 'trackStatus', ts: this.ctx.now(), deck, state, message })
    }
    if (cached && this.ctx.now() - cached.at < this.retryMs)
      return emitStatus('unavailable', cached.message)

    emitStatus('loading')
    try {
      const loaded = await fetchTrack(this.deps, this.ctx, key, status)
      this.remember(key, { ok: true, loaded })
      if (this.current.get(deck) === key) this.publish(deck, loaded)
    } catch (error) {
      const message =
        error instanceof Unavailable ? error.message : `Metadata lookup failed: ${String(error)}`
      this.remember(key, { ok: false, message, at: this.ctx.now() })
      if (this.current.get(deck) !== key) return
      this.ctx.log('warn', `deck ${deck} track ${key}: ${message}`)
      emitStatus('unavailable', message)
      if (attempt < this.maxAttempts) {
        const quick = error instanceof Unavailable && error.transient
        this.scheduleRetry(
          deck,
          key,
          status,
          attempt + 1,
          quick ? Math.min(this.retryMs, 1500) : this.retryMs
        )
      }
    }
  }

  private scheduleRetry(
    deck: DeckId,
    key: string,
    status: ProlinkDeckStatus,
    attempt: number,
    delayMs: number
  ): void {
    const timer = setTimeout(() => {
      this.retries.delete(timer)
      if (this.current.get(deck) !== key) return
      this.cache.delete(key)
      void this.load(deck, key, status, attempt)
    }, delayMs)
    this.retries.add(timer)
  }

  private remember(key: string, entry: CacheEntry): void {
    this.cache.delete(key)
    this.cache.set(key, entry)
    const oldest = this.cache.keys().next().value
    if (this.cache.size > this.cacheSize && oldest !== undefined) this.cache.delete(oldest)
  }
}

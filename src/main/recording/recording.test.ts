import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEvent } from '@shared/types'
import { SourceManager } from '../sourceManager'
import { parseRecording } from './parse'
import { ReplaySource } from './replaySource'
import { decodeRecord, encodeRecord, shiftTimestamps } from './serialize'

const line = (value: unknown): string => encodeRecord(value)

const deckRaw = (t: number, deck: number, over: Record<string, unknown> = {}) =>
  line({
    type: 'raw',
    t,
    source: 'simulator',
    raw: {
      kind: 'deck',
      ts: t,
      deck,
      playState: 'playing',
      trackId: `t${deck}`,
      bpm: 120,
      pitchPercent: 0,
      beatInBar: 1,
      isMaster: false,
      isSynced: false,
      isOnAir: true,
      ...over
    }
  })

const header = line({
  type: 'header',
  version: 1,
  app: 'DeckPulse',
  startedAt: 1000,
  source: 'simulator'
})

describe('serialize', () => {
  it('round-trips typed arrays and buffers', () => {
    const value = { waveform: { heights: new Uint8Array([1, 2, 250]) }, raw: Buffer.from([9, 8]) }
    const back = decodeRecord(encodeRecord(value)) as typeof value
    expect(back.waveform.heights).toBeInstanceOf(Uint8Array)
    expect([...back.waveform.heights]).toEqual([1, 2, 250])
    expect([...(back.raw as Uint8Array)]).toEqual([9, 8])
  })

  it('shifts every numeric ts without touching the original or typed arrays', () => {
    const heights = new Uint8Array([5])
    const original = { ts: 10, deck: 1, list: [{ ts: 20 }], nested: { state: { ts: 30 } }, heights }
    const moved = shiftTimestamps(original, 100)
    expect(moved).toMatchObject({
      ts: 110,
      deck: 1,
      list: [{ ts: 120 }],
      nested: { state: { ts: 130 } }
    })
    expect(moved.heights).toBe(heights)
    expect(original.ts).toBe(10)
  })
})

describe('parseRecording', () => {
  it('counts damaged lines and unknown records instead of failing', () => {
    const text = [header, deckRaw(1000, 1), '{not json', line({ type: 'nope', t: 1 }), ''].join(
      '\n'
    )
    const parsed = parseRecording(text)
    expect(parsed.header?.source).toBe('simulator')
    expect(parsed.records).toHaveLength(1)
    expect(parsed.skipped).toBe(2)
  })

  it('rejects a recording from a newer format', () => {
    expect(() => parseRecording(line({ type: 'header', version: 99 }))).toThrow(/version/)
  })
})

describe('ReplaySource', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  const run = (text: string, loop = false) => {
    const items: { kind: string; [k: string]: unknown }[] = []
    const source = new ReplaySource({ path: '/tmp/r.jsonl', loop }, { readFile: () => text })
    source.on('event', (item) => items.push(item))
    return { source, items }
  }

  it('emits records at their recorded spacing and moves timestamps to now', () => {
    const { source, items } = run([header, deckRaw(5000, 1), deckRaw(6500, 2)].join('\n'))
    source.start()
    expect(items.map((i) => i.kind)).toEqual(['status', 'raw'])
    expect(items[0]).toMatchObject({ state: 'running', recordedFrom: 'simulator' })
    expect((items[1]?.raw as { ts: number }).ts).toBe(1_000_000)
    vi.advanceTimersByTime(1499)
    expect(items).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(items.map((i) => i.kind)).toEqual(['status', 'raw', 'raw', 'status'])
    expect((items[2]?.raw as { ts: number }).ts).toBe(1_001_500)
    expect(items.at(-1)).toMatchObject({ state: 'stopped' })
    source.stop()
  })

  it('reports the end, or restarts after a gap when looping', () => {
    const text = [header, deckRaw(5000, 1), deckRaw(5100, 2)].join('\n')
    const once = run(text)
    once.source.start()
    vi.advanceTimersByTime(200)
    expect(once.items.at(-1)).toMatchObject({ kind: 'status', state: 'stopped' })

    const looped = run(text, true)
    looped.source.start()
    vi.advanceTimersByTime(1200)
    expect(looped.items.some((i) => i.kind === 'restart')).toBe(true)
    expect(looped.items.filter((i) => i.kind === 'raw').length).toBeGreaterThanOrEqual(3)
    looped.source.stop()
  })

  it('skips recorded status events and replays normalized events only when there is no raw data', () => {
    const event = (t: number, e: AppEvent) => line({ type: 'event', t, event: e })
    const text = [
      header,
      event(1, { type: 'sourceStatus', source: 'prolink', state: 'online' }),
      event(2, {
        type: 'transition',
        fromDeck: 1,
        toDeck: 2,
        confidence: 1,
        ts: 2,
        origin: 'DERIVED'
      }),
      event(3, { type: 'beat', deck: 1, beatInBar: 1, ts: 3, origin: 'ETH_LIVE' })
    ].join('\n')
    const { source, items } = run(text)
    source.start()
    expect(items.map((i) => i.kind)).toEqual(['status', 'event', 'status'])
    expect((items[1]?.event as AppEvent).type).toBe('beat')
  })

  it('reports unreadable and empty recordings as errors', () => {
    const bad = new ReplaySource(
      { path: '/nope.jsonl', loop: false },
      {
        readFile: () => {
          throw new Error('ENOENT')
        }
      }
    )
    const seen: unknown[] = []
    bad.on('event', (i) => seen.push(i))
    bad.start()
    expect(seen[0]).toMatchObject({ kind: 'status', state: 'error' })
    const empty = run(header)
    empty.source.start()
    expect(empty.items[0]).toMatchObject({ state: 'error' })
  })
})

describe('SourceManager recording and replay', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'deckpulse-rec-'))
  })
  afterEach(() => {
    vi.useRealTimers()
    rmSync(dir, { recursive: true, force: true })
  })

  it('replays raw records through the normalizer and detector as source "replay"', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)
    const text = [
      header,
      deckRaw(10_000, 1, { isMaster: true }),
      deckRaw(10_000, 2),
      deckRaw(15_000, 1, { isMaster: false }),
      deckRaw(15_000, 2, { isMaster: true })
    ].join('\n')
    const sent: AppEvent[] = []
    const manager = new SourceManager((e) => sent.push(e), {
      logDir: dir,
      recordDir: dir,
      readFile: () => text
    })
    manager.start({ source: 'replay', config: { path: '/x/rec.jsonl', loop: false } })
    vi.advanceTimersByTime(6000)
    expect(sent[0]).toMatchObject({ type: 'sourceStatus', source: 'replay', state: 'running' })
    const transition = sent.find((e) => e.type === 'transition')
    expect(transition).toMatchObject({ type: 'transition', fromDeck: 1, toDeck: 2 })
    const states = sent.filter((e) => e.type === 'deckState')
    expect(states.length).toBe(4)
    const last = states.at(-1)
    if (last?.type !== 'deckState') throw new Error('expected deckState')
    expect(last.state.playState.ts).toBe(2_005_000)
    expect(sent.at(-1)).toMatchObject({ type: 'sourceStatus', state: 'stopped' })
    const hook = sent.find((e) => e.type === 'hook')
    expect(hook).toMatchObject({ hook: { source: 'replay', simulated: true } })
    await manager.dispose()
  })

  it('records raw, normalized and ingest events to a file the parser can read back', async () => {
    const manager = new SourceManager(() => undefined, { logDir: dir, recordDir: dir })
    const path = manager.setRecording(true)
    if (!path) throw new Error('expected a path')
    manager.ingest([{ kind: 'energy', ts: 5, rms: 0.2, bands: { low: 0.1, mid: 0.2, high: 0.3 } }])
    manager.setRecording(false)
    await vi.waitFor(() => expect(readFileSync(path, 'utf8').split('\n').length).toBeGreaterThan(3))
    const parsed = parseRecording(readFileSync(path, 'utf8'))
    expect(parsed.header).toMatchObject({ app: 'DeckPulse', version: 1 })
    expect(parsed.records.map((r) => r.type)).toEqual(['ingest', 'event'])
    await manager.dispose()
  })
})

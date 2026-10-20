import type { Device, Track, fetchFile, loadAnlz } from 'alphatheta-connect'
import { describe, expect, it, vi } from 'vitest'
import { createContext } from './context'
import type { ProlinkDeckStatus, ProlinkRawEvent } from './rawTypes'
import {
  TrackLoader,
  type TrackLoaderDeps,
  type TrackLoaderOptions,
  type TrackLookupResult
} from './trackLoader'

const status = (over: Partial<ProlinkDeckStatus> = {}): ProlinkDeckStatus => ({
  deviceId: 1,
  trackId: 7,
  trackDeviceId: 1,
  trackSlot: 3,
  trackType: 1,
  playState: 3,
  isOnAir: true,
  isSync: false,
  isMaster: true,
  trackBpm: 128,
  effectivePitch: 0,
  beatInMeasure: 1,
  beat: 1,
  ...over
})

const device = { id: 1, name: 'XDJ-AZ' } as unknown as Device
const row = {
  id: 7,
  title: 'Night Drive',
  duration: 200,
  tempo: 128,
  cueAndLoops: []
} as unknown as Track

function setup(
  found: TrackLookupResult,
  overrides: Partial<TrackLoaderDeps> = {},
  options: TrackLoaderOptions = {}
) {
  const raws: ProlinkRawEvent[] = []
  const ctx = createContext(
    (r) => raws.push(r),
    () => undefined,
    () => 1000
  )
  const getDb = vi.fn<TrackLoaderDeps['findTrack']>(async () => found)
  const deps: TrackLoaderDeps = {
    getDevice: () => device,
    findTrack: getDb,
    loadAnlz: vi.fn(async () => {
      throw new Error('no analysis file')
    }) as unknown as typeof loadAnlz,
    fetchFile: vi.fn() as unknown as typeof fetchFile,
    ...overrides
  }
  const loader = new TrackLoader(deps, ctx, { retryMs: 5, maxAttempts: 1, ...options })
  const states = () =>
    raws.flatMap((r) =>
      r.kind === 'trackStatus' ? [`${r.state}${r.message ? `:${r.message}` : ''}`] : []
    )
  return { loader, raws, getDb, states }
}

const library: TrackLookupResult = { track: row, hasDb: true }
const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('TrackLoader', () => {
  it('goes loading then ready, publishing a partial track when analysis files are unreadable', async () => {
    const { loader, raws, states } = setup(library)
    loader.onStatus(1, status())
    await flush()
    expect(states()[0]).toBe('loading')
    expect(states()[1]).toContain('ready:Partial metadata: beatGrid, cues, waveform, phrases')
    const track = raws.find((r) => r.kind === 'track')
    expect(track).toMatchObject({ deck: 1, track: { id: '1:3:7', title: 'Night Drive' } })
  })

  it('does not reload a track that is already current, and serves repeats from the cache', async () => {
    const { loader, getDb } = setup(library)
    loader.onStatus(1, status())
    loader.onStatus(1, status({ beatInMeasure: 2 }))
    await flush()
    loader.onStatus(1, status({ trackId: 0 }))
    loader.onStatus(1, status())
    await flush()
    expect(getDb).toHaveBeenCalledTimes(1)
  })

  it('explains when the USB was not exported with rekordbox', async () => {
    const { loader, states } = setup({ track: null, hasDb: false })
    loader.onStatus(1, status())
    await flush()
    expect(states()).toContain(
      'unavailable:USB not exported with rekordbox: beat grid and cues unavailable'
    )
  })

  it('reports non-library media and unknown devices without touching the network', async () => {
    const unknown = setup(library, { getDevice: () => undefined })
    unknown.loader.onStatus(1, status())
    const streaming = setup(library)
    streaming.loader.onStatus(2, status({ trackType: 6 }))
    await flush()
    expect(unknown.states().join()).toContain('has not announced itself')
    expect(streaming.states().join()).toContain('Not a rekordbox library track')
    expect(streaming.getDb).not.toHaveBeenCalled()
  })

  it('passes the player BPM so the right database format is used, and logs a switch', async () => {
    const { loader, getDb, raws } = setup({ ...library, switchedTo: 'pdb' })
    loader.onStatus(1, status({ trackBpm: 133 }))
    await flush()
    expect(getDb).toHaveBeenCalledWith(1, 3, 7, 133)
    const log = raws.find((r) => r.kind === 'log')
    expect(log).toMatchObject({ level: 'info', message: expect.stringContaining('pdb') })
  })

  it('loads the rekordbox artwork as a data URL, preferring the medium thumbnail', async () => {
    const asked: string[] = []
    const fetch = vi.fn(async ({ path }: { path: string }) => {
      asked.push(path)
      if (path.endsWith('_m.jpg')) throw new Error('not on the stick')
      return Buffer.from([0xff, 0xd8, 0xff])
    })
    const withArt: TrackLookupResult = {
      hasDb: true,
      track: {
        ...row,
        artwork: { id: 1, path: '/PIONEER/Artwork/00005/a85.jpg' }
      } as unknown as Track
    }
    const { loader, raws } = setup(withArt, { fetchFile: fetch as unknown as typeof fetchFile })
    loader.onStatus(1, status())
    await flush()
    expect(asked).toEqual(['/PIONEER/Artwork/00005/a85_m.jpg', '/PIONEER/Artwork/00005/a85.jpg'])
    const track = raws.find((r) => r.kind === 'track')
    expect(track).toMatchObject({ track: { artworkUrl: 'data:image/jpeg;base64,/9j/' } })
  })

  it('leaves the artwork out when the track has none or it cannot be read', async () => {
    const { loader, raws } = setup(library)
    loader.onStatus(1, status())
    await flush()
    const track = raws.find((r) => r.kind === 'track')
    expect(track).toMatchObject({ track: { id: '1:3:7' } })
    expect((track as { track: { artworkUrl?: string } }).track.artworkUrl).toBeUndefined()
  })

  it('exposes the beat grid of the loaded track and drops it when the deck empties', async () => {
    const grid = [
      { count: 1, bpm: 128, offset: 100 },
      { count: 2, bpm: 128, offset: 569 }
    ]
    const anlz = vi.fn(async (_track: unknown, type: string) => {
      if (type !== 'DAT') throw new Error('no file')
      return { beatGrid: grid }
    })
    const { loader } = setup(library, { loadAnlz: anlz as unknown as typeof loadAnlz })
    expect(loader.beatToMs(1)).toBeNull()
    loader.onStatus(1, status())
    await flush()
    expect(loader.beatToMs(1)?.(2)).toBe(569)
    expect(loader.beatToMs(1)?.(3)).toBeNull()
    loader.onStatus(1, status({ trackId: 0 }))
    expect(loader.beatToMs(1)).toBeNull()
  })

  it('retries soon when the device holding the track has not announced itself yet', async () => {
    let calls = 0
    const { loader, states } = setup(
      library,
      { getDevice: () => (calls++ === 0 ? undefined : device) },
      { maxAttempts: 2 }
    )
    loader.onStatus(1, status())
    await flush()
    expect(states().some((s) => s.startsWith('unavailable:Device 1 holding'))).toBe(true)
    expect(states().some((s) => s.startsWith('ready'))).toBe(true)
  })

  it('emits an unloaded track when the deck empties', () => {
    const { loader, raws } = setup(library)
    loader.onStatus(1, status({ trackId: 0 }))
    expect(raws.map((r) => r.kind)).toEqual(['inspector', 'track', 'trackStatus'])
  })

  it('publishes every library field and the analysis summary as a snapshot', async () => {
    const { loader, raws } = setup(library)
    loader.onStatus(1, status())
    await flush()
    const snapshots = raws.flatMap((r) =>
      r.kind === 'inspector' && r.event.type === 'dataSnapshot' ? [r.event] : []
    )
    expect(snapshots.map((s) => s.fields.state)).toEqual(['loading', 'ready'])
    expect(snapshots[1]).toMatchObject({
      group: 'eth.track.1',
      fields: {
        title: 'Night Drive',
        duration: 200,
        tempo: 128,
        'analysis.DAT': 'not available',
        'analysis.unavailable': 'beatGrid, cues, waveform, phrases'
      }
    })
  })
})

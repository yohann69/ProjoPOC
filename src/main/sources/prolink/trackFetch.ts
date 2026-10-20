import type { Device, MediaSlot, loadAnlz, fetchFile } from 'alphatheta-connect'
import type { Track } from 'onelibrary-connect'
import type { SessionContext } from './context'
import type { Fields } from './fields'
import type { ProlinkDeckStatus } from './rawTypes'
import { trackDetails } from './trackDetails'
import { buildTrackInfo, type BuiltTrack } from './trackMapper'

/** Values of alphatheta-connect's TrackType.RB and MediaSlot.SD / MediaSlot.USB. */
const TRACK_TYPE_RB = 1
const SLOT_SD = 2
const SLOT_USB = 3
const DB_TIMEOUT_MS = 120_000

export interface TrackLookupResult {
  track: Track | null
  /** False when the media has no rekordbox export at all. */
  hasDb: boolean
  /** Set when the lookup moved to the slot's other database format. */
  switchedTo?: string | null
}

export interface TrackLoaderDeps {
  getDevice(id: number): Device | undefined
  /**
   * Finds the track in the slot's database. `trackBpm` is the player's own unpitched BPM, used to
   * detect a database whose track ids belong to another number space (export.pdb vs OneLibrary).
   */
  findTrack(
    deviceId: number,
    slot: number,
    trackId: number,
    trackBpm: number | null
  ): Promise<TrackLookupResult>
  loadAnlz: typeof loadAnlz
  fetchFile: typeof fetchFile
}

export interface Loaded {
  built: BuiltTrack
  details: Fields
}

export class Unavailable extends Error {
  constructor(
    message: string,
    /** The cause is expected to clear within seconds, e.g. a device that has not announced itself yet. */
    readonly transient = false
  ) {
    super(message)
  }
}

const settle = <T>(promise: Promise<T>): Promise<T | null> =>
  promise.then(
    (v) => v,
    () => null
  )

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Unavailable(`${what} timed out after ${ms / 1000}s`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** The medium rekordbox thumbnail (`a85_m.jpg`), else the small one, as a data URL. */
async function loadArtwork(
  path: string | undefined,
  resolver: (path: string) => Promise<Buffer>
): Promise<string | undefined> {
  if (!path) return undefined
  const medium = path.replace(/(\.\w+)$/, '_m$1')
  const bytes = (await settle(resolver(medium))) ?? (await settle(resolver(path)))
  return bytes && bytes.length > 0
    ? `data:image/jpeg;base64,${bytes.toString('base64')}`
    : undefined
}

/** Reads one track's library row, analysis files and artwork from the media; throws Unavailable with the reason. */
export async function fetchTrack(
  deps: TrackLoaderDeps,
  ctx: SessionContext,
  key: string,
  s: ProlinkDeckStatus
): Promise<Loaded> {
  if (s.trackType !== TRACK_TYPE_RB) {
    throw new Unavailable(
      `Not a rekordbox library track (track type ${s.trackType}): beat grid, cues and waveform unavailable`
    )
  }
  if (s.trackSlot !== SLOT_SD && s.trackSlot !== SLOT_USB) {
    throw new Unavailable(`Media slot ${s.trackSlot} cannot be read over the network`)
  }
  const device = deps.getDevice(s.trackDeviceId)
  if (!device)
    throw new Unavailable(
      `Device ${s.trackDeviceId} holding the track has not announced itself`,
      true
    )
  const found = await withTimeout(
    deps.findTrack(s.trackDeviceId, s.trackSlot, s.trackId, s.trackBpm),
    DB_TIMEOUT_MS,
    'Library download'
  )
  if (!found.hasDb)
    throw new Unavailable('USB not exported with rekordbox: beat grid and cues unavailable')
  const track = found.track
  if (!track)
    throw new Unavailable(`Track ${s.trackId} is not in the rekordbox library on that media`)
  if (found.switchedTo) {
    ctx.log(
      'info',
      `track ${key}: the player's BPM matched the ${found.switchedTo} database, which is now used for this media`
    )
  }
  const slot = s.trackSlot as MediaSlot.SD | MediaSlot.USB
  const resolver = (path: string): Promise<Buffer> => deps.fetchFile({ device, slot, path })
  const [dat, ext, ex2, artworkUrl] = await Promise.all([
    settle(deps.loadAnlz(track, 'DAT', resolver)),
    settle(deps.loadAnlz(track, 'EXT', resolver)),
    settle(deps.loadAnlz(track, '2EX', resolver)),
    settle(loadArtwork(track.artwork?.path, resolver))
  ])
  const analysis = { dat, ext, ex2 }
  const built = buildTrackInfo(
    key,
    { ...track, beatGrid: null, waveformHd: null },
    analysis,
    artworkUrl ?? undefined
  )
  return { built, details: trackDetails(track, analysis, built, artworkUrl != null) }
}

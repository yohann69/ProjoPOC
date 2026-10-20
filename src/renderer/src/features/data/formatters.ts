import type { FieldValue } from '@shared/types'
import { formatBpm, formatMs } from '../../lib/format'

export interface Spec {
  key: string
  label: string
  /** Returns the text to show; an empty string hides the row. */
  fmt?: (value: FieldValue) => string
}

export interface Row {
  key: string
  label: string
  text: string
}

const n = (v: FieldValue): number => (typeof v === 'number' ? v : Number(v))

/** `3 (playing)` becomes `playing`. */
const named = (v: FieldValue): string => String(v).replace(/^-?\d+ \((.*)\)$/, '$1')
const yesNo = (v: FieldValue): string => (v === true || v === 'true' ? 'yes' : 'no')
const pitch = (v: FieldValue): string =>
  n(v) <= -100 ? 'n/a' : `${n(v) >= 0 ? '+' : '\u2212'}${Math.abs(n(v)).toFixed(2)}%`
const mmss = (v: FieldValue): string =>
  `${Math.floor(n(v) / 60)}:${String(Math.floor(n(v) % 60)).padStart(2, '0')}`
const positive =
  (fmt: (v: FieldValue) => string) =>
  (v: FieldValue): string =>
    n(v) > 0 ? fmt(v) : ''
const date = (v: FieldValue): string =>
  String(v).replace('T00:00:00.000Z', '').replace('T', ' ').slice(0, 19)
const megabytes = (v: FieldValue): string => `${(n(v) / 1_048_576).toFixed(1)} MB`
const gigabytes = (v: FieldValue): string => `${(n(v) / 1e9).toFixed(1)} GB`

export const STATUS_PLAYBACK: Spec[] = [
  { key: 'playState', label: 'Play state', fmt: named },
  { key: 'trackBPM', label: 'Track BPM', fmt: (v) => formatBpm(n(v)) },
  { key: 'effectivePitch', label: 'Pitch', fmt: pitch },
  { key: 'sliderPitch', label: 'Pitch fader', fmt: pitch },
  { key: 'derived.positionMs', label: 'Position', fmt: (v) => formatMs(n(v)) },
  { key: 'beat', label: 'Beat counter' },
  { key: 'beatInMeasure', label: 'Beat in bar', fmt: positive(String) },
  { key: 'beatsUntilCue', label: 'Beats until cue' }
]

export const STATUS_SOURCE: Spec[] = [
  { key: 'trackSlot', label: 'Media', fmt: named },
  { key: 'trackType', label: 'Track type', fmt: named },
  { key: 'trackDeviceId', label: 'Loaded from player' },
  { key: 'trackId', label: 'Track id', fmt: positive(String) },
  { key: 'deviceId', label: 'Player number' }
]

export const FLAGS: Spec[] = [
  { key: 'isOnAir', label: 'On air' },
  { key: 'isMaster', label: 'Master' },
  { key: 'isSync', label: 'Sync' },
  { key: 'isBpmSync', label: 'BPM sync' },
  { key: 'isEmergencyMode', label: 'Emergency' }
]

export const TRACK_LIBRARY: Spec[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist.name', label: 'Artist' },
  { key: 'album.name', label: 'Album' },
  { key: 'genre.name', label: 'Genre' },
  { key: 'key.name', label: 'Key' },
  { key: 'label.name', label: 'Label' },
  { key: 'color.name', label: 'Colour' },
  { key: 'originalArtist.name', label: 'Original artist' },
  { key: 'remixer.name', label: 'Remixer' },
  { key: 'composer.name', label: 'Composer' },
  { key: 'mixName', label: 'Mix' },
  { key: 'year', label: 'Year', fmt: positive(String) },
  { key: 'releaseDate', label: 'Release date', fmt: date },
  { key: 'rating', label: 'Rating', fmt: (v) => (n(v) > 0 ? `${n(v)} / 5` : '') },
  { key: 'playCount', label: 'Play count' },
  { key: 'trackNumber', label: 'Track number', fmt: positive(String) },
  { key: 'discNumber', label: 'Disc number', fmt: positive(String) },
  { key: 'comment', label: 'Comment' }
]

export const TRACK_FILE: Spec[] = [
  { key: 'duration', label: 'Duration', fmt: mmss },
  { key: 'tempo', label: 'Library BPM', fmt: (v) => formatBpm(n(v)) },
  { key: 'bitrate', label: 'Bitrate', fmt: (v) => `${v} kbps` },
  { key: 'sampleRate', label: 'Sample rate', fmt: (v) => `${(n(v) / 1000).toFixed(1)} kHz` },
  { key: 'sampleDepth', label: 'Bit depth', fmt: (v) => `${v}-bit` },
  { key: 'fileSize', label: 'File size', fmt: megabytes },
  { key: 'fileName', label: 'File name' },
  { key: 'filePath', label: 'Path on the media' },
  { key: 'analyzePath', label: 'Analysis file' },
  { key: 'dateAdded', label: 'Added', fmt: date },
  { key: 'analyzeDate', label: 'Analysed', fmt: date }
]

export const TRACK_ANALYSIS: Spec[] = [
  { key: 'analysis.beatGrid.beats', label: 'Beats in the grid' },
  { key: 'analysis.cues', label: 'Cues' },
  { key: 'analysis.loops', label: 'Loops' },
  { key: 'analysis.phrases', label: 'Phrases' },
  { key: 'analysis.waveformPreview.bytes', label: 'Waveform preview (columns)' },
  { key: 'analysis.waveform3Band.entries', label: '3-band waveform (entries)' },
  { key: 'analysis.DAT', label: 'DAT file' },
  { key: 'analysis.EXT', label: 'EXT file' },
  { key: 'analysis.2EX', label: '2EX file' },
  { key: 'analysis.unavailable', label: 'Missing' },
  { key: 'artwork.read', label: 'Artwork read', fmt: yesNo },
  { key: 'artwork.path', label: 'Artwork file' }
]

export const DEVICE_SPECS: Spec[] = [
  { key: 'name', label: 'Name' },
  { key: 'id', label: 'Player number' },
  { key: 'type', label: 'Role', fmt: named },
  { key: 'ip', label: 'Address' },
  { key: 'mac', label: 'MAC address' },
  { key: 'deck', label: 'Deck', fmt: (v) => `Deck ${v}` },
  { key: 'lastActive', label: 'Last active', fmt: date }
]

export const MEDIA_SPECS: Spec[] = [
  { key: 'name', label: 'Name' },
  { key: 'slot', label: 'Slot', fmt: named },
  { key: 'deviceId', label: 'Player' },
  { key: 'color', label: 'Colour', fmt: named },
  { key: 'tracksType', label: 'Contents', fmt: named },
  { key: 'trackCount', label: 'Tracks' },
  { key: 'playlistCount', label: 'Playlists' },
  { key: 'freeBytes', label: 'Free space', fmt: gigabytes },
  { key: 'totalBytes', label: 'Total space', fmt: gigabytes },
  { key: 'createdDate', label: 'Created', fmt: date }
]

const present = (v: FieldValue | undefined): v is FieldValue =>
  v !== null && v !== undefined && v !== ''

/** `analysis.beatGrid.beats` becomes `Analysis beat grid beats`. */
export function humanize(key: string): string {
  const words = key
    .replace(/\./g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function plain(v: FieldValue): string {
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}

/** The rows of one group that have a value; marks the keys it used so the rest can go under "Other". */
export function rowsFor(
  fields: Record<string, FieldValue>,
  specs: Spec[],
  used: Set<string>
): Row[] {
  const rows: Row[] = []
  for (const spec of specs) {
    used.add(spec.key)
    const value = fields[spec.key]
    if (!present(value)) continue
    const text = spec.fmt ? spec.fmt(value) : plain(value)
    if (text !== '') rows.push({ key: spec.key, label: spec.label, text })
  }
  return rows
}

/** Every remaining field that has a value, so nothing the source sent is left out. */
export function otherRows(fields: Record<string, FieldValue>, used: Set<string>): Row[] {
  return Object.entries(fields)
    .filter(([key, value]) => {
      if (used.has(key) || !present(value)) return false
      return !(
        key.endsWith('.id') &&
        (`${key.slice(0, -3)}.name` in fields || `${key.slice(0, -3)}.path` in fields)
      )
    })
    .map(([key, value]) => ({ key, label: humanize(key), text: plain(value) }))
}

import type {
  AnlzResponse2EX,
  AnlzResponseDAT,
  AnlzResponseEXT,
  ExtendedCue,
  SongStructure,
  Track
} from 'alphatheta-connect'
import type { Cue, Loop, Phrase, PhraseKind, TrackInfo, Waveform } from '@shared/types'

export interface TrackAnalysis {
  dat: AnlzResponseDAT | null
  ext: AnlzResponseEXT | null
  ex2: AnlzResponse2EX | null
}

export interface BuiltTrack {
  info: TrackInfo
  /** Parts of the track that could not be read, e.g. `beatGrid`, `cues`, `waveform`, `phrases`. */
  missing: string[]
  /** Time of a beat (1-based) on the beat grid, for turning the player's beat counter into a position. */
  beatToMs: (beat: number) => number | null
}

/** PWAV preview columns pack 5 bits of height whose maximum is 25 (alphatheta-connect USB_EXPORT.md). */
const PWAV_MAX_HEIGHT = 25
const HOT_CUE_LETTERS = 'ABCDEFGHIJKLMNOP'

const hex = (n: number): string => n.toString(16).padStart(2, '0')

function phraseKind(type: string): PhraseKind {
  const name = type.toLowerCase()
  for (const kind of ['intro', 'verse', 'bridge', 'chorus', 'outro', 'up', 'down'] as const) {
    if (name.startsWith(kind)) return kind
  }
  return 'other'
}

function cuesFromExtended(cues: ExtendedCue[]): { cues: Cue[]; loops: Loop[] } {
  const result: { cues: Cue[]; loops: Loop[] } = { cues: [], loops: [] }
  for (const cue of cues) {
    const label = cue.comment || (cue.hotCue > 0 ? HOT_CUE_LETTERS[cue.hotCue - 1] : undefined)
    if (cue.type === 2 && cue.loopTime !== undefined) {
      result.loops.push({ startMs: cue.time, endMs: cue.loopTime, label })
    }
    const color =
      cue.colorRgb && `#${hex(cue.colorRgb.r)}${hex(cue.colorRgb.g)}${hex(cue.colorRgb.b)}`
    result.cues.push({
      type: cue.hotCue > 0 ? 'hot' : 'memory',
      positionMs: cue.time,
      color,
      label
    })
  }
  return result
}

function cuesFromLibrary(track: Track): { cues: Cue[]; loops: Loop[] } {
  const result: { cues: Cue[]; loops: Loop[] } = { cues: [], loops: [] }
  for (const entry of track.cueAndLoops ?? []) {
    const hot = entry.type === 'hot_cue' || entry.type === 'hot_loop'
    const label = entry.label || ('button' in entry ? HOT_CUE_LETTERS[entry.button - 1] : undefined)
    result.cues.push({ type: hot ? 'hot' : 'memory', positionMs: entry.offset, label })
    if ('length' in entry) {
      result.loops.push({ startMs: entry.offset, endMs: entry.offset + entry.length, label })
    }
  }
  return result
}

function buildWaveform(
  dat: AnlzResponseDAT | null,
  ex2: AnlzResponse2EX | null
): Waveform | undefined {
  const preview = dat?.waveformPreview?.data
  const bands = ex2?.waveform3BandPreview
  if (!preview && !bands) return undefined
  const heights = Uint8Array.from(preview ?? [], (byte) =>
    Math.min(255, Math.round(((byte & 0x1f) / PWAV_MAX_HEIGHT) * 255))
  )
  if (!bands) return { heights }
  const split = (offset: number): Uint8Array =>
    Uint8Array.from({ length: bands.numEntries }, (_, i) => bands.data[i * 3 + offset] ?? 0)
  return { heights, bands: { low: split(0), mid: split(1), high: split(2) } }
}

function buildPhrases(
  structure: SongStructure | null,
  beatToMs: (beat: number) => number
): Phrase[] {
  if (!structure) return []
  const starts = structure.phrases.map((p) => p.beat)
  return structure.phrases.map((p, i) => ({
    startMs: beatToMs(p.beat),
    endMs: beatToMs(starts[i + 1] ?? structure.endBeat),
    kind: phraseKind(p.phraseType)
  }))
}

/** Combines the library row and the ANLZ analysis files into the unified TrackInfo. */
export function buildTrackInfo(
  id: string,
  track: Track,
  analysis: TrackAnalysis,
  artworkUrl?: string
): BuiltTrack {
  const missing: string[] = []
  const grid = analysis.dat?.beatGrid ?? null
  const firstBeat = grid?.find((beat) => beat.count === 1) ?? grid?.[0]
  if (!firstBeat) missing.push('beatGrid')
  const bpm = firstBeat?.bpm ?? track.tempo
  const firstBeatMs = firstBeat?.offset ?? 0
  const beatToMs = (beat: number): number =>
    grid?.[beat - 1]?.offset ?? firstBeatMs + ((beat - 1) * 60000) / (bpm || 1)

  const extended = analysis.ext?.extendedCues
  const { cues, loops } = extended ? cuesFromExtended(extended) : cuesFromLibrary(track)
  if (cues.length === 0 && loops.length === 0) missing.push('cues')
  const waveform = buildWaveform(analysis.dat, analysis.ex2)
  if (!waveform) missing.push('waveform')
  const phrases = buildPhrases(analysis.ext?.songStructure ?? null, beatToMs)
  if (phrases.length === 0) missing.push('phrases')

  return {
    missing,
    beatToMs: (beat) => (grid ? (grid[beat - 1]?.offset ?? null) : null),
    info: {
      id,
      title: track.title,
      artist: track.artist?.name ?? '',
      album: track.album?.name ?? '',
      key: track.key?.name ?? '',
      genre: track.genre?.name ?? '',
      durationMs: track.duration * 1000,
      bpmGrid: { bpm, firstBeatMs },
      ...(artworkUrl ? { artworkUrl } : {}),
      cues,
      loops,
      waveform,
      phrases
    }
  }
}

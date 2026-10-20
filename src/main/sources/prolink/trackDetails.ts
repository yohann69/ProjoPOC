import { flatten, type Fields } from './fields'
import type { BuiltTrack, TrackAnalysis } from './trackMapper'

/** Everything known about a loaded track: the library row plus a summary of each analysis file. */
export function trackDetails(
  track: object,
  analysis: TrackAnalysis,
  built: BuiltTrack,
  artworkRead: boolean
): Fields {
  const { dat, ext, ex2 } = analysis
  const { info } = built
  return {
    state: 'ready',
    ...flatten(track),
    'analysis.DAT': dat ? 'read' : 'not available',
    'analysis.EXT': ext ? 'read' : 'not available',
    'analysis.2EX': ex2 ? 'read' : 'not available',
    'analysis.beatGrid.beats': dat?.beatGrid?.length ?? null,
    'analysis.waveformPreview.bytes': dat?.waveformPreview?.data?.length ?? null,
    'analysis.waveform3Band.entries': ex2?.waveform3BandPreview?.numEntries ?? null,
    'analysis.cues': info.cues.length,
    'analysis.loops': info.loops.length,
    'analysis.phrases': info.phrases.length,
    'analysis.unavailable': built.missing.join(', ') || 'none',
    'artwork.read': artworkRead
  }
}

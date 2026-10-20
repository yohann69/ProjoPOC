import type { Origin, SourceId } from './types'

export type CapabilityField =
  | 'playState'
  | 'bpm'
  | 'pitchPercent'
  | 'beatInBar'
  | 'beatPhase'
  | 'trackId'
  | 'isMaster'
  | 'isSynced'
  | 'isOnAir'
  | 'trackMeta'
  | 'cues'
  | 'loops'
  | 'waveform'
  | 'phrases'
  | 'position'
  | 'mixerCrossfader'
  | 'mixerChannelFader'
  | 'mixerEq'
  | 'transition'
  | 'audioEnergy'
  | 'audioOnset'
  | 'audioDrop'

/** A missing field means the source cannot provide it. The value is the origin it would carry. */
export type CapabilityMap = Partial<Record<CapabilityField, Origin>>

const LIVE_DECK_FIELDS = {
  playState: 'ETH_LIVE',
  bpm: 'ETH_LIVE',
  pitchPercent: 'ETH_LIVE',
  beatInBar: 'ETH_LIVE',
  trackId: 'ETH_LIVE',
  isMaster: 'ETH_LIVE',
  isSynced: 'ETH_LIVE',
  isOnAir: 'ETH_LIVE',
  beatPhase: 'DERIVED',
  transition: 'DERIVED'
} as const satisfies CapabilityMap

const LIBRARY_FIELDS = {
  trackMeta: 'ETH_LIBRARY',
  cues: 'ETH_LIBRARY',
  waveform: 'ETH_LIBRARY',
  phrases: 'ETH_LIBRARY'
} as const satisfies CapabilityMap

const MIXER_FIELDS = {
  mixerCrossfader: 'USBC',
  mixerChannelFader: 'USBC',
  mixerEq: 'USBC'
} as const satisfies CapabilityMap

// The simulator imitates every real source, so it reports the origin the real source would use.
// The prolink and usbc entries follow the product brief; usbc only delivers what the user mapped.
export const CAPABILITIES: Record<SourceId, CapabilityMap> = {
  simulator: {
    ...LIVE_DECK_FIELDS,
    ...LIBRARY_FIELDS,
    ...MIXER_FIELDS,
    loops: 'ETH_LIBRARY',
    position: 'ETH_LIVE'
  },
  prolink: { ...LIVE_DECK_FIELDS, ...LIBRARY_FIELDS, position: 'DERIVED' },
  usbc: { ...MIXER_FIELDS },
  audio: { audioEnergy: 'DERIVED', audioOnset: 'DERIVED', audioDrop: 'DERIVED' },
  // A recording can hold any of the others, so nothing is declared absent up front.
  replay: {
    ...LIVE_DECK_FIELDS,
    ...LIBRARY_FIELDS,
    ...MIXER_FIELDS,
    loops: 'ETH_LIBRARY',
    position: 'ETH_LIVE'
  }
}

/** Origin of a field given the active sources, or null if none of them can provide it. */
export function originFor(sources: readonly SourceId[], field: CapabilityField): Origin | null {
  for (const source of sources) {
    const origin = CAPABILITIES[source][field]
    if (origin) return origin
  }
  return null
}

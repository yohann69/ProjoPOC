import type { ProlinkDeckStatus } from './rawTypes'

/** Identifies a loaded track across media; null when the deck is empty. Also used as TrackInfo.id. */
export function trackKey(
  s: Pick<ProlinkDeckStatus, 'trackId' | 'trackDeviceId' | 'trackSlot'>
): string | null {
  return s.trackId === 0 ? null : `${s.trackDeviceId}:${s.trackSlot}:${s.trackId}`
}

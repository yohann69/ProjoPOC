import type { PlayState } from '@shared/types'

/** Codes of alphatheta-connect's CDJStatus.PlayState. */
const EMPTY = 0
const PLAYING = 3
const LOOPING = 4
const CUED = 6
const CUING = 7

export const isPlayingCode = (code: number): boolean => code === PLAYING || code === LOOPING

/** Unknown codes (the XDJ-AZ is unverified) map to paused; the raw code stays visible in the packet log. */
export function unifiedPlayState(code: number): PlayState {
  if (code === EMPTY) return 'empty'
  if (isPlayingCode(code)) return 'playing'
  if (code === CUED || code === CUING) return 'cued'
  return 'paused'
}

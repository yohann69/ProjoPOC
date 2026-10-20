const pad = (n: number): string => String(n).padStart(2, '0')

/** BPM with 1 or 2 decimals. */
export const formatBpm = (bpm: number, decimals: 1 | 2 = 2): string => bpm.toFixed(decimals)

export const formatPitch = (percent: number): string =>
  `${percent < 0 ? '\u2212' : '+'}${Math.abs(percent).toFixed(2)}%`

/** Milliseconds as mm:ss.t (tenths of a second). */
export function formatMs(ms: number): string {
  const tenths = Math.floor(Math.abs(ms) / 100)
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor(tenths / 10) % 60
  return `${ms < 0 ? '-' : ''}${pad(minutes)}:${pad(seconds)}.${tenths % 10}`
}

/** Age of a value, e.g. `38 ms`, `1.2 s`, `3 min`. */
export function formatAge(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.round(ms / 60_000)} min`
}

export const formatPacketRate = (perSecond: number): string =>
  perSecond >= 100 ? `${Math.round(perSecond)}/s` : `${perSecond.toFixed(1)}/s`

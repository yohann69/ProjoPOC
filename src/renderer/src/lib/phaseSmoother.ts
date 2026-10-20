/** Time constant for decaying the correction applied when a beat arrives early or late. */
const TAU_MS = 140
/** After this many beat periods without a beat the phase is considered stale (playback stopped). */
const STALE_PERIODS = 2.2

const frac = (x: number): number => ((x % 1) + 1) % 1
const wrapSigned = (x: number): number => x - Math.round(x)

/**
 * Beat phase (0..1) interpolated between beat packets from BPM and the last beat time. A new beat
 * does not jump the display: the difference is kept as an offset that fades out.
 */
export class PhaseSmoother {
  private lastBeatTs = -Infinity
  private periodMs = 0
  private offset = 0
  private offsetAt = 0

  /** Updates the tempo between beats (e.g. pitch moves). */
  setPeriod(periodMs: number): void {
    if (periodMs > 0) this.periodMs = periodMs
  }

  onBeat(ts: number, periodMs: number, now: number): void {
    const before = this.phase(now)
    this.lastBeatTs = ts
    this.setPeriod(periodMs)
    this.offset = before === null ? 0 : wrapSigned(before - (now - ts) / this.periodMs)
    this.offsetAt = now
  }

  /** Phase at `now`, or null when no beats are arriving. */
  phase(now: number): number | null {
    if (this.periodMs <= 0 || now - this.lastBeatTs > this.periodMs * STALE_PERIODS) return null
    const decayed = this.offset * Math.exp(-(now - this.offsetAt) / TAU_MS)
    return frac((now - this.lastBeatTs) / this.periodMs + decayed)
  }

  reset(): void {
    this.lastBeatTs = -Infinity
    this.offset = 0
  }
}

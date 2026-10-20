import type { Bands } from './bands'

export type DropEvent = 'buildup' | 'drop'

const BASS_TAU_MS = 6000
const FAST_TAU_MS = 200
const UPPER_TAU_MS = 300
const BUILD_TAU_MS = 2000
/** Bass counts as gone below this share of its long-term level. */
const BREAKDOWN_RATIO = 0.5
const MIN_BASS_REF = 0.3
const MIN_BREAKDOWN_MS = 1500
const MIN_UPPER_RISE = 0.05
const DROP_JUMP = 0.25
const COOLDOWN_MS = 8000
const MAX_BUILDUP_MS = 30_000

const alpha = (dtMs: number, tauMs: number): number => 1 - Math.exp(-dtMs / tauMs)

/**
 * Buildup: the bass stays well below its long-term level for 1.5 s while the upper bands rise.
 * Drop: during a buildup the bass jumps back by 0.25 or more above its level in the breakdown.
 */
export class DropDetector {
  private bassRef = 0
  private bassFast = 0
  private bassBuild = 0
  private upper = 0
  private lastTs: number | null = null
  private breakdownMs = 0
  private upperAtStart = 0
  private buildupStart: number | null = null
  private lastDrop = -Infinity

  reset(): void {
    this.bassRef = this.bassFast = this.bassBuild = this.upper = 0
    this.lastTs = this.buildupStart = null
    this.breakdownMs = 0
    this.lastDrop = -Infinity
  }

  get inBuildup(): boolean {
    return this.buildupStart !== null
  }

  step(ts: number, bands: Bands): DropEvent | null {
    const first = this.lastTs === null
    const dt = this.lastTs === null ? 0 : ts - this.lastTs
    this.lastTs = ts
    const upper = (bands.mid + bands.high) / 2
    if (first) {
      this.bassRef = this.bassFast = this.bassBuild = bands.low
      this.upper = upper
      return null
    }
    const previousFast = this.bassFast
    this.bassFast += alpha(dt, FAST_TAU_MS) * (bands.low - this.bassFast)
    this.upper += alpha(dt, UPPER_TAU_MS) * (upper - this.upper)
    const gone = this.bassFast < BREAKDOWN_RATIO * this.bassRef && this.bassRef >= MIN_BASS_REF
    // The long-term reference holds still during a breakdown so it cannot fade into it.
    if (!gone && !this.inBuildup)
      this.bassRef += alpha(dt, BASS_TAU_MS) * (bands.low - this.bassRef)
    return this.inBuildup
      ? this.inBuild(ts, dt, previousFast, gone)
      : this.detectBuildup(ts, dt, gone)
  }

  private detectBuildup(ts: number, dt: number, gone: boolean): DropEvent | null {
    if (!gone) {
      this.breakdownMs = 0
      return null
    }
    if (this.breakdownMs === 0) this.upperAtStart = this.upper
    this.breakdownMs += dt
    if (
      this.breakdownMs < MIN_BREAKDOWN_MS ||
      this.upper - this.upperAtStart < MIN_UPPER_RISE ||
      ts - this.lastDrop < COOLDOWN_MS
    ) {
      return null
    }
    this.buildupStart = ts
    this.bassBuild = this.bassFast
    return 'buildup'
  }

  private inBuild(ts: number, dt: number, previousFast: number, gone: boolean): DropEvent | null {
    const start = this.buildupStart ?? ts
    const jump = this.bassFast - this.bassBuild
    if (jump >= DROP_JUMP && this.bassFast > previousFast) {
      this.endBuildup()
      this.lastDrop = ts
      return 'drop'
    }
    if (!gone || ts - start > MAX_BUILDUP_MS) this.endBuildup()
    else this.bassBuild += alpha(dt, BUILD_TAU_MS) * (this.bassFast - this.bassBuild)
    return null
  }

  private endBuildup(): void {
    this.buildupStart = null
    this.breakdownMs = 0
  }
}

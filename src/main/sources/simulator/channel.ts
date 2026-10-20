const SMOOTHING_MS = 120

/** Mixer channel whose controls glide toward their targets like a hand-moved fader. */
export class SimChannel {
  fader = 0
  eqHigh = 1
  eqMid = 1
  eqLow = 1
  faderTarget = 0
  eqLowTarget = 1

  snapFader(value: number): void {
    this.fader = value
    this.faderTarget = value
  }

  step(dtMs: number): void {
    const k = 1 - Math.exp(-dtMs / SMOOTHING_MS)
    this.fader += (this.faderTarget - this.fader) * k
    this.eqLow += (this.eqLowTarget - this.eqLow) * k
  }
}

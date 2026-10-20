const FLOOR_DB = -100
const MAX_HZ = 16000

/** Spectral flux: how much the spectrum grew since the previous frame, in dB summed over bins. */
export class SpectralFlux {
  private previous: Float32Array | null = null

  reset(): void {
    this.previous = null
  }

  step(spectrumDb: Float32Array, sampleRate: number): number {
    const bins = Math.min(
      spectrumDb.length,
      Math.floor((MAX_HZ * 2 * spectrumDb.length) / sampleRate)
    )
    const prev = this.previous
    let flux = 0
    if (prev && prev.length === spectrumDb.length) {
      for (let i = 1; i < bins; i++) {
        const now = Math.max(FLOOR_DB, spectrumDb[i] ?? FLOOR_DB)
        const before = Math.max(FLOOR_DB, prev[i] ?? FLOOR_DB)
        if (now > before) flux += now - before
      }
      flux /= bins
    }
    this.previous = Float32Array.from(spectrumDb)
    return flux
  }
}

const HISTORY = 40
const MIN_GAP_MS = 90
const SILENCE_RMS = 0.002
/** Flux in dB per bin that counts as a full-strength onset above the threshold. */
const STRENGTH_SCALE = 4

/** Picks onsets as local peaks of the flux that rise above an adaptive threshold. */
export class OnsetDetector {
  private history: number[] = []
  private prev2 = 0
  private prev1 = 0
  private prevTs = 0
  private lastOnset = -Infinity

  reset(): void {
    this.history = []
    this.prev1 = this.prev2 = 0
    this.lastOnset = -Infinity
  }

  /** Reports a peak one frame late, so the returned time is that of the peak frame. */
  step(flux: number, ts: number, rms: number): { ts: number; strength: number } | null {
    const peak = this.prev1
    const peakTs = this.prevTs
    const isPeak = peak > this.prev2 && peak >= flux
    const threshold = this.threshold()
    let found: { ts: number; strength: number } | null = null
    if (isPeak && peak > threshold && rms > SILENCE_RMS && peakTs - this.lastOnset >= MIN_GAP_MS) {
      this.lastOnset = peakTs
      found = { ts: peakTs, strength: Math.min(1, (peak - threshold) / STRENGTH_SCALE) }
    }
    this.history.push(flux)
    if (this.history.length > HISTORY) this.history.shift()
    this.prev2 = this.prev1
    this.prev1 = flux
    this.prevTs = ts
    return found
  }

  private threshold(): number {
    const n = this.history.length
    if (n < 8) return Infinity
    const mean = this.history.reduce((a, b) => a + b, 0) / n
    const variance = this.history.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    return mean + 1.5 * Math.sqrt(variance) + 0.3
  }
}

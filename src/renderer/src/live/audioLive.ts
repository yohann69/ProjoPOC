import type { Bands } from '../lib/audio/bands'

/** Latest analysis values, mutable and read by animation loops. */
export const audioLive = {
  spectrum: new Float32Array(0),
  sampleRate: 48000,
  bands: { low: 0, mid: 0, high: 0 } as Bands,
  rms: 0,
  onsetTs: 0,
  onsetStrength: 0,
  /** Onset times from the last ten seconds. */
  onsetTimes: [] as number[],
  lastTs: 0
}

export function resetAudioLive(): void {
  audioLive.spectrum = new Float32Array(0)
  audioLive.bands = { low: 0, mid: 0, high: 0 }
  audioLive.rms = 0
  audioLive.onsetTs = 0
  audioLive.onsetStrength = 0
  audioLive.onsetTimes = []
  audioLive.lastTs = 0
}

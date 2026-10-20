export interface Bands {
  low: number
  mid: number
  high: number
}

/** Band edges in Hz: bass, mids, and highs up to where most music still has energy. */
export const BAND_EDGES_HZ = { low: [20, 150], mid: [150, 2000], high: [2000, 16000] } as const

const FLOOR_DB = -90
const RANGE_DB = 70

/** Level 0..1 for a dB value: -90 dB reads 0 and -20 dB reads 1. */
export const dbToLevel = (db: number): number =>
  Math.min(1, Math.max(0, (db - FLOOR_DB) / RANGE_DB))

/** Mean power of the bins between two frequencies, as dB. */
function bandDb(
  spectrumDb: Float32Array,
  sampleRate: number,
  fromHz: number,
  toHz: number
): number {
  const binHz = sampleRate / (2 * spectrumDb.length)
  const first = Math.max(0, Math.floor(fromHz / binHz))
  const last = Math.min(spectrumDb.length - 1, Math.ceil(toHz / binHz))
  let power = 0
  for (let i = first; i <= last; i++) {
    const db = spectrumDb[i] ?? -Infinity
    power += Number.isFinite(db) ? 10 ** (db / 10) : 0
  }
  const mean = power / Math.max(1, last - first + 1)
  return mean > 0 ? 10 * Math.log10(mean) : -Infinity
}

/** Low, mid and high band levels (0..1) from an AnalyserNode's dB spectrum. */
export function bandLevels(spectrumDb: Float32Array, sampleRate: number): Bands {
  const level = (edges: readonly [number, number]): number =>
    dbToLevel(bandDb(spectrumDb, sampleRate, edges[0], edges[1]))
  return {
    low: level(BAND_EDGES_HZ.low),
    mid: level(BAND_EDGES_HZ.mid),
    high: level(BAND_EDGES_HZ.high)
  }
}

/** Root-mean-square of a time-domain block, 0..1 for full-scale input. */
export function rmsOf(samples: Float32Array): number {
  let sum = 0
  for (const x of samples) sum += x * x
  return samples.length === 0 ? 0 : Math.sqrt(sum / samples.length)
}

export const rmsToDb = (rms: number): number => (rms > 0 ? 20 * Math.log10(rms) : -Infinity)

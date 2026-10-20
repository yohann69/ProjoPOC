import type { Cue, Phrase, PhraseKind, TrackInfo, Waveform } from '@shared/types'
import { ADJECTIVES, ARTISTS, CAMELOT_KEYS, CUE_COLORS, GENRES, NOUNS } from './names'
import { between, pick, type Rng } from './rng'

export const MIN_BPM = 120
export const MAX_BPM = 150

const BEATS_PER_BAR = 4
const WAVEFORM_POINTS = 400

const STRUCTURE: readonly (readonly [PhraseKind, number])[] = [
  ['intro', 16],
  ['verse', 16],
  ['chorus', 16],
  ['drop', 32],
  ['verse', 16],
  ['chorus', 16],
  ['drop', 16],
  ['outro', 16]
]

const ENERGY: Partial<Record<PhraseKind, number>> = {
  intro: 0.35,
  verse: 0.55,
  chorus: 0.75,
  drop: 1,
  outro: 0.3
}

function buildPhrases(firstBeatMs: number, barMs: number): Phrase[] {
  let bar = 0
  return STRUCTURE.map(([kind, bars]) => {
    const phrase = {
      kind,
      startMs: firstBeatMs + bar * barMs,
      endMs: firstBeatMs + (bar + bars) * barMs
    }
    bar += bars
    return phrase
  })
}

function buildWaveform(rng: Rng, phrases: Phrase[], durationMs: number): Waveform {
  const heights = new Uint8Array(WAVEFORM_POINTS)
  const low = new Uint8Array(WAVEFORM_POINTS)
  const mid = new Uint8Array(WAVEFORM_POINTS)
  const high = new Uint8Array(WAVEFORM_POINTS)
  for (let i = 0; i < WAVEFORM_POINTS; i++) {
    const t = ((i + 0.5) / WAVEFORM_POINTS) * durationMs
    const kind = phrases.find((p) => t >= p.startMs && t < p.endMs)?.kind ?? 'outro'
    const energy = (ENERGY[kind] ?? 0.5) * between(rng, 0.7, 1)
    heights[i] = Math.round(energy * 255)
    low[i] = Math.round(energy * between(rng, 0.7, 1) * 255)
    mid[i] = Math.round(energy * between(rng, 0.4, 0.9) * 255)
    high[i] = Math.round(energy * between(rng, 0.2, 0.7) * 255)
  }
  return { heights, bands: { low, mid, high } }
}

// Cue positions stay exactly on the beat grid: the simulator starts playback from them.
function buildCues(phrases: Phrase[]): Cue[] {
  const hot: Cue[] = ['intro', 'verse', 'chorus', 'drop'].map((kind, i) => ({
    type: 'hot',
    positionMs: phrases.find((p) => p.kind === kind)?.startMs ?? 0,
    color: CUE_COLORS[i],
    label: String.fromCharCode(65 + i)
  }))
  const outroMs = phrases.find((p) => p.kind === 'outro')?.startMs ?? 0
  return [...hot, { type: 'memory', positionMs: outroMs, label: 'Outro' }]
}

/** Generates a plausible 4/4 track whose grid starts at firstBeatMs. */
export function createTrack(rng: Rng, id: string, bpm: number): TrackInfo {
  const period = 60000 / bpm
  const barMs = period * BEATS_PER_BAR
  const firstBeatMs = Math.round(between(rng, 20, 300))
  const phrases = buildPhrases(firstBeatMs, barMs)
  const durationMs = Math.round(phrases[phrases.length - 1]?.endMs ?? 0)
  const dropStart = phrases.find((p) => p.kind === 'drop')?.startMs ?? 0
  return {
    id,
    title: `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`,
    artist: pick(rng, ARTISTS),
    album: `${pick(rng, NOUNS)} EP`,
    key: pick(rng, CAMELOT_KEYS),
    genre: pick(rng, GENRES),
    durationMs,
    bpmGrid: { bpm, firstBeatMs },
    cues: buildCues(phrases),
    loops: [{ startMs: dropStart, endMs: dropStart + 4 * period, label: '4 beats' }],
    waveform: buildWaveform(rng, phrases, durationMs),
    phrases
  }
}

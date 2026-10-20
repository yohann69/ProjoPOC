import type { Phrase, PhraseKind } from '@shared/types'

/** Section colors, shared by the waveform bands and the phrase panel. */
export const PHRASE_COLORS: Record<PhraseKind, string> = {
  intro: '#38bdf8',
  verse: '#a78bfa',
  bridge: '#f472b6',
  up: '#fbbf24',
  down: '#34d399',
  chorus: '#fb923c',
  drop: '#f87171',
  outro: '#94a3b8',
  other: '#64748b'
}

/** Rough 0..1 energy of a section; an app estimate, so it is shown with the DERIVED badge. */
const ENERGY: Record<PhraseKind, number> = {
  intro: 0.25,
  verse: 0.5,
  bridge: 0.4,
  up: 0.7,
  down: 0.45,
  chorus: 0.8,
  drop: 1,
  outro: 0.2,
  other: 0.5
}

export const phraseEnergy = (kind: PhraseKind): number => ENERGY[kind]

export const phraseIndexAt = (phrases: readonly Phrase[], positionMs: number): number =>
  phrases.findIndex((p) => positionMs >= p.startMs && positionMs < p.endMs)

export interface PhraseProgress {
  current: Phrase
  next: Phrase | null
  /** Track time until the current phrase ends. */
  msToChange: number
}

export function phraseProgress(
  phrases: readonly Phrase[],
  positionMs: number
): PhraseProgress | null {
  const index = phraseIndexAt(phrases, positionMs)
  const current = phrases[index]
  if (!current) return null
  return { current, next: phrases[index + 1] ?? null, msToChange: current.endMs - positionMs }
}

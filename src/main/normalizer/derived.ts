import type { DeckId, PlayState, Tagged } from '@shared/types'

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** Values the app derives itself (origin DERIVED), shared by every source's normalizer. */
export class DerivedTracker {
  private readonly lastBeatTs = new Map<DeckId, number>()

  reset(): void {
    this.lastBeatTs.clear()
  }

  recordBeat(deck: DeckId, ts: number): void {
    this.lastBeatTs.set(deck, ts)
  }

  /** Position inside the current beat, from the last beat seen and the effective BPM. */
  beatPhase(
    deck: DeckId,
    ts: number,
    bpm: number | null | undefined,
    playState: PlayState
  ): Tagged<number> | undefined {
    const beatTs = this.lastBeatTs.get(deck)
    if (playState !== 'playing' || !bpm || beatTs === undefined) return undefined
    return { value: clamp01((ts - beatTs) / (60000 / bpm)), origin: 'DERIVED', ts }
  }
}

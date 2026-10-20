import type { DeckId } from '@shared/types'

interface Anchor {
  beat: number
  playing: boolean
  /** When the current beat (or play state) was first seen. */
  ts: number
}

/**
 * Playhead from the player's beat counter. The counter only changes on a beat, so between changes the
 * position runs on from the grid time of that beat at the pitch rate, never past the next beat.
 */
export class PositionTracker {
  private readonly anchors = new Map<DeckId, Anchor>()

  reset(deck?: DeckId): void {
    if (deck === undefined) this.anchors.clear()
    else this.anchors.delete(deck)
  }

  positionMs(
    deck: DeckId,
    beat: number | null,
    ts: number,
    playing: boolean,
    pitchPercent: number,
    beatToMs: ((beat: number) => number | null) | null
  ): number | null {
    const start = beat !== null && beat >= 1 && beatToMs ? beatToMs(beat) : null
    if (start === null || beat === null || !beatToMs) {
      this.anchors.delete(deck)
      return null
    }
    let anchor = this.anchors.get(deck)
    if (!anchor || anchor.beat !== beat || anchor.playing !== playing) {
      anchor = { beat, playing, ts }
      this.anchors.set(deck, anchor)
    }
    if (!playing) return start
    const next = beatToMs(beat + 1)
    const elapsed = Math.max(0, ts - anchor.ts) * (1 + pitchPercent / 100)
    return start + (next === null ? elapsed : Math.min(elapsed, Math.max(0, next - start)))
  }
}

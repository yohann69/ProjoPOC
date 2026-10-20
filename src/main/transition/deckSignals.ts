import type { DeckId, DeckState } from '@shared/types'

export interface DeckFacts {
  playing: boolean
  /** Null when the source does not report the on-air flag. */
  onAir: boolean | null
  master: boolean
  synced: boolean
  bpm: number | null
}

export interface DeckUpdate {
  masterMoved: { from: DeckId; to: DeckId } | null
  becameInaudible: boolean
}

const audible = (f: DeckFacts | undefined): boolean => !!f && f.playing && f.onAir !== false
const pairKey = (a: DeckId, b: DeckId): string => (a < b ? `${a}-${b}` : `${b}-${a}`)

/** Remembers what each deck was doing so a hand-off can be recognised from the deck states alone. */
export class DeckTracker {
  readonly facts = new Map<DeckId, DeckFacts>()
  readonly onAirChange = new Map<DeckId, { ts: number; to: boolean }>()
  lastMasterChange: { from: DeckId; to: DeckId; ts: number } | null = null
  private master: DeckId | null = null
  private readonly overlapStart = new Map<string, number>()
  private readonly lastOverlap = new Map<string, { start: number; end: number }>()

  reset(): void {
    this.facts.clear()
    this.onAirChange.clear()
    this.overlapStart.clear()
    this.lastOverlap.clear()
    this.lastMasterChange = null
    this.master = null
  }

  update(state: DeckState): DeckUpdate {
    const { deck } = state
    const ts = state.playState.ts
    const previous = this.facts.get(deck)
    const next: DeckFacts = {
      playing: state.playState.value === 'playing',
      onAir: state.isOnAir?.value ?? null,
      master: state.isMaster?.value ?? false,
      synced: state.isSynced?.value ?? false,
      bpm: state.bpm?.value ?? null
    }
    this.facts.set(deck, next)
    if (previous?.onAir != null && next.onAir !== null && previous.onAir !== next.onAir) {
      this.onAirChange.set(deck, { ts, to: next.onAir })
    }
    this.refreshOverlaps(deck, ts)
    return {
      masterMoved: this.moveMaster(deck, next.master, ts),
      becameInaudible: audible(previous) && !audible(next)
    }
  }

  isAudible(deck: DeckId): boolean {
    return audible(this.facts.get(deck))
  }

  /** How long both decks were audible together, counting an overlap that ended in the last 10 s. */
  overlapMs(a: DeckId, b: DeckId, ts: number): number {
    const key = pairKey(a, b)
    const start = this.overlapStart.get(key)
    if (start !== undefined) return ts - start
    const last = this.lastOverlap.get(key)
    return last && ts - last.end <= 10_000 ? last.end - last.start : 0
  }

  private moveMaster(deck: DeckId, isMaster: boolean, ts: number): DeckUpdate['masterMoved'] {
    if (!isMaster || this.master === deck) return null
    const from = this.master
    this.master = deck
    if (from === null) return null
    this.lastMasterChange = { from, to: deck, ts }
    return { from, to: deck }
  }

  private refreshOverlaps(deck: DeckId, ts: number): void {
    for (const other of this.facts.keys()) {
      if (other === deck) continue
      const key = pairKey(deck, other)
      const start = this.overlapStart.get(key)
      if (this.isAudible(deck) && this.isAudible(other)) {
        if (start === undefined) this.overlapStart.set(key, ts)
      } else if (start !== undefined) {
        this.lastOverlap.set(key, { start, end: ts })
        this.overlapStart.delete(key)
      }
    }
  }
}

import type { AppEvent, DeckId } from '@shared/types'
import { DeckTracker } from './deckSignals'
import { MixerHistory } from './mixerHistory'
import { confidenceOf, evaluateSignals, MIN_OVERLAP_MS, type AudioFacts } from './signals'

const DEDUPE_MS = 25_000

/**
 * Turns the published events into transition events. A transition is either the master flag moving
 * between decks, or one audible deck handing over to another after they overlapped. Confidence is
 * the weight of signals seen divided by the weight of signals whose data was available.
 */
export class TransitionDetector {
  private readonly decks = new DeckTracker()
  private readonly mixer = new MixerHistory()
  private readonly audio: AudioFacts = { lastEnergyTs: null, lastDropTs: null }
  private readonly emitted = new Map<string, number>()

  reset(): void {
    this.decks.reset()
    this.mixer.reset()
    this.emitted.clear()
    this.audio.lastEnergyTs = null
    this.audio.lastDropTs = null
  }

  process(event: AppEvent): AppEvent[] {
    switch (event.type) {
      case 'mixer':
        this.mixer.record(event.mixer)
        return []
      case 'energy':
        this.audio.lastEnergyTs = event.ts
        return []
      case 'drop':
        if (event.phase === 'drop') this.audio.lastDropTs = event.ts
        return []
      case 'deckState':
        return this.deckState(event.state)
      default:
        return []
    }
  }

  private deckState(state: Extract<AppEvent, { type: 'deckState' }>['state']): AppEvent[] {
    const ts = state.playState.ts
    const update = this.decks.update(state)
    if (update.masterMoved) return this.emit(update.masterMoved.from, update.masterMoved.to, ts)
    if (!update.becameInaudible) return []
    const target = this.handOverTarget(state.deck, ts)
    return target === null ? [] : this.emit(state.deck, target, ts)
  }

  private handOverTarget(from: DeckId, ts: number): DeckId | null {
    let best: DeckId | null = null
    let bestOverlap = MIN_OVERLAP_MS - 1
    for (const deck of this.decks.facts.keys()) {
      const overlap =
        deck === from || !this.decks.isAudible(deck) ? 0 : this.decks.overlapMs(from, deck, ts)
      if (overlap > bestOverlap) [best, bestOverlap] = [deck, overlap]
    }
    return best
  }

  private emit(from: DeckId, to: DeckId, ts: number): AppEvent[] {
    const key = `${from}>${to}`
    const last = this.emitted.get(key)
    if (last !== undefined && ts - last < DEDUPE_MS) return []
    this.emitted.set(key, ts)
    const signals = evaluateSignals(from, to, ts, this.decks, this.mixer, this.audio)
    const confidence = confidenceOf(signals)
    return [
      { type: 'transition', fromDeck: from, toDeck: to, confidence, ts, origin: 'DERIVED', signals }
    ]
  }
}

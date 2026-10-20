import type { HookEvent } from '@shared/hooks'
import type { AppEvent, DeckId, Phrase, SourceId } from '@shared/types'

/** A tempo move smaller than this, relative to the last announced BPM, is pitch drift and stays quiet. */
export const BPM_CHANGE_THRESHOLD = 0.5

/** Derives the visual-hook events (beat, phraseChange, transition, bpmChange, audio) from normalized events. */
export class HookEngine {
  private readonly phrases = new Map<DeckId, Phrase[]>()
  private readonly phraseIndex = new Map<DeckId, number>()
  private readonly announcedBpm = new Map<DeckId, number>()
  private readonly latestBpm = new Map<DeckId, number>()
  private readonly trackIds = new Map<DeckId, string | null>()

  constructor(
    private readonly source: SourceId,
    private readonly simulated = source === 'simulator'
  ) {}

  process(event: AppEvent): HookEvent[] {
    const base = (ts: number, origin: HookEvent['origin']) => ({
      ts,
      origin,
      source: this.source,
      simulated: this.simulated
    })
    const audio = (ts: number) => ({
      ts,
      origin: 'DERIVED' as const,
      source: 'audio' as const,
      simulated: false
    })
    switch (event.type) {
      case 'track':
        this.phrases.set(event.deck, event.track?.value.phrases ?? [])
        this.phraseIndex.set(event.deck, -1)
        return []
      case 'beat':
        return [
          {
            ...base(event.ts, event.origin),
            type: 'beat',
            deck: event.deck,
            beatInBar: event.beatInBar,
            bpm: this.latestBpm.get(event.deck) ?? null
          }
        ]
      case 'transition':
        return [
          {
            ...base(event.ts, 'DERIVED'),
            type: 'transition',
            fromDeck: event.fromDeck,
            toDeck: event.toDeck,
            confidence: event.confidence,
            signals: event.signals ?? []
          }
        ]
      case 'energy':
        return [{ ...audio(event.ts), type: 'energy', rms: event.rms, bands: event.bands }]
      case 'onset':
        return [{ ...audio(event.ts), type: 'onset', strength: event.strength }]
      case 'drop':
        return [{ ...audio(event.ts), type: 'drop', phase: event.phase }]
      case 'deckState':
        return this.deckState(event.state, base)
      default:
        return []
    }
  }

  private deckState(
    state: Extract<AppEvent, { type: 'deckState' }>['state'],
    base: (
      ts: number,
      origin: HookEvent['origin']
    ) => Pick<HookEvent, 'ts' | 'origin' | 'source' | 'simulated'>
  ): HookEvent[] {
    const { deck } = state
    const out: HookEvent[] = []
    const trackId = state.trackId?.value ?? null
    if (this.trackIds.get(deck) !== trackId) {
      this.trackIds.set(deck, trackId)
      this.announcedBpm.delete(deck)
      this.phraseIndex.set(deck, -1)
    }
    if (state.bpm) {
      const bpm = state.bpm.value
      const previous = this.announcedBpm.get(deck)
      this.latestBpm.set(deck, bpm)
      if (previous === undefined) this.announcedBpm.set(deck, bpm)
      else if (Math.abs(bpm - previous) >= BPM_CHANGE_THRESHOLD) {
        this.announcedBpm.set(deck, bpm)
        out.push({
          ...base(state.bpm.ts, 'DERIVED'),
          type: 'bpmChange',
          deck,
          bpm,
          previousBpm: previous
        })
      }
    }
    const phrases = this.phrases.get(deck) ?? []
    if (state.positionMs && phrases.length > 0) {
      const position = state.positionMs.value
      const index = phrases.findIndex((p) => position >= p.startMs && position < p.endMs)
      const previous = this.phraseIndex.get(deck) ?? -1
      const phrase = phrases[index]
      if (index !== previous) {
        this.phraseIndex.set(deck, index)
        if (phrase) {
          const rate = 1 + (state.pitchPercent?.value ?? 0) / 100
          out.push({
            ...base(state.positionMs.ts, 'DERIVED'),
            type: 'phraseChange',
            deck,
            from: phrases[previous]?.kind ?? null,
            to: phrase.kind,
            nextChangeInMs: Math.round((phrase.endMs - position) / rate)
          })
        }
      }
    }
    return out
  }
}

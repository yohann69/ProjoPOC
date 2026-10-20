import { DECK_IDS, type DeckId } from '@shared/types'

/**
 * Maps announced device numbers to decks 1-4 without assuming a model: numbers 1-4 keep their
 * own deck, any other player number takes the lowest free deck in order of first appearance.
 */
export class DeckMapper {
  private readonly decks = new Map<number, DeckId>()

  constructor(private readonly observe: (message: string) => void) {}

  deckFor(deviceNumber: number): DeckId | null {
    const known = this.decks.get(deviceNumber)
    if (known) return known
    const own = DECK_IDS.find((d) => d === deviceNumber)
    const taken = new Set(this.decks.values())
    const deck = own && !taken.has(own) ? own : DECK_IDS.find((d) => !taken.has(d))
    if (!deck) {
      this.observe(`device ${deviceNumber} sends status but all 4 decks are already mapped`)
      return null
    }
    this.decks.set(deviceNumber, deck)
    this.observe(`device number ${deviceNumber} mapped to deck ${deck}`)
    return deck
  }

  deckOf(deviceNumber: number): DeckId | undefined {
    return this.decks.get(deviceNumber)
  }
}

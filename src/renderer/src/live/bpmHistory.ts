import { DECK_IDS, type DeckId } from '@shared/types'

export const HISTORY_SECONDS = 5 * 60

/** x values in seconds, then one series per deck (null where the deck had no tempo). */
export type HistoryData = [number[], ...(number | null)[][]]

const times: number[] = []
const series: Record<DeckId, (number | null)[]> = { 1: [], 2: [], 3: [], 4: [] }

export function resetBpmHistory(): void {
  times.length = 0
  for (const deck of DECK_IDS) series[deck].length = 0
}

/** Appends one sample per deck (null for decks that are not playing) and trims to five minutes. */
export function sampleBpm(nowMs: number, bpmByDeck: Record<DeckId, number | null>): void {
  times.push(nowMs / 1000)
  for (const deck of DECK_IDS) series[deck].push(bpmByDeck[deck])
  while (times.length > HISTORY_SECONDS + 1) {
    times.shift()
    for (const deck of DECK_IDS) series[deck].shift()
  }
}

export function historyData(): HistoryData {
  return [[...times], ...DECK_IDS.map((deck) => [...series[deck]])]
}

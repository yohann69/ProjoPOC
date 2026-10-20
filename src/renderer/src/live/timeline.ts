import type { TransitionSignal } from '@shared/transition'
import type { DeckId } from '@shared/types'

export interface Span {
  start: number
  /** null while still running. */
  end: number | null
}

export interface TransitionMark {
  ts: number
  fromDeck: DeckId
  toDeck: DeckId
  confidence: number
  signals: TransitionSignal[]
}

export const TIMELINE_WINDOW_MS = 10 * 60_000

export const spans: Record<DeckId, Span[]> = { 1: [], 2: [], 3: [], 4: [] }
export let transitions: TransitionMark[] = []

export function resetTimeline(): void {
  for (const deck of [1, 2, 3, 4] as const) spans[deck] = []
  transitions = []
}

/** Opens or closes the deck's audible span when its on-air + playing state changes. */
export function setAudible(deck: DeckId, audible: boolean, ts: number): void {
  const list = spans[deck]
  const open = list[list.length - 1]
  if (audible && (!open || open.end !== null)) list.push({ start: ts, end: null })
  else if (!audible && open && open.end === null) open.end = ts
  const cutoff = ts - TIMELINE_WINDOW_MS * 2
  while (list.length > 0 && (list[0]?.end ?? Infinity) < cutoff) list.shift()
}

export function addTransition(mark: TransitionMark): void {
  transitions = [...transitions, mark].filter((t) => t.ts > mark.ts - TIMELINE_WINDOW_MS * 2)
}

/** Time ranges where two or more of the given decks are audible at once. */
export function computeOverlaps(
  all: Record<DeckId, Span[]>,
  now: number
): [start: number, end: number][] {
  const edges: [time: number, delta: number][] = []
  for (const list of Object.values(all)) {
    for (const s of list) edges.push([s.start, 1], [s.end ?? now, -1])
  }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const result: [number, number][] = []
  let count = 0
  let from = 0
  for (const [time, delta] of edges) {
    const before = count
    count += delta
    if (before < 2 && count >= 2) from = time
    if (before >= 2 && count < 2 && time > from) result.push([from, time])
  }
  return result
}

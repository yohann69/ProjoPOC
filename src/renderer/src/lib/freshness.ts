import { epochNow } from './frameLoop'

const stamps = new Map<string, number>()

/** Records when a value was last reported, without touching React state. */
export function stamp(key: string, ts: number): void {
  stamps.set(key, ts)
}

export function clearStamps(): void {
  stamps.clear()
}

/** Milliseconds since the value was last reported, or null if it never was. */
export function ageMs(key: string): number | null {
  const ts = stamps.get(key)
  return ts === undefined ? null : Math.max(0, epochNow() - ts)
}

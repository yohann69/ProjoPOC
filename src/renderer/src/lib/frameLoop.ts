export type FrameCallback = (now: number, dtMs: number) => void

/** Wall-clock milliseconds with sub-millisecond precision, comparable to timestamps from the main process. */
export const epochNow = (): number => performance.timeOrigin + performance.now()

const subscribers = new Set<FrameCallback>()
let handle = 0
let last = 0

function tick(): void {
  const now = epochNow()
  const dt = last === 0 ? 16 : now - last
  last = now
  for (const callback of subscribers) callback(now, dt)
  handle = subscribers.size > 0 ? requestAnimationFrame(tick) : 0
}

/** One shared requestAnimationFrame loop for every animated component; returns an unsubscribe. */
export function onFrame(callback: FrameCallback): () => void {
  subscribers.add(callback)
  if (handle === 0) {
    last = 0
    handle = requestAnimationFrame(tick)
  }
  return () => {
    subscribers.delete(callback)
  }
}

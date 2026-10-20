import type { ProlinkRawEvent } from './rawTypes'

export interface SessionContext {
  now(): number
  emit(event: ProlinkRawEvent): void
  log(level: 'info' | 'warn' | 'error', message: string): void
  /** Logs a message the first time `key` is seen, for facts worth recording once. */
  observe(key: string, message: string): void
}

export function createContext(
  emit: (event: ProlinkRawEvent) => void,
  mirror: (level: 'info' | 'warn' | 'error', message: string) => void,
  now: () => number = Date.now
): SessionContext {
  const seen = new Set<string>()
  const log: SessionContext['log'] = (level, message) => {
    emit({ kind: 'log', ts: now(), level, message })
    mirror(level, message)
  }
  return {
    now,
    emit,
    log,
    observe(key, message) {
      if (seen.has(key)) return
      seen.add(key)
      log('info', message)
    }
  }
}

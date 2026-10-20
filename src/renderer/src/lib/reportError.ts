/** Sends a renderer error to the main-process log; never throws, since it runs inside error handlers. */
export function reportError(error: unknown, componentStack?: string | null): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    window.deckpulse.logRenderer({
      message: err.message,
      stack: err.stack,
      componentStack: componentStack ?? undefined
    })
  } catch {
    // Logging must not cause another error.
  }
}

/** Logs errors that escape React: event handlers, timers and rejected promises. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason))
}

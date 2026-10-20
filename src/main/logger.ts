import log from 'electron-log/main'
import type { ErrorLog } from './diagnostics/errorLog'

const MAX_FILE_BYTES = 5 * 1024 * 1024

/** Sends console output and uncaught errors to the log file and the diagnostics error list. */
export function initLogging(errors: ErrorLog): void {
  log.transports.file.level = 'info'
  log.transports.file.maxSize = MAX_FILE_BYTES
  log.transports.console.level = 'info'
  Object.assign(console, log.functions)
  log.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error }) => errors.add('main', error.stack ?? error.message)
  })
}

export function logFilePath(): string | null {
  try {
    return log.transports.file.getFile().path
  } catch {
    return null
  }
}

export { log }

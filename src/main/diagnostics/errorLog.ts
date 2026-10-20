import type { DiagnosticError } from '@shared/diagnostics'

const MAX_ERRORS = 50

/** The most recent errors from every process, kept for the diagnostics page. */
export class ErrorLog {
  private readonly entries: DiagnosticError[] = []

  constructor(private readonly now: () => number = Date.now) {}

  add(origin: DiagnosticError['origin'], message: string): void {
    this.entries.push({ ts: this.now(), origin, message: message.slice(0, 1000) })
    if (this.entries.length > MAX_ERRORS) this.entries.shift()
  }

  list(): DiagnosticError[] {
    return [...this.entries]
  }
}

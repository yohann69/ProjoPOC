import { join } from 'node:path'
import type { MidiLogEntry } from '@shared/usb'
import { JsonlLog } from '../sources/prolink/packetLog'

/** Optional JSONL record of raw MIDI bytes plus the decoded guess, for offline study. */
export class MidiLogger {
  private log: JsonlLog | null = null

  constructor(private readonly dir: string) {}

  set(enabled: boolean): string | null {
    this.log?.close()
    this.log = null
    if (!enabled) return null
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    this.log = new JsonlLog(join(this.dir, `midi-${stamp}.jsonl`), () => {
      this.log = null
    })
    return this.log.path
  }

  write(entries: MidiLogEntry[]): void {
    for (const entry of entries) this.log?.write({ type: 'midi', ...entry })
  }

  close(): void {
    this.set(false)
  }
}

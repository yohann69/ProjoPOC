import { RECORDING_VERSION, type RecordingHeader } from '@shared/recording'
import type { AppEvent, SourceId } from '@shared/types'
import type { IngestEvent } from '@shared/usb'
import { JsonlLog } from '../sources/prolink/packetLog'
import { encodeRecord } from './serialize'

/** Event types that are derived again on replay, or only describe the live session. */
const NOT_RECORDED: readonly AppEvent['type'][] = ['hook', 'hookServer']

/** Writes raw source events, normalized events and renderer-side ingest events to one JSONL file. */
export class Recorder {
  private readonly log: JsonlLog

  constructor(
    readonly path: string,
    source: SourceId | null,
    onError: (error: Error) => void,
    private readonly now: () => number = Date.now
  ) {
    this.log = new JsonlLog(path, onError, encodeRecord)
    const header: RecordingHeader = {
      type: 'header',
      version: RECORDING_VERSION,
      app: 'DeckPulse',
      startedAt: now(),
      source
    }
    this.log.write(header)
  }

  raw(source: 'prolink' | 'simulator', raw: unknown): void {
    this.log.write({ type: 'raw', t: this.now(), source, raw })
  }

  event(event: AppEvent): void {
    if (!NOT_RECORDED.includes(event.type)) this.log.write({ type: 'event', t: this.now(), event })
  }

  ingest(events: IngestEvent[]): void {
    this.log.write({ type: 'ingest', t: this.now(), events })
  }

  close(): void {
    this.log.close()
  }
}

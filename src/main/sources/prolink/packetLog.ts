import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs'
import { dirname } from 'node:path'

export interface PacketLogRecord {
  type: 'packet'
  ts: number
  srcAddr: string
  srcPort: number
  port: number
  length: number
  kind: string
  hexPreview: string
  /** Full payload, so a log can be replayed as a fixture. */
  hex: string
  truncated?: boolean
}

export interface ObservationRecord {
  type: 'observation'
  ts: number
  level: 'info' | 'warn' | 'error'
  message: string
}

/** Append-only JSONL file; a failing disk disables logging instead of crashing capture. */
export class JsonlLog {
  private stream: WriteStream | null

  constructor(
    readonly path: string,
    private readonly onError: (error: Error) => void,
    private readonly encode: (record: object) => string = JSON.stringify
  ) {
    mkdirSync(dirname(path), { recursive: true })
    this.stream = createWriteStream(path, { flags: 'a' })
    this.stream.on('error', (error) => {
      this.stream = null
      this.onError(error)
    })
  }

  write(record: PacketLogRecord | ObservationRecord | object): void {
    this.stream?.write(`${this.encode(record)}\n`)
  }

  close(): void {
    this.stream?.end()
    this.stream = null
  }
}

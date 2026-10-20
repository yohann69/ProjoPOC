import { readFileSync } from 'node:fs'
import { TypedEmitter } from '../../../utils/typedEmitter'
import type { CaptureEvents, CapturedPacket, PacketCapture } from '../capture'
import type { PacketLogRecord } from '../packetLog'

/** Parses a JSONL packet log (written by the packet inspector) back into packets. */
export function readRecording(jsonl: string): CapturedPacket[] {
  return jsonl
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as { type: string } & Partial<PacketLogRecord>)
    .flatMap((record) =>
      record.type === 'packet' && record.hex !== undefined
        ? [
            {
              ts: record.ts ?? 0,
              srcAddr: record.srcAddr ?? '0.0.0.0',
              srcPort: record.srcPort ?? 0,
              dstPort: record.port ?? 0,
              payload: Buffer.from(record.hex.replace(/ /g, ''), 'hex')
            }
          ]
        : []
    )
}

export const readRecordingFile = (path: string): CapturedPacket[] =>
  readRecording(readFileSync(path, 'utf8'))

/** A capture that replays fixed packets synchronously when started. */
export class ReplayCapture extends TypedEmitter<CaptureEvents> implements PacketCapture {
  constructor(
    private readonly packets: CapturedPacket[],
    readonly interfaceName = 'replay0'
  ) {
    super()
  }

  start(): void {
    for (const packet of this.packets) this.emit('packet', packet)
  }

  stop(): void {
    this.removeAllListeners()
  }
}

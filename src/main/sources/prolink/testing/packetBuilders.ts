/*
 * Synthetic Pro DJ Link packets for tests. They are NOT recordings from hardware: layouts follow
 * alphatheta-connect's parsers (announce, status) and the DJ Link analysis (beat packets).
 * Real recordings made with the packet log can replace them (see replay.ts).
 */
const HEADER = [0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c]

function base(length: number, type: number): Buffer {
  const packet = Buffer.alloc(length)
  Buffer.from(HEADER).copy(packet)
  packet[0x0a] = type
  return packet
}

const pitchBytes = (percent: number): number => Math.round(0x100000 * (1 + percent / 100))

export function announcePacket(opts: {
  name: string
  device: number
  ip: string
  type: number
}): Buffer {
  const packet = base(0x36, 0x06)
  packet.write(opts.name, 0x0c, 20, 'ascii')
  packet[0x24] = opts.device
  packet[0x34] = opts.type
  packet.writeUInt32BE(
    opts.ip.split('.').reduce((n, part) => n * 256 + Number(part), 0),
    0x2c
  )
  return packet
}

export interface StatusOptions {
  device: number
  trackId?: number
  trackDevice?: number
  slot?: number
  trackType?: number
  playState?: number
  /** Status flag byte at 0x89. */
  flags?: number
  bpm?: number
  pitchPercent?: number
  beatInMeasure?: number
}

export function statusPacket(opts: StatusOptions): Buffer {
  const packet = base(0xd4, 0x0a)
  packet[0x21] = opts.device
  packet[0x28] = opts.trackDevice ?? opts.device
  packet[0x29] = opts.slot ?? 3
  packet[0x2a] = opts.trackType ?? 2
  packet.writeUInt32BE(opts.trackId ?? 0, 0x2c)
  packet[0x7b] = opts.playState ?? 3
  packet[0x89] = opts.flags ?? 0x48
  const pitch = pitchBytes(opts.pitchPercent ?? 0)
  packet.writeUIntBE(pitch, 0x8d, 3)
  packet.writeUIntBE(pitch, 0x99, 3)
  packet.writeUInt16BE(Math.round((opts.bpm ?? 128) * 100), 0x92)
  packet.writeUInt32BE(0xffffffff, 0xa0)
  packet.writeUInt16BE(0x1ff, 0xa4)
  packet[0xa6] = opts.beatInMeasure ?? 1
  return packet
}

export function beatPacket(opts: {
  device: number
  beatInBar: number
  bpm: number
  pitchPercent?: number
}): Buffer {
  const packet = base(0x60, 0x28)
  packet[0x21] = opts.device
  packet.writeUInt32BE(pitchBytes(opts.pitchPercent ?? 0), 0x54)
  packet.writeUInt16BE(Math.round(opts.bpm * 100), 0x5a)
  packet[0x5c] = opts.beatInBar
  packet[0x5f] = opts.device
  return packet
}

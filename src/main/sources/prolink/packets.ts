import type { BeatInBar } from '@shared/types'

/** UDP ports of the Pro DJ Link protocol (values from alphatheta-connect's constants). */
export const ANNOUNCE_PORT = 50000
export const BEAT_PORT = 50001
export const STATUS_PORT = 50002

/** Every Pro DJ Link UDP packet starts with these 10 bytes. */
const PROLINK_HEADER = [0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c]

const BEAT_PACKET_TYPE = 0x28
const POSITION_PACKET_TYPE = 0x0b
const ANNOUNCE_PACKET_TYPE = 0x06
const MIN_STATUS_LENGTH = 0xc8
const BEAT_PACKET_LENGTH = 0x60
/** The XDJ-XZ sends beat packets of 88 bytes: no track BPM and no beat-in-bar fields (observed). */
const COMPACT_BEAT_LENGTH = 0x58
const PITCH_NORMAL = 0x100000

export const hasProlinkHeader = (packet: Buffer): boolean =>
  packet.length > 0x0a && PROLINK_HEADER.every((byte, i) => packet[i] === byte)

const unknownType = (type: number | undefined): string =>
  `type_0x${(type ?? 0).toString(16).padStart(2, '0')}`

/** Names only the packet kinds documented in alphatheta-connect and the DJ Link analysis. */
export function packetKind(port: number, packet: Buffer): string {
  if (!hasProlinkHeader(packet)) return 'foreign'
  const type = packet[0x0a]
  if (port === BEAT_PORT) {
    if (type === BEAT_PACKET_TYPE) return 'beat'
    if (type === POSITION_PACKET_TYPE) return 'position'
  }
  if (port === ANNOUNCE_PORT && type === ANNOUNCE_PACKET_TYPE) return 'announce'
  if (port === STATUS_PORT) {
    if (type === ANNOUNCE_PACKET_TYPE) return 'mediaSlot'
    if (packet.length >= MIN_STATUS_LENGTH) return 'status'
  }
  return unknownType(type)
}

export interface BeatPacket {
  deviceNumber: number
  beatInBar: BeatInBar
  /** Track BPM at 0% pitch; null when the packet does not carry one. */
  trackBpm: number | null
  pitchPercent: number
}

/** Beat packet layout: https://djl-analysis.deepsymmetry.org/djl-analysis/beats.html */
export function parseBeatPacket(packet: Buffer): BeatPacket | null {
  if (!hasProlinkHeader(packet) || packet[0x0a] !== BEAT_PACKET_TYPE) return null
  if (packet.length < COMPACT_BEAT_LENGTH) return null
  const pitchPercent =
    Math.round(((packet.readUInt32BE(0x54) - PITCH_NORMAL) / PITCH_NORMAL) * 10000) / 100
  const deviceNumber = packet[0x21] ?? 0
  if (packet.length < BEAT_PACKET_LENGTH)
    return parseCompactBeat(packet, deviceNumber, pitchPercent)
  const beatInBar = packet[0x5c]
  if (beatInBar === undefined || beatInBar < 1 || beatInBar > 4) return null
  const rawBpm = packet.readUInt16BE(0x5a)
  return {
    deviceNumber,
    beatInBar: beatInBar as BeatInBar,
    trackBpm: rawBpm === 0 || rawBpm === 0xffff ? null : rawBpm / 100,
    pitchPercent
  }
}

/**
 * The short packet still carries the time to the next beat (0x24) and to the next bar (0x2c), so the
 * beat in the bar is 5 minus the beats left in the bar, and the tempo is 60000 / beat interval.
 */
function parseCompactBeat(
  packet: Buffer,
  deviceNumber: number,
  pitchPercent: number
): BeatPacket | null {
  const nextBeatMs = packet.readUInt32BE(0x24)
  const nextBarMs = packet.readUInt32BE(0x2c)
  if (nextBeatMs === 0 || nextBeatMs === 0xffffffff || nextBarMs === 0xffffffff) return null
  const left = Math.round(nextBarMs / nextBeatMs)
  if (left < 1 || left > 4) return null
  const effectiveBpm = 60000 / nextBeatMs
  return {
    deviceNumber,
    beatInBar: (5 - left) as BeatInBar,
    trackBpm: Math.round((effectiveBpm / (1 + pitchPercent / 100)) * 100) / 100,
    pitchPercent
  }
}

export const toHex = (packet: Buffer, maxBytes = packet.length): string =>
  [...packet.subarray(0, maxBytes)].map((b) => b.toString(16).padStart(2, '0')).join(' ')

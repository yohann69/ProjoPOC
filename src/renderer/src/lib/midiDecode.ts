export type MidiKind =
  | 'noteOn'
  | 'noteOff'
  | 'polyAftertouch'
  | 'cc'
  | 'programChange'
  | 'channelAftertouch'
  | 'pitchBend'
  | 'sysex'
  | 'timeCode'
  | 'songPosition'
  | 'songSelect'
  | 'tuneRequest'
  | 'clock'
  | 'start'
  | 'continue'
  | 'stop'
  | 'activeSensing'
  | 'reset'
  | 'unknown'

export interface MidiMessage {
  kind: MidiKind
  /** 1..16 for channel messages. */
  channel: number | null
  /**
   * Identity of the physical control as `group:channel:number`, so a note's on and off share one
   * entry. Null for messages that are not controls (clock, SysEx, ...).
   */
  control: string | null
  /** Raw value: 0..127, or 0..16383 for pitch bend. Note off reads as 0. */
  raw: number | null
  /** Largest value `raw` can take, used to normalize to 0..1. */
  max: number
  /** Standard-MIDI reading of the bytes; says nothing about what the unit means by them. */
  guess: string
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Note 60 is C4. */
export const noteName = (n: number): string => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`

const SYSTEM: Record<number, { kind: MidiKind; text: string }> = {
  0xf6: { kind: 'tuneRequest', text: 'tune request' },
  0xf8: { kind: 'clock', text: 'timing clock' },
  0xfa: { kind: 'start', text: 'start' },
  0xfb: { kind: 'continue', text: 'continue' },
  0xfc: { kind: 'stop', text: 'stop' },
  0xfe: { kind: 'activeSensing', text: 'active sensing' },
  0xff: { kind: 'reset', text: 'system reset' }
}

const hex = (bytes: ArrayLike<number>, limit = 8): string => {
  const shown = Array.from({ length: Math.min(limit, bytes.length) }, (_, i) =>
    (bytes[i] ?? 0).toString(16).padStart(2, '0').toUpperCase()
  )
  return shown.join(' ') + (bytes.length > limit ? ' ...' : '')
}

const make = (
  kind: MidiKind,
  guess: string,
  channel: number | null = null,
  control: string | null = null,
  raw: number | null = null,
  max = 127
): MidiMessage => ({ kind, channel, control, raw, max, guess })

function decodeSystem(bytes: ArrayLike<number>): MidiMessage {
  const status = bytes[0] ?? 0
  const d1 = bytes[1] ?? 0
  const d2 = bytes[2] ?? 0
  if (status === 0xf0) return make('sysex', `SysEx, ${bytes.length} bytes (${hex(bytes, 6)})`)
  if (status === 0xf1) return make('timeCode', `MTC quarter frame ${d1}`)
  if (status === 0xf2) return make('songPosition', `song position ${(d2 << 7) | d1}`)
  if (status === 0xf3) return make('songSelect', `song select ${d1}`)
  const known = SYSTEM[status]
  return known ? make(known.kind, known.text) : make('unknown', `unrecognised ${hex(bytes)}`)
}

/** Reads raw MIDI bytes with the standard message layout and makes no assumption about the device. */
export function decodeMidi(bytes: ArrayLike<number>): MidiMessage {
  const status = bytes[0] ?? 0
  if (status < 0x80) return make('unknown', `data byte without status (${hex(bytes)})`)
  if (status >= 0xf0) return decodeSystem(bytes)
  const channel = (status & 0x0f) + 1
  const d1 = (bytes[1] ?? 0) & 0x7f
  const d2 = (bytes[2] ?? 0) & 0x7f
  const where = `channel ${channel}`
  switch (status & 0xf0) {
    case 0x80:
      return make(
        'noteOff',
        `note off ${noteName(d1)} (${d1}) velocity ${d2}, ${where}`,
        channel,
        `note:${channel}:${d1}`,
        0
      )
    case 0x90:
      return d2 === 0
        ? make(
            'noteOff',
            `note on ${noteName(d1)} (${d1}) velocity 0 = off, ${where}`,
            channel,
            `note:${channel}:${d1}`,
            0
          )
        : make(
            'noteOn',
            `note on ${noteName(d1)} (${d1}) velocity ${d2}, ${where}`,
            channel,
            `note:${channel}:${d1}`,
            d2
          )
    case 0xa0:
      return make(
        'polyAftertouch',
        `key pressure ${noteName(d1)} (${d1}) = ${d2}, ${where}`,
        channel,
        `poly:${channel}:${d1}`,
        d2
      )
    case 0xb0:
      return make('cc', `CC ${d1} = ${d2}, ${where}`, channel, `cc:${channel}:${d1}`, d2)
    case 0xc0:
      return make(
        'programChange',
        `program ${d1}, ${where}`,
        channel,
        `program:${channel}:${d1}`,
        127
      )
    case 0xd0:
      return make(
        'channelAftertouch',
        `channel pressure ${d1}, ${where}`,
        channel,
        `pressure:${channel}:0`,
        d1
      )
    default: {
      const value = (d2 << 7) | d1
      return make(
        'pitchBend',
        `pitch bend ${value} (center 8192), ${where}`,
        channel,
        `pitchbend:${channel}:0`,
        value,
        16383
      )
    }
  }
}

/** Raw value as 0..1. */
export const normalizeMidi = (message: MidiMessage): number | null =>
  message.raw === null ? null : Math.min(1, Math.max(0, message.raw / message.max))

export interface ControlIdentity {
  group: string
  channel: number
  number: number
}

export function parseControlKey(key: string): ControlIdentity | null {
  const [group, channel, number] = key.split(':')
  if (!group || channel === undefined || number === undefined) return null
  return { group, channel: Number(channel), number: Number(number) }
}

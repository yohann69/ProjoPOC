import type { DeckId } from '@shared/types'
import type { MixerControl, MixerTarget } from '@shared/usb'
import { parseControlKey } from './midiDecode'

/**
 * Mixer controls of the XDJ-XZ, from Pioneer's "XDJ-XZ MIDI Message List" (E3): every mixer control is
 * a Control Change on MIDI channel 5 (status 0xB4), value 0..127. Seen live on the unit: CC 9 (deck 2
 * EQ LOW) sweeping, CC 5 (deck 1 COLOR) at 63. Sent only while the unit's mixer MIDI option is on.
 */
export type XzSection = 'channel' | 'crossfader' | 'master' | 'fx' | 'headphones'
export type XzKind = 'knob' | 'fader' | 'button' | 'switch'

export interface XzControl {
  cc: number
  /** Stable id, e.g. `ch2.eqLow` or `master.level`. */
  id: string
  label: string
  section: XzSection
  deck?: DeckId
  kind: XzKind
  /** The mixer value this feeds when the app models it. */
  target?: MixerTarget
  /** What the lowest and highest value mean, as printed in the message list. */
  ends?: [low: string, high: string]
  /** A knob whose neutral position is the centre. */
  centered?: boolean
}

export const XZ_MIXER_MIDI_CHANNEL = 5

const DECKS: DeckId[] = [1, 2, 3, 4]

const CHANNEL_CC: Record<DeckId, Record<MixerControl | 'cue' | 'assign', number>> = {
  1: { trim: 1, eqHigh: 2, eqMid: 3, eqLow: 4, color: 5, fader: 17, cue: 70, assign: 65 },
  2: { trim: 6, eqHigh: 7, eqMid: 8, eqLow: 9, color: 10, fader: 18, cue: 71, assign: 66 },
  3: { trim: 12, eqHigh: 14, eqMid: 15, eqLow: 21, color: 22, fader: 19, cue: 72, assign: 67 },
  4: { trim: 80, eqHigh: 81, eqMid: 92, eqLow: 82, color: 83, fader: 20, cue: 73, assign: 68 }
}

const KNOBS: {
  control: MixerControl
  label: string
  ends: [string, string]
  centered?: boolean
}[] = [
  { control: 'trim', label: 'TRIM', ends: ['-\u221e', '+9 dB'] },
  { control: 'eqHigh', label: 'HI', ends: ['-26 dB', '+6 dB'] },
  { control: 'eqMid', label: 'MID', ends: ['-26 dB', '+6 dB'] },
  { control: 'eqLow', label: 'LOW', ends: ['-26 dB', '+6 dB'] },
  { control: 'color', label: 'COLOR', ends: ['LOW', 'HI'], centered: true }
]

function channelControls(deck: DeckId): XzControl[] {
  const cc = CHANNEL_CC[deck]
  return [
    ...KNOBS.map((k): XzControl => ({
      cc: cc[k.control],
      id: `ch${deck}.${k.control}`,
      label: k.label,
      section: 'channel',
      deck,
      kind: 'knob',
      target: `ch${deck}.${k.control}`,
      ends: k.ends,
      centered: k.centered
    })),
    {
      cc: cc.fader,
      id: `ch${deck}.fader`,
      label: 'FADER',
      section: 'channel',
      deck,
      kind: 'fader',
      target: `ch${deck}.fader`,
      ends: ['bottom', 'top']
    },
    { cc: cc.cue, id: `ch${deck}.cue`, label: 'CUE', section: 'channel', deck, kind: 'button' },
    {
      cc: cc.assign,
      id: `ch${deck}.assign`,
      label: 'XFADER ASSIGN',
      section: 'channel',
      deck,
      kind: 'switch'
    }
  ]
}

const GLOBAL: XzControl[] = [
  {
    cc: 11,
    id: 'crossfader',
    label: 'CROSSFADER',
    section: 'crossfader',
    kind: 'fader',
    target: 'crossfader',
    ends: ['A', 'B']
  },
  {
    cc: 24,
    id: 'master.level',
    label: 'MASTER LEVEL',
    section: 'master',
    kind: 'knob',
    ends: ['-\u221e', '0 dB']
  },
  {
    cc: 25,
    id: 'master.booth',
    label: 'BOOTH LEVEL',
    section: 'master',
    kind: 'knob',
    ends: ['-\u221e', '0 dB']
  },
  {
    cc: 47,
    id: 'master.eqHigh',
    label: 'MASTER HI',
    section: 'master',
    kind: 'knob',
    ends: ['-26 dB', '+6 dB']
  },
  {
    cc: 48,
    id: 'master.eqMid',
    label: 'MASTER MID',
    section: 'master',
    kind: 'knob',
    ends: ['-26 dB', '+6 dB']
  },
  {
    cc: 49,
    id: 'master.eqLow',
    label: 'MASTER LOW',
    section: 'master',
    kind: 'knob',
    ends: ['-26 dB', '+6 dB']
  },
  {
    cc: 26,
    id: 'phones.level',
    label: 'PHONES LEVEL',
    section: 'headphones',
    kind: 'knob',
    ends: ['-\u221e', '0 dB']
  },
  {
    cc: 27,
    id: 'phones.mix',
    label: 'PHONES MIX',
    section: 'headphones',
    kind: 'knob',
    ends: ['CUE', 'MASTER']
  },
  { cc: 74, id: 'phones.masterCue', label: 'MASTER CUE', section: 'headphones', kind: 'button' },
  {
    cc: 91,
    id: 'fx.level',
    label: 'BEAT FX LEVEL/DEPTH',
    section: 'fx',
    kind: 'knob',
    ends: ['min', 'max']
  },
  { cc: 114, id: 'fx.on', label: 'BEAT FX ON/OFF', section: 'fx', kind: 'button' }
]

export const XZ_CONTROLS: XzControl[] = [...DECKS.flatMap(channelControls), ...GLOBAL]

const BY_CC = new Map(XZ_CONTROLS.map((c) => [c.cc, c]))

export interface DeviceProfile {
  id: 'xdj-xz'
  label: string
  /** Matches the MIDI port names the unit shows up as, e.g. "XDJ-XZ (2)". */
  port: RegExp
}

const PROFILES: DeviceProfile[] = [{ id: 'xdj-xz', label: 'XDJ-XZ', port: /^XDJ-XZ\b/i }]

export const profileFor = (portName: string): DeviceProfile | null =>
  PROFILES.find((p) => p.port.test(portName)) ?? null

/** The mixer control behind a decoded control key such as `cc:5:9`, or null when it is not one. */
export function xzControlOf(controlKey: string | null): XzControl | null {
  const id = controlKey ? parseControlKey(controlKey) : null
  if (!id || id.group !== 'cc' || id.channel !== XZ_MIXER_MIDI_CHANNEL) return null
  return BY_CC.get(id.number) ?? null
}

export const xzKey = (cc: number): string => `cc:${XZ_MIXER_MIDI_CHANNEL}:${cc}`

/** Crossfader assign switch: A is 0, THRU 0x40 and B 0x7F in the message list. */
export function assignLabel(raw: number): 'A' | 'THRU' | 'B' {
  return raw < 0x20 ? 'A' : raw > 0x60 ? 'B' : 'THRU'
}

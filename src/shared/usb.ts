import { DECK_IDS, type DeckId } from './types'

export const MIXER_CONTROLS = ['fader', 'eqHigh', 'eqMid', 'eqLow', 'trim', 'color'] as const
export type MixerControl = (typeof MIXER_CONTROLS)[number]

export type MixerTarget = 'crossfader' | `ch${DeckId}.${MixerControl}`

export const MIXER_TARGETS: readonly MixerTarget[] = [
  'crossfader',
  ...DECK_IDS.flatMap((deck) =>
    MIXER_CONTROLS.map((control) => `ch${deck}.${control}` as MixerTarget)
  )
]

export const isMixerTarget = (value: unknown): value is MixerTarget =>
  MIXER_TARGETS.some((t) => t === value)

export type ParsedTarget =
  { kind: 'crossfader' } | { kind: 'channel'; deck: DeckId; control: MixerControl }

export function parseTarget(target: MixerTarget): ParsedTarget {
  if (target === 'crossfader') return { kind: 'crossfader' }
  const [channel, control] = target.split('.') as [`ch${DeckId}`, MixerControl]
  return { kind: 'channel', deck: Number(channel.slice(2)) as DeckId, control }
}

/** One labelled MIDI control. `key` identifies the message kind, channel and number (see midiDecode). */
export interface MidiMappingEntry {
  key: string
  label: string
  /** Mixer value this control drives; null for labelled-only controls. */
  target: MixerTarget | null
  invert: boolean
}

export interface MidiMapping {
  version: 1
  entries: MidiMappingEntry[]
}

export const EMPTY_MIDI_MAPPING: MidiMapping = { version: 1, entries: [] }

export interface MidiLogEntry {
  ts: number
  port: string
  bytes: number[]
  /** Decoded guess only; nothing here is known about what the unit means by it. */
  guess: string
}

/** Events produced in the renderer (Web MIDI, Web Audio) and published on the main-process event bus. */
export type IngestEvent =
  | { kind: 'mixerValue'; target: MixerTarget; value: number; ts: number }
  | {
      kind: 'energy'
      ts: number
      rms: number
      bands: { low: number; mid: number; high: number }
    }
  | { kind: 'onset'; ts: number; strength: number }
  | { kind: 'drop'; ts: number; phase: 'buildup' | 'drop' }

export interface OptionalSettings {
  midiInputName: string | null
  audioDeviceId: string | null
}

export const DEFAULT_OPTIONAL_SETTINGS: OptionalSettings = {
  midiInputName: null,
  audioDeviceId: null
}

export interface MicAccessResult {
  granted: boolean
  /** Operating-system status, e.g. `granted`, `denied`, `not-determined`. */
  status: string
}

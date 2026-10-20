import { isMixerTarget, type MidiMapping } from './usb'

const MAX_MAPPING_ENTRIES = 512
const MAPPING_KEY = /^[\w-]{1,24}:\d{1,2}:\d{1,5}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Validates a mapping from disk, the renderer or an imported file; throws on anything else. */
export function parseMidiMapping(value: unknown): MidiMapping {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    throw new Error('Invalid MIDI mapping')
  }
  if (value.entries.length > MAX_MAPPING_ENTRIES) throw new Error('Too many mapping entries')
  return {
    version: 1,
    entries: value.entries.map((entry: unknown) => {
      if (!isRecord(entry)) throw new Error('Invalid mapping entry')
      const { key, label, target, invert } = entry
      if (typeof key !== 'string' || !MAPPING_KEY.test(key)) throw new Error('Invalid mapping key')
      if (typeof label !== 'string' || label.length > 80) throw new Error('Invalid mapping label')
      if (target !== null && !isMixerTarget(target)) throw new Error('Invalid mapping target')
      if (typeof invert !== 'boolean') throw new Error('Expected a boolean')
      return { key, label, target, invert }
    })
  }
}

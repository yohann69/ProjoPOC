import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { EMPTY_MIDI_MAPPING, type MidiMapping } from '@shared/usb'
import { parseMidiMapping } from '../validateOptional'

/** Saved MIDI labels and mixer mappings, kept apart from the app settings. */
export class MidiMappingStore {
  constructor(private readonly path: string) {}

  load(): MidiMapping {
    try {
      return parseMidiMapping(JSON.parse(readFileSync(this.path, 'utf8')))
    } catch {
      return EMPTY_MIDI_MAPPING
    }
  }

  save(mapping: MidiMapping): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(mapping, null, 2))
  }
}

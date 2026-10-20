import { EMPTY_MIDI_MAPPING, type MidiMapping, type MidiMappingEntry } from '@shared/usb'
import { create } from 'zustand'

interface MappingStore {
  entries: Record<string, MidiMappingEntry>
  /** Edited since the last save or load. */
  dirty: boolean
  loaded: boolean
  error?: string
  load(): Promise<void>
  update(key: string, patch: Partial<Omit<MidiMappingEntry, 'key'>>): void
  remove(key: string): void
  replace(mapping: MidiMapping): void
  save(): Promise<void>
  toMapping(): MidiMapping
}

const byKey = (mapping: MidiMapping): Record<string, MidiMappingEntry> =>
  Object.fromEntries(mapping.entries.map((e) => [e.key, e]))

/** An entry with no label and no target carries no information and is dropped from the file. */
const meaningful = (e: MidiMappingEntry): boolean => e.label.trim() !== '' || e.target !== null

export const useMappingStore = create<MappingStore>((set, get) => ({
  entries: {},
  dirty: false,
  loaded: false,
  load: async () => {
    const mapping = await window.deckpulse.getMidiMapping()
    set({ entries: byKey(mapping), dirty: false, loaded: true })
  },
  update: (key, patch) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [key]: { key, label: '', target: null, invert: false, ...s.entries[key], ...patch }
      },
      dirty: true
    })),
  remove: (key) =>
    set((s) => {
      const entries = { ...s.entries }
      delete entries[key]
      return { entries, dirty: true }
    }),
  replace: (mapping) => set({ entries: byKey(mapping), dirty: true, error: undefined }),
  toMapping: () => ({
    ...EMPTY_MIDI_MAPPING,
    entries: Object.values(get().entries).filter(meaningful)
  }),
  save: async () => {
    try {
      await window.deckpulse.saveMidiMapping(get().toMapping())
      set({ dirty: false, error: undefined })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not save the mapping' })
    }
  }
}))

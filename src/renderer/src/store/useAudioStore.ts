import { create } from 'zustand'

export type AudioStatus = 'idle' | 'requesting' | 'running' | 'denied' | 'noDevice' | 'error'

export interface AudioDeviceInfo {
  id: string
  label: string
}

export interface AudioMark {
  id: number
  ts: number
  kind: 'buildup' | 'drop'
}

const MAX_MARKS = 12
let nextId = 0

interface AudioStore {
  status: AudioStatus
  message?: string
  devices: AudioDeviceInfo[]
  /** False until permission is granted, because browsers hide device names before that. */
  labelsVisible: boolean
  selectedId: string | null
  phase: 'idle' | 'buildup'
  marks: AudioMark[]
  setStatus(status: AudioStatus, message?: string): void
  setDevices(devices: AudioDeviceInfo[], labelsVisible: boolean): void
  select(id: string | null): void
  setPhase(phase: 'idle' | 'buildup'): void
  mark(kind: AudioMark['kind'], ts: number): void
}

export const useAudioStore = create<AudioStore>((set) => ({
  status: 'idle',
  devices: [],
  labelsVisible: false,
  selectedId: null,
  phase: 'idle',
  marks: [],
  setStatus: (status, message) => set({ status, message }),
  setDevices: (devices, labelsVisible) => set({ devices, labelsVisible }),
  select: (selectedId) => set({ selectedId }),
  setPhase: (phase) => set({ phase }),
  mark: (kind, ts) =>
    set((s) => ({ marks: [{ id: nextId++, ts, kind }, ...s.marks].slice(0, MAX_MARKS) }))
}))

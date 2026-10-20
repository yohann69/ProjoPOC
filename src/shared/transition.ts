export const TRANSITION_SIGNAL_NAMES = [
  'masterChange',
  'overlap',
  'onAir',
  'bpmSync',
  'fader',
  'audio'
] as const
export type TransitionSignalName = (typeof TRANSITION_SIGNAL_NAMES)[number]

/** Share of the confidence each signal can contribute when it is available. */
export const TRANSITION_WEIGHTS: Record<TransitionSignalName, number> = {
  masterChange: 0.3,
  overlap: 0.2,
  onAir: 0.15,
  bpmSync: 0.1,
  fader: 0.15,
  audio: 0.1
}

/** Where each signal comes from, shown when it is missing. */
export const TRANSITION_SIGNAL_SOURCES: Record<TransitionSignalName, string> = {
  masterChange: 'deck master flags (Pro DJ Link or simulator)',
  overlap: 'deck play states (Pro DJ Link or simulator)',
  onAir: 'deck on-air flags (Pro DJ Link or simulator)',
  bpmSync: 'deck BPM or sync flags (Pro DJ Link or simulator)',
  fader: 'USB-C mixer values (MIDI with saved mappings)',
  audio: 'audio input analysis'
}

export interface TransitionSignal {
  name: TransitionSignalName
  weight: number
  /** False when the data this signal needs was not present. */
  available: boolean
  contributed: boolean
  detail?: string
}

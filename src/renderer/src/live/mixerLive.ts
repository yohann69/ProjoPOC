import type { MixerState } from '@shared/types'

/** Latest mixer values, mutable and read on a timer so 30 Hz updates cost no renders. */
export const mixerLive: { usbc: MixerState | null; primary: MixerState | null } = {
  usbc: null,
  primary: null
}

export function applyMixer(mixer: MixerState): void {
  if (mixer.source === 'usbc') mixerLive.usbc = mixer
  else mixerLive.primary = mixer
}

/** Clears the primary source's mixer; USB-C values belong to a separate source and stay. */
export function resetMixerPrimary(): void {
  mixerLive.primary = null
}

export function resetMixerUsbc(): void {
  mixerLive.usbc = null
}

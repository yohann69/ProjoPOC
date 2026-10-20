import type { MidiStatus } from '../../store/useMidiStore'

export interface UsbcMixerFacts {
  status: MidiStatus
  selected: string | null
  connected: boolean
  mappedTargets: number
  messages: number
}

/** Names the first thing missing for USB-C mixer values to appear. */
export function usbcMixerMissing(f: UsbcMixerFacts): string {
  if (f.status === 'unsupported') return 'Web MIDI is unavailable in this window'
  if (f.status === 'denied') return 'MIDI permission was refused'
  if (f.status !== 'ready') return 'USB-C MIDI is not enabled'
  if (!f.selected) return 'no MIDI input is selected'
  if (!f.connected) return `${f.selected} is not connected`
  if (f.mappedTargets === 0) return 'no control is mapped to a mixer value yet'
  if (f.messages === 0) return 'no MIDI message has arrived yet'
  return 'the mapped controls have not moved yet'
}

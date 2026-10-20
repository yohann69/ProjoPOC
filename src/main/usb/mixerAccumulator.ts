import type { MixerState, Tagged } from '@shared/types'
import { parseTarget, type IngestEvent } from '@shared/usb'

/** Folds single mapped MIDI values into one USBC-tagged mixer snapshot. */
export class MixerAccumulator {
  private crossfader: Tagged<number> | undefined
  private channels: MixerState['channels'] = {}

  apply(event: Extract<IngestEvent, { kind: 'mixerValue' }>): MixerState {
    const value: Tagged<number> = { value: event.value, origin: 'USBC', ts: event.ts }
    const target = parseTarget(event.target)
    if (target.kind === 'crossfader') this.crossfader = value
    else {
      this.channels = {
        ...this.channels,
        [target.deck]: { ...this.channels[target.deck], [target.control]: value }
      }
    }
    return this.snapshot()
  }

  reset(): void {
    this.crossfader = undefined
    this.channels = {}
  }

  private snapshot(): MixerState {
    const mixer: MixerState = { source: 'usbc', channels: this.channels }
    if (this.crossfader) mixer.crossfader = this.crossfader
    return mixer
  }
}

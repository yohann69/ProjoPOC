import { OriginBadge } from '../../ui/OriginBadge'
import { Panel } from '../../ui/primitives'
import { MidiControls } from './MidiControls'
import { MidiMappingBar } from './MidiMappingBar'
import { MidiPortPicker } from './MidiPortPicker'
import { MidiStream } from './MidiStream'

/** Exploration tool for the USB-C MIDI port: nothing is assumed about what the unit sends. */
export function MidiExplorer() {
  return (
    <Panel title="USB-C MIDI explorer" badges={<OriginBadge origin="USBC" />}>
      <p className="text-xs text-slate-300">
        Move controls on the unit, label what you see, and map a control to a mixer value to feed
        the Mixer panel. Only mapped controls reach the app; everything else stays in this panel.
      </p>
      <MidiPortPicker />
      <MidiStream />
      <MidiControls />
      <MidiMappingBar />
    </Panel>
  )
}

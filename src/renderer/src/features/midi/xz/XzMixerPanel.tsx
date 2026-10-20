import { XZ_CONTROLS, profileFor, xzKey } from '../../../lib/xzMap'
import { epochNow } from '../../../lib/frameLoop'
import { useMidiStore } from '../../../store/useMidiStore'
import { OriginBadge } from '../../../ui/OriginBadge'
import { NotAvailable, Panel, useTicker } from '../../../ui/primitives'
import { XzMixer } from './XzMixer'

/** The XDJ-XZ mixer, recognised and drawn automatically; says what is missing when it is not there. */
export function XzMixerPanel() {
  useTicker(500)
  const status = useMidiStore((s) => s.status)
  const listening = useMidiStore((s) => s.listening)
  const controls = useMidiStore((s) => s.controls)
  const ports = listening.filter((name) => profileFor(name) !== null)
  const seen = XZ_CONTROLS.filter((c) => controls[xzKey(c.cc)] !== undefined)
  const last = Math.max(0, ...seen.map((c) => controls[xzKey(c.cc)]?.lastTs ?? 0))

  let missing: string | null = null
  if (status !== 'ready') missing = 'USB-C MIDI is not running.'
  else if (ports.length === 0)
    missing = 'No XDJ-XZ MIDI port found. Connect the USB-C cable and switch the unit on.'
  else if (seen.length === 0) {
    missing =
      'XDJ-XZ ports found, but no mixer message yet. Move a knob or fader; if nothing appears, set UTILITY > MIXER MIDI MESSAGE to SEND on the unit.'
  }

  return (
    <Panel title="XDJ-XZ mixer" badges={<OriginBadge origin="USBC" ts={last || undefined} />}>
      <p className="text-xs text-slate-300">
        {ports.length > 0 ? `Ports: ${ports.join(', ')}. ` : ''}
        {seen.length > 0
          ? `${seen.length} of ${XZ_CONTROLS.length} controls seen, last change ${Math.max(0, Math.round((epochNow() - last) / 1000))} s ago. `
          : ''}
        Values are the raw 0-127 MIDI numbers; labels follow Pioneer's MIDI message list.
      </p>
      {missing && <NotAvailable text={`N/A: ${missing}`} />}
      <XzMixer />
    </Panel>
  )
}

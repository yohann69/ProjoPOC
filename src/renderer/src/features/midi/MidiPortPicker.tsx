import { useMidiStore } from '../../store/useMidiStore'
import { NotAvailable, Waiting } from '../../ui/primitives'
import { selectMidiInput, startMidi, stopMidi } from './midiEngine'

const button =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-white outline-none'

function PortSelect() {
  const inputs = useMidiStore((s) => s.inputs)
  const selected = useMidiStore((s) => s.selected)
  const listening = useMidiStore((s) => s.listening)
  const connected = inputs.some((i) => i.name === selected && i.connected)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-200">
        {listening.length > 0
          ? `Listening to ${listening.join(', ')}.`
          : 'Not listening to any port yet.'}{' '}
        <span className="text-slate-400">
          Every connected MIDI input is read; the XDJ-XZ is recognised by name.
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Other input
          <select
            value={selected ?? ''}
            onChange={(e) => selectMidiInput(e.target.value || null)}
            className="max-w-56 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          >
            <option value="">None</option>
            {selected && !connected && (
              <option value={selected} disabled>
                {selected} (not connected)
              </option>
            )}
            {inputs
              .filter((i) => i.connected)
              .map((i) => (
                <option key={i.id} value={i.name}>
                  {i.name}
                </option>
              ))}
          </select>
        </label>
        <button type="button" onClick={stopMidi} className={button}>
          Stop MIDI
        </button>
      </div>
      {inputs.filter((i) => i.connected).length === 0 && (
        <NotAvailable text="No MIDI inputs found. Connect the deck over USB-C, or check that macOS lists it as a MIDI device." />
      )}
      {selected && !connected && (
        <NotAvailable text={`${selected} is not connected; messages resume when it returns.`} />
      )}
    </div>
  )
}

/** Enables Web MIDI and picks the port; every state says what is missing. */
export function MidiPortPicker() {
  const status = useMidiStore((s) => s.status)
  const message = useMidiStore((s) => s.message)
  if (status === 'ready') return <PortSelect />
  if (status === 'requesting') return <Waiting text="waiting for MIDI permission" />
  const text = {
    idle: 'USB-C MIDI is off. No USB-C data is read until you enable it.',
    unsupported: 'N/A: Web MIDI is unavailable here.',
    denied: 'N/A: MIDI permission was refused.',
    error: 'N/A: MIDI could not start.'
  }[status]
  return (
    <div className="flex flex-col items-start gap-2">
      <NotAvailable text={message ? `${text} ${message}` : text} />
      <button type="button" onClick={() => void startMidi()} className={button}>
        {status === 'idle' ? 'Enable USB-C MIDI' : 'Try again'}
      </button>
    </div>
  )
}

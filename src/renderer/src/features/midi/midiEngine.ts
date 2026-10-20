import { useMidiStore, type MidiInputInfo } from '../../store/useMidiStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { handleMidi, resetPipeline } from './midiPipeline'

let access: MIDIAccess | null = null
const attached = new Map<string, MIDIInput>()

function listInputs(): MIDIInput[] {
  return access ? Array.from(access.inputs.values()) : []
}

function detachAll(): void {
  for (const input of attached.values()) input.onmidimessage = null
  attached.clear()
  resetPipeline()
}

/** Listens to every connected input: the data view shows whatever any USB device sends. */
function attach(): void {
  const wanted = listInputs().filter((i) => i.state === 'connected')
  for (const [id, input] of attached) {
    if (!wanted.includes(input)) {
      input.onmidimessage = null
      attached.delete(id)
    }
  }
  for (const input of wanted) {
    if (attached.has(input.id)) continue
    attached.set(input.id, input)
    input.onmidimessage = (e) => {
      if (e.data) handleMidi(input.name ?? 'MIDI input', e.data, e.timeStamp)
    }
  }
  useMidiStore.getState().setListening(wanted.map((i) => i.name ?? i.id))
}

function refresh(): void {
  const inputs: MidiInputInfo[] = listInputs().map((i) => ({
    id: i.id,
    name: i.name ?? i.id,
    manufacturer: i.manufacturer ?? '',
    connected: i.state === 'connected'
  }))
  useMidiStore.getState().setInputs(inputs)
  attach()
}

/** Requests Web MIDI access and lists the inputs; SysEx is requested only so incoming SysEx is not filtered. */
export async function startMidi(): Promise<void> {
  const store = useMidiStore.getState()
  if (typeof navigator.requestMIDIAccess !== 'function') {
    store.setStatus('unsupported', 'Web MIDI is not available in this window')
    return
  }
  store.setStatus('requesting')
  try {
    access = await navigator.requestMIDIAccess({ sysex: true })
  } catch (error) {
    const denied = error instanceof DOMException && error.name === 'SecurityError'
    const message = error instanceof Error ? error.message : 'MIDI access failed'
    store.setStatus(denied ? 'denied' : 'error', message)
    return
  }
  access.onstatechange = refresh
  store.setStatus('ready')
  store.select(useSettingsStore.getState().optional.midiInputName)
  refresh()
}

export function selectMidiInput(name: string | null): void {
  useMidiStore.getState().select(name)
  useSettingsStore.getState().updateOptional({ midiInputName: name })
  attach()
}

export async function setMidiLogging(enabled: boolean): Promise<void> {
  const path = await window.deckpulse.setMidiLog(enabled)
  useMidiStore.getState().setLog(enabled && path !== null, path)
}

export function stopMidi(): void {
  detachAll()
  useMidiStore.getState().setListening([])
  if (access) access.onstatechange = null
  access = null
  useMidiStore.getState().setInputs([])
  useMidiStore.getState().setStatus('idle')
}

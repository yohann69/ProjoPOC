import { epochNow } from '../../lib/frameLoop'
import { useAudioStore } from '../../store/useAudioStore'
import { useMidiStore } from '../../store/useMidiStore'
import { useTicker } from '../../ui/primitives'

function Chip({ label, state, ok }: { label: string; state: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        ok ? 'border-emerald-500 text-emerald-200' : 'border-slate-600 text-slate-300'
      }`}
    >
      <span aria-hidden="true">{ok ? '\u25cf' : '\u25cb'}</span>
      {label}: {state}
    </span>
  )
}

function usbcState(): { state: string; ok: boolean } {
  const s = useMidiStore.getState()
  if (s.status === 'unsupported') return { state: 'unavailable', ok: false }
  if (s.status === 'denied') return { state: 'permission refused', ok: false }
  if (s.status === 'error') return { state: 'error', ok: false }
  if (s.status === 'requesting') return { state: 'waiting for permission', ok: false }
  if (s.status === 'idle') return { state: 'off', ok: false }
  if (s.listening.length === 0) return { state: 'no MIDI port', ok: false }
  const live = s.lastMessageTs !== null && epochNow() - s.lastMessageTs < 3000
  return { state: live ? 'receiving' : 'connected, no messages', ok: live }
}

const AUDIO_STATES = {
  idle: 'off',
  requesting: 'waiting for permission',
  running: 'analysing',
  denied: 'permission refused',
  noDevice: 'no input',
  error: 'error'
} as const

/** Status of the two optional sources, shown separately from the primary source. */
export function OptionalStatus() {
  useTicker(500)
  const audio = useAudioStore((s) => s.status)
  const usbc = usbcState()
  return (
    <div className="flex items-center gap-2" role="status" aria-label="Optional sources">
      <Chip label="USB-C MIDI" state={usbc.state} ok={usbc.ok} />
      <Chip label="Audio" state={AUDIO_STATES[audio]} ok={audio === 'running'} />
    </div>
  )
}

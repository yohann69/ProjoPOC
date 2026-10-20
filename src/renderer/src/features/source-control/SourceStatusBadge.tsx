import type { SourceState } from '@shared/types'
import { useLiveStore } from '../../store/useLiveStore'

const STYLES: Record<SourceState, string> = {
  stopped: 'bg-slate-800 text-slate-300',
  starting: 'bg-sky-900 text-sky-200',
  connecting: 'bg-sky-900 text-sky-200',
  running: 'bg-emerald-900 text-emerald-200',
  online: 'bg-emerald-900 text-emerald-200',
  noDevices: 'bg-amber-900 text-amber-200',
  permissionDenied: 'bg-red-900 text-red-200',
  rekordboxConflict: 'bg-red-900 text-red-200',
  error: 'bg-red-900 text-red-200'
}

const LABELS: Record<SourceState, string> = {
  stopped: 'stopped',
  starting: 'starting',
  connecting: 'connecting',
  running: 'running',
  online: 'online',
  noDevices: 'no devices',
  permissionDenied: 'permission denied',
  rekordboxConflict: 'rekordbox conflict',
  error: 'error'
}

export function SourceStatusBadge() {
  const source = useLiveStore((s) => s.source)
  const state = useLiveStore((s) => s.sourceState)
  const message = useLiveStore((s) => s.sourceMessage)
  return (
    <div className="flex flex-col gap-1">
      <span className={`w-fit rounded px-2 py-0.5 text-xs ${STYLES[state]}`}>
        {source ?? 'no source'}: {LABELS[state]}
      </span>
      {message && <span className="max-w-xl text-xs text-slate-400">{message}</span>}
    </div>
  )
}

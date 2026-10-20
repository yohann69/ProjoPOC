import type { DiagnosticsInfo } from '@shared/diagnostics'
import { useCallback, useEffect, useState } from 'react'
import { useLiveStore } from '../../store/useLiveStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { evaluateChecklist, type CheckItem } from './checklist'
import type { LiveSnapshot } from './formatDiagnostics'

export interface DiagnosticsState {
  info: DiagnosticsInfo | null
  error: string | null
  refresh(): void
}

/** Loads the main-process diagnostics once and again on demand. */
export function useDiagnostics(): DiagnosticsState {
  const [info, setInfo] = useState<DiagnosticsInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(() => {
    window.deckpulse
      .getDiagnostics()
      .then((result) => {
        setInfo(result)
        setError(null)
      })
      .catch((e: unknown) => setError(String(e)))
  }, [])
  useEffect(refresh, [refresh])
  return { info, error, refresh }
}

/** What the renderer knows about the connection right now. */
export function useLiveSnapshot(): LiveSnapshot {
  const iface = useSettingsStore((s) => s.prolink.iface)
  const mode = useSettingsStore((s) => s.prolink.mode)
  const source = useLiveStore((s) => s.source)
  const sourceState = useLiveStore((s) => s.sourceState)
  const sourceMessage = useLiveStore((s) => s.sourceMessage)
  const devices = useLiveStore((s) => s.devices)
  const ports = useLiveStore((s) => s.ports)
  const trackStatus = useLiveStore((s) => s.trackStatus)
  return { iface, mode, source, sourceState, sourceMessage, devices, ports, trackStatus }
}

export function useChecklist(info: DiagnosticsInfo | null): CheckItem[] {
  const live = useLiveSnapshot()
  return evaluateChecklist({
    diagnostics: info,
    iface: live.iface,
    mode: live.mode,
    source: live.source,
    sourceState: live.sourceState,
    devices: live.devices,
    trackStatus: live.trackStatus as Parameters<typeof evaluateChecklist>[0]['trackStatus']
  })
}

import { systemPreferences, type Session } from 'electron'
import type { MicAccessResult } from '@shared/usb'

const MIDI_PERMISSIONS = new Set(['midi', 'midiSysex'])

/**
 * Web MIDI (Electron reports every MIDI request as midiSysex), audio-only capture and clipboard
 * writes; everything else is refused. The app only opens MIDI inputs, never outputs.
 */
export function isPermissionAllowed(permission: string, mediaTypes?: readonly string[]): boolean {
  if (MIDI_PERMISSIONS.has(permission) || permission === 'clipboard-sanitized-write') return true
  if (permission !== 'media') return false
  return (
    !!mediaTypes &&
    mediaTypes.length > 0 &&
    mediaTypes.every((t) => t === 'audio' || t === 'unknown')
  )
}

export function installPermissionHandlers(session: Session): void {
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(
      isPermissionAllowed(permission, 'mediaTypes' in details ? details.mediaTypes : undefined)
    )
  })
  session.setPermissionCheckHandler((_contents, permission, _origin, details) =>
    isPermissionAllowed(permission, details.mediaType ? [details.mediaType] : undefined)
  )
}

/** On macOS the operating system asks for microphone access itself; elsewhere it is not gated. */
export async function requestMicAccess(): Promise<MicAccessResult> {
  if (process.platform !== 'darwin') return { granted: true, status: 'granted' }
  let status = systemPreferences.getMediaAccessStatus('microphone')
  if (status === 'not-determined') {
    await systemPreferences.askForMediaAccess('microphone')
    status = systemPreferences.getMediaAccessStatus('microphone')
  }
  return { granted: status === 'granted', status }
}

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ systemPreferences: {} }))

const { isPermissionAllowed } = await import('./permissions')

describe('isPermissionAllowed', () => {
  it('allows Web MIDI and clipboard writes', () => {
    expect(isPermissionAllowed('midi')).toBe(true)
    expect(isPermissionAllowed('midiSysex')).toBe(true)
    expect(isPermissionAllowed('clipboard-sanitized-write')).toBe(true)
  })

  it('allows audio-only capture and refuses video', () => {
    expect(isPermissionAllowed('media', ['audio'])).toBe(true)
    expect(isPermissionAllowed('media', ['audio', 'video'])).toBe(false)
    expect(isPermissionAllowed('media', ['video'])).toBe(false)
    expect(isPermissionAllowed('media')).toBe(false)
  })

  it('refuses unrelated permissions', () => {
    for (const p of ['geolocation', 'notifications', 'clipboard-read', 'openExternal']) {
      expect(isPermissionAllowed(p)).toBe(false)
    }
  })
})

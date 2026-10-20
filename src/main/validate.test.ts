import { describe, expect, it } from 'vitest'
import {
  parseHookRequest,
  parseInterfaceName,
  parseProlinkConfig,
  parseSettings,
  parseStartRequest
} from './validate'

describe('IPC validation', () => {
  it('accepts valid prolink start requests and settings', () => {
    const config = { mode: 'passive', iface: 'en15', packetLog: true }
    expect(parseStartRequest({ source: 'prolink', config })).toEqual({ source: 'prolink', config })
    expect(parseSettings({ prolink: { ...config, iface: null } }).prolink.iface).toBeNull()
    expect(parseInterfaceName('\\Device\\NPF_{1A2B-3C}')).toBe('\\Device\\NPF_{1A2B-3C}')
    expect(parseInterfaceName('Ethernet 3')).toBe('Ethernet 3')
  })

  it('rejects malformed input from the renderer', () => {
    expect(() => parseProlinkConfig({ mode: 'turbo', iface: null, packetLog: false })).toThrow()
    expect(() => parseProlinkConfig({ mode: 'auto', iface: null, packetLog: 'yes' })).toThrow()
    expect(() =>
      parseProlinkConfig({ mode: 'auto', iface: 'en0; rm -rf /', packetLog: false })
    ).toThrow()
    expect(() => parseStartRequest({ source: 'usbc', config: {} })).toThrow()
    expect(() => parseInterfaceName('')).toThrow()
  })

  it('validates dashboard settings and hook requests, defaulting old settings files', () => {
    const prolink = { mode: 'auto', iface: null, packetLog: false }
    expect(parseSettings({ prolink }).dashboard).toEqual({
      showAllDecks: false,
      reduceMotion: false,
      hookPort: 8765
    })
    const dashboard = { showAllDecks: true, reduceMotion: true, hookPort: 9000 }
    expect(parseSettings({ prolink, dashboard }).dashboard).toEqual(dashboard)
    expect(() => parseSettings({ prolink, dashboard: { ...dashboard, hookPort: 80 } })).toThrow()
    expect(parseHookRequest({ enabled: true, port: 8765 })).toEqual({ enabled: true, port: 8765 })
    expect(() => parseHookRequest({ enabled: 'yes', port: 8765 })).toThrow()
    expect(() => parseHookRequest({ enabled: true, port: 70000 })).toThrow()
    expect(() => parseHookRequest({ enabled: true, port: 8765.5 })).toThrow()
  })
})

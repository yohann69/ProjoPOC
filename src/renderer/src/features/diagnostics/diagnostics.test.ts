import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiagnosticsInfo } from '@shared/diagnostics'
import { reportError } from '../../lib/reportError'
import { evaluateChecklist, sameSubnet, type ChecklistInput } from './checklist'
import { formatDiagnostics } from './formatDiagnostics'

const info = (over: Partial<DiagnosticsInfo> = {}): DiagnosticsInfo => ({
  app: {
    name: 'deckpulse',
    version: '0.1.0',
    platform: 'darwin',
    arch: 'arm64',
    osRelease: '25.0.0',
    electron: '44.0.0',
    node: '24.0.0',
    chrome: '140',
    userData: '/u',
    logFile: '/l/main.log'
  },
  pcap: { moduleLoaded: true, deviceCount: 3, permission: 'ok', permissionDetail: '/dev/bpf0 ok' },
  interfaces: [{ name: 'en7', address: '169.254.10.2', cidr: '169.254.10.2/16' }],
  rekordbox: null,
  errors: [],
  ...over
})

const input = (over: Partial<ChecklistInput> = {}): ChecklistInput => ({
  diagnostics: info(),
  iface: 'en7',
  mode: 'passive',
  source: 'prolink',
  sourceState: 'online',
  devices: [],
  trackStatus: {},
  ...over
})

const status = (checks: ReturnType<typeof evaluateChecklist>, id: string) =>
  checks.find((c) => c.id === id)?.status

describe('sameSubnet', () => {
  it('compares addresses by prefix length', () => {
    expect(sameSubnet('169.254.77.1', '169.254.10.2/16')).toBe(true)
    expect(sameSubnet('192.168.1.5', '169.254.10.2/16')).toBe(false)
    expect(sameSubnet('10.0.0.200', '10.0.0.1/24')).toBe(true)
    expect(sameSubnet('10.0.1.200', '10.0.0.1/24')).toBe(false)
    expect(sameSubnet('1.2.3.4', 'garbage')).toBe(false)
  })
})

describe('evaluateChecklist', () => {
  it('passes when everything is in place', () => {
    const checks = evaluateChecklist(
      input({
        devices: [
          { id: 'a', name: 'XDJ-AZ', kind: 'player', origin: 'ETH_LIVE', ip: '169.254.10.9' }
        ],
        trackStatus: { 1: { state: 'ready' } }
      })
    )
    expect(checks.map((c) => c.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
  })

  it('flags a missing interface, a foreign subnet and a denied capture permission', () => {
    const checks = evaluateChecklist(
      input({
        iface: 'en9',
        devices: [{ id: 'a', name: 'CDJ', kind: 'player', origin: 'ETH_LIVE', ip: '192.168.0.4' }],
        diagnostics: info({
          pcap: {
            moduleLoaded: true,
            deviceCount: 1,
            permission: 'denied',
            permissionDetail: 'no bpf'
          }
        })
      })
    )
    expect(status(checks, 'cable')).toBe('problem')
    expect(status(checks, 'subnet')).toBe('problem')
    expect(status(checks, 'permissions')).toBe('problem')
  })

  it('treats rekordbox as a problem only in active mode', () => {
    const running = info({ rekordbox: 'rekordbox' })
    expect(status(evaluateChecklist(input({ diagnostics: running })), 'rekordbox')).toBe('warning')
    expect(
      status(evaluateChecklist(input({ diagnostics: running, mode: 'active' })), 'rekordbox')
    ).toBe('problem')
  })

  it('reads the USB check from track status and leaves it unknown before a track loads', () => {
    expect(status(evaluateChecklist(input()), 'usb')).toBe('unknown')
    const bad = evaluateChecklist(
      input({ trackStatus: { 2: { state: 'unavailable', message: 'not exported' } } })
    )
    expect(bad.find((c) => c.id === 'usb')).toMatchObject({
      status: 'problem',
      detail: 'not exported'
    })
  })

  it('says unknown while diagnostics load and reports a failed pcap module', () => {
    const waiting = evaluateChecklist(input({ diagnostics: null }))
    expect(status(waiting, 'cable')).toBe('unknown')
    expect(status(waiting, 'permissions')).toBe('unknown')
    const broken = evaluateChecklist(
      input({
        diagnostics: info({
          pcap: {
            moduleLoaded: false,
            error: 'dlopen failed',
            deviceCount: null,
            permission: 'unknown',
            permissionDetail: ''
          }
        })
      })
    )
    expect(broken.find((c) => c.id === 'permissions')?.detail).toContain('dlopen failed')
  })
})

describe('formatDiagnostics', () => {
  it('includes the facts needed for a bug report', () => {
    const text = formatDiagnostics(
      info({ errors: [{ ts: 0, origin: 'source', message: 'Not allowed to capture packets' }] }),
      {
        iface: 'en7',
        mode: 'passive',
        source: 'prolink',
        sourceState: 'permissionDenied',
        sourceMessage: 'no bpf',
        devices: [
          {
            id: 'a',
            name: 'XDJ-AZ',
            kind: 'player',
            deck: 1,
            origin: 'ETH_LIVE',
            ip: '169.254.10.9'
          }
        ],
        ports: [{ port: 50002, packetsPerSecond: 12, total: 400, kinds: { status: 390 } }],
        trackStatus: { 1: { state: 'unavailable', message: 'not exported' } }
      },
      evaluateChecklist(input())
    )
    for (const part of [
      'DeckPulse 0.1.0',
      'Electron 44.0.0',
      'selected interface: en7',
      'permissionDenied - no bpf',
      'XDJ-AZ [player] deck 1 169.254.10.9',
      '50002: 400 total, 12/s status:390',
      'deck 1: unavailable - not exported',
      '[source] Not allowed to capture packets'
    ]) {
      expect(text).toContain(part)
    }
  })
})

describe('reportError', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('forwards errors to the main process and never throws', () => {
    const logRenderer = vi.fn()
    vi.stubGlobal('window', { deckpulse: { logRenderer } })
    reportError(new Error('boom'), 'at Panel')
    expect(logRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom', componentStack: 'at Panel' })
    )
    reportError('plain string')
    expect(logRenderer).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'plain string' })
    )
    vi.stubGlobal('window', {})
    expect(() => reportError(new Error('x'))).not.toThrow()
  })
})

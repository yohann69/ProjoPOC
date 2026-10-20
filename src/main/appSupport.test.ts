import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/prolink'
import { ErrorLog } from './diagnostics/errorLog'
import { bpfAccess, probePcap, type FsProbe } from './diagnostics/pcapProbe'
import { collectDiagnostics } from './diagnostics/collect'
import { SettingsStore, type KeyValueStore } from './settingsStore'
import { parseReplayConfig, parseRendererError, parseUiSettings } from './validateUi'
import { sanitizeBounds } from './windowState'

const memoryStore = (
  initial: Record<string, unknown> = {}
): KeyValueStore & { data: Record<string, unknown> } => {
  const data = { ...initial }
  return {
    data,
    get store() {
      return data
    },
    set: (key, value) => void (data[key] = value)
  }
}

describe('SettingsStore', () => {
  it('returns defaults for an empty file and keeps other sections when one is damaged', () => {
    expect(new SettingsStore(memoryStore()).load()).toEqual(DEFAULT_SETTINGS)
    const store = memoryStore({
      prolink: { mode: 'active', iface: 'en7', packetLog: true },
      dashboard: { showAllDecks: 'yes' },
      ui: { selectedSource: 'prolink', sideTab: 'diagnostics', checklistDismissed: true }
    })
    const loaded = new SettingsStore(store).load()
    expect(loaded.prolink).toEqual({ mode: 'active', iface: 'en7', packetLog: true })
    expect(loaded.dashboard).toEqual(DEFAULT_SETTINGS.dashboard)
    expect(loaded.ui).toEqual({
      selectedSource: 'prolink',
      sideTab: 'diagnostics',
      checklistDismissed: true
    })
  })

  it('saves each section and leaves unrelated keys such as the window bounds alone', () => {
    const store = memoryStore({ window: { width: 900, height: 700 } })
    const settings = {
      ...DEFAULT_SETTINGS,
      prolink: { mode: 'passive' as const, iface: 'en15', packetLog: false }
    }
    new SettingsStore(store).save(settings)
    expect(store.data.window).toEqual({ width: 900, height: 700 })
    expect(new SettingsStore(store).load().prolink.iface).toBe('en15')
    expect(() =>
      new SettingsStore(store).save({ ...settings, prolink: { mode: 'bogus' } } as never)
    ).toThrow()
  })

  describe('with electron-store on disk', () => {
    let dir: string
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'deckpulse-store-'))
    })
    afterEach(() => rmSync(dir, { recursive: true, force: true }))

    it('persists across instances and migrates an old settings file without ui and optional', async () => {
      const { default: Store } = await import('electron-store')
      writeFileSync(
        join(dir, 'settings.json'),
        JSON.stringify({ prolink: { mode: 'passive', iface: 'en3', packetLog: false } })
      )
      const first = new Store<Record<string, unknown>>({ name: 'settings', cwd: dir })
      const settings = new SettingsStore(first)
      expect(settings.load().prolink.iface).toBe('en3')
      expect(settings.load().ui).toEqual(DEFAULT_SETTINGS.ui)
      settings.save({ ...settings.load(), ui: { ...DEFAULT_SETTINGS.ui, sideTab: 'hooks' } })
      const second = new Store<Record<string, unknown>>({ name: 'settings', cwd: dir })
      expect(new SettingsStore(second).load().ui.sideTab).toBe('hooks')
      expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).prolink.iface).toBe('en3')
    })

    it('recovers from a corrupt file with clearInvalidConfig', async () => {
      const { default: Store } = await import('electron-store')
      writeFileSync(join(dir, 'settings.json'), '{ not json')
      const store = new Store<Record<string, unknown>>({
        name: 'settings',
        cwd: dir,
        clearInvalidConfig: true
      })
      expect(new SettingsStore(store).load()).toEqual(DEFAULT_SETTINGS)
    })
  })
})

describe('validateUi', () => {
  it('falls back to defaults for unknown tabs and sources', () => {
    expect(parseUiSettings({ selectedSource: 'x', sideTab: 'y', checklistDismissed: 1 })).toEqual(
      DEFAULT_SETTINGS.ui
    )
    expect(parseUiSettings(undefined)).toEqual(DEFAULT_SETTINGS.ui)
  })

  it('accepts only absolute .jsonl replay paths', () => {
    expect(parseReplayConfig({ path: '/tmp/a.jsonl', loop: true })).toEqual({
      path: '/tmp/a.jsonl',
      loop: true
    })
    expect(() => parseReplayConfig({ path: 'a.jsonl', loop: false })).toThrow()
    expect(() => parseReplayConfig({ path: '/tmp/a.txt', loop: false })).toThrow()
    expect(() => parseReplayConfig({ path: '/tmp/a.jsonl', loop: 'no' })).toThrow()
  })

  it('clips renderer error reports', () => {
    const report = parseRendererError({ message: 'x'.repeat(5000), stack: 's', extra: 1 })
    expect(report.message).toHaveLength(2000)
    expect(report).not.toHaveProperty('extra')
    expect(() => parseRendererError('x')).toThrow()
  })
})

describe('windowState', () => {
  const screen = [{ x: 0, y: 0, width: 1920, height: 1080 }]

  it('keeps a visible position and drops one that no screen shows', () => {
    expect(sanitizeBounds({ width: 1000, height: 700, x: 100, y: 50 }, screen)).toEqual({
      width: 1000,
      height: 700,
      x: 100,
      y: 50
    })
    expect(sanitizeBounds({ width: 1000, height: 700, x: 5000, y: 50 }, screen)).toEqual({
      width: 1000,
      height: 700
    })
  })

  it('clamps tiny sizes and defaults on garbage', () => {
    expect(sanitizeBounds({ width: 10, height: 20 }, screen)).toEqual({ width: 640, height: 640 })
    expect(sanitizeBounds('x', screen)).toEqual({ width: 1200, height: 800 })
  })
})

describe('diagnostics', () => {
  const fs = (devices: string[], open: string[]): FsProbe => ({
    list: () => devices,
    canReadWrite: (path) => open.some((o) => path.endsWith(o))
  })

  it('keeps the newest 50 errors', () => {
    const log = new ErrorLog(() => 1)
    for (let i = 0; i < 60; i++) log.add('main', `e${i}`)
    expect(log.list()).toHaveLength(50)
    expect(log.list()[0]?.message).toBe('e10')
  })

  it('judges macOS BPF access from the devices present', () => {
    expect(bpfAccess(fs(['bpf0', 'bpf1', 'null'], ['bpf1'])).permission).toBe('ok')
    expect(bpfAccess(fs(['bpf0'], [])).permission).toBe('denied')
    expect(bpfAccess(fs(['null'], [])).detail).toContain('No /dev/bpf*')
  })

  it('reports the module state and device count, or why it failed', () => {
    const ok = probePcap(
      () => ({ Cap: { deviceList: () => [{ name: 'en0' }] } }) as never,
      'linux',
      fs([], [])
    )
    expect(ok).toMatchObject({ moduleLoaded: true, deviceCount: 1, permission: 'unknown' })
    const bad = probePcap(
      () => {
        throw new Error('dlopen failed\nstack')
      },
      'darwin',
      fs(['bpf0'], [])
    )
    expect(bad).toMatchObject({ moduleLoaded: false, error: 'dlopen failed', permission: 'denied' })
  })

  it('collects versions, interfaces, rekordbox and errors', async () => {
    const errors = new ErrorLog()
    errors.add('source', 'boom')
    const info = await collectDiagnostics({
      name: 'deckpulse',
      version: '1.2.3',
      userData: '/u',
      logFile: () => '/logs/main.log',
      errors,
      loadCap: () => ({ Cap: { deviceList: () => [] } }) as never,
      findRekordbox: () => Promise.resolve('rekordbox'),
      interfaces: () =>
        ({
          en5: [
            { family: 'IPv4', internal: false, address: '169.254.1.2', cidr: '169.254.1.2/16' }
          ],
          lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1', cidr: '127.0.0.1/8' }]
        }) as never,
      versions: { node: '24.0.0', electron: '44.0.0', chrome: '140' } as never,
      platform: 'linux'
    })
    expect(info.app).toMatchObject({
      version: '1.2.3',
      electron: '44.0.0',
      logFile: '/logs/main.log'
    })
    expect(info.interfaces).toEqual([
      { name: 'en5', address: '169.254.1.2', cidr: '169.254.1.2/16' }
    ])
    expect(info.rekordbox).toBe('rekordbox')
    expect(info.errors.map((e) => e.message)).toEqual(['boom'])
    vi.restoreAllMocks()
  })
})

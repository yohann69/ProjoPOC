import { networkInterfaces } from 'node:os'
import * as library from 'alphatheta-connect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PROLINK_CONFIG, type ProlinkConfig } from '@shared/prolink'
import { TypedEmitter } from '../utils/typedEmitter'
import type { CaptureEvents, PacketCapture } from './prolink/capture'
import type { Library } from './prolink/library'
import type { ProlinkRawEvent } from './prolink/rawTypes'
import { announcePacket } from './prolink/testing/packetBuilders'
import { ProlinkSource, type ProlinkDeps } from './prolink'

const realInterface = Object.entries(networkInterfaces()).find(([, infos]) =>
  infos?.some((i) => i.family === 'IPv4')
)?.[0]

class FakeCapture extends TypedEmitter<CaptureEvents> implements PacketCapture {
  starts = 0
  constructor(
    readonly interfaceName: string,
    private readonly onStart: (capture: FakeCapture) => void = () => undefined
  ) {
    super()
  }
  start(): void {
    this.starts++
    this.onStart(this)
  }
  stop(): void {
    this.removeAllListeners()
  }
}

const sources: ProlinkSource[] = []
afterEach(() => sources.splice(0).forEach((s) => s.stop()))

function run(
  config: Partial<ProlinkConfig>,
  createCapture: ProlinkDeps['createCapture'],
  retryDelaysMs = [10],
  extra: Partial<ProlinkDeps> = {}
) {
  const events: ProlinkRawEvent[] = []
  const source = new ProlinkSource(
    { ...DEFAULT_PROLINK_CONFIG, mode: 'passive', ...config },
    {
      loadLibrary: async () => library,
      createCapture,
      logDir: '/tmp/unused',
      pollMs: 10,
      retryDelaysMs,
      ...extra
    }
  )
  sources.push(source)
  source.on('event', (e) => events.push(e))
  source.start()
  const states = () => events.flatMap((e) => (e.kind === 'status' ? [e.state] : []))
  const waitFor = async (predicate: () => boolean) => {
    for (let i = 0; i < 100 && !predicate(); i++) await new Promise((r) => setTimeout(r, 10))
  }
  return { source, events, states, waitFor }
}

describe.skipIf(!realInterface)('ProlinkSource lifecycle', () => {
  it('tells the user to use active mode when devices are heard but send no status', async () => {
    let capture: FakeCapture | undefined
    const { events, states, waitFor } = run(
      { iface: realInterface ?? null },
      (iface) => (capture = new FakeCapture(iface)),
      [10],
      { noStatusMs: 50, upgradeToActive: false }
    )
    await waitFor(() => states().includes('noDevices'))
    capture?.emit('packet', {
      ts: 1,
      srcAddr: '169.254.1.1',
      srcPort: 50000,
      dstPort: 50000,
      payload: announcePacket({ name: 'XDJ-XZ', device: 1, ip: '169.254.1.1', type: 1 })
    })
    const hinted = (): boolean =>
      events.some((e) => e.kind === 'status' && /Active mode/.test(e.message ?? ''))
    await waitFor(hinted)
    expect(hinted()).toBe(true)
  })
  it('switches from passive to active when devices are heard but send no status', async () => {
    let capture: FakeCapture | undefined
    const online = vi.fn(async () => {
      throw new Error('stub: no network')
    })
    const { events, waitFor } = run(
      { iface: realInterface ?? null },
      (iface) => (capture = new FakeCapture(iface)),
      [10],
      {
        noStatusMs: 50,
        loadLibrary: async () => ({ ...library, bringOnline: online }) as unknown as Library
      }
    )
    await waitFor(() => capture !== undefined)
    capture?.emit('packet', {
      ts: 1,
      srcAddr: '169.254.1.1',
      srcPort: 50000,
      dstPort: 50000,
      payload: announcePacket({ name: 'XDJ-XZ', device: 1, ip: '169.254.1.1', type: 1 })
    })
    await waitFor(() => online.mock.calls.length > 0)
    expect(online).toHaveBeenCalled()
    expect(events.some((e) => e.kind === 'log' && /switching to active mode/.test(e.message))).toBe(
      true
    )
  })
  it('goes online when a device announces itself and reports no devices before that', async () => {
    let capture: FakeCapture | undefined
    const { states, waitFor } = run(
      { iface: realInterface ?? null },
      (iface) => (capture = new FakeCapture(iface))
    )
    await waitFor(() => states().includes('noDevices'))
    capture?.emit('packet', {
      ts: 1,
      srcAddr: '169.254.1.1',
      srcPort: 50000,
      dstPort: 50000,
      payload: announcePacket({ name: 'XDJ-AZ', device: 1, ip: '169.254.1.1', type: 1 })
    })
    await waitFor(() => states().includes('online'))
    expect(states()).toEqual(['connecting', 'noDevices', 'online'])
  })

  it('reports permission denied once and does not retry', async () => {
    let created = 0
    const { states, waitFor } = run({ iface: realInterface ?? null }, (iface) => {
      created++
      return new FakeCapture(iface, () => {
        throw new Error('(cannot open BPF device) /dev/bpf0: Permission denied')
      })
    })
    await waitFor(() => states().includes('permissionDenied'))
    await new Promise((r) => setTimeout(r, 80))
    expect(states()).toEqual(['connecting', 'permissionDenied'])
    expect(created).toBe(1)
  })

  it('keeps retrying without crashing when the interface is gone', async () => {
    const { source, events, waitFor } = run(
      { iface: 'definitely-not-an-interface0' },
      (iface) => new FakeCapture(iface)
    )
    await waitFor(
      () => events.filter((e) => e.kind === 'status' && e.state === 'connecting').length >= 3
    )
    const gone = events.filter((e) => e.kind === 'status' && e.state === 'error')
    expect(gone.length).toBeGreaterThan(0)
    source.stop()
    expect(events[events.length - 1]).toMatchObject({ kind: 'status', state: 'stopped' })
  })

  it('rebuilds the session after the capture reports a failure', async () => {
    const captures: FakeCapture[] = []
    const { states, waitFor } = run({ iface: realInterface ?? null }, (iface) => {
      const c = new FakeCapture(iface)
      captures.push(c)
      return c
    })
    await waitFor(() => captures.length === 1 && captures[0]!.starts === 1)
    captures[0]?.emit('error', new Error('network is down'))
    await waitFor(() => captures.length >= 2)
    expect(captures.length).toBeGreaterThanOrEqual(2)
    expect(states()).toContain('error')
  })
})

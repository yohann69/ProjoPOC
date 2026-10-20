import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestEvent, MidiLogEntry } from '@shared/usb'
import { useMappingStore } from '../../store/useMappingStore'
import { foldControls, useMidiStore, type Received } from '../../store/useMidiStore'
import { decodeMidi } from '../../lib/midiDecode'
import { usbcMixerMissing } from '../panels/mixerReason'
import { handleMidi, resetPipeline } from './midiPipeline'

const row = (bytes: number[], id = 0): Received => ({
  id,
  ts: id,
  port: 'p',
  bytes,
  message: decodeMidi(bytes)
})

describe('foldControls', () => {
  it('tracks last value, range and count per control and skips non-controls', () => {
    const out = foldControls({}, [row([0xb0, 7, 10]), row([0xb0, 7, 90], 1), row([0xf8], 2)])
    expect(Object.keys(out)).toEqual(['cc:1:7'])
    expect(out['cc:1:7']).toMatchObject({ raw: 90, low: 10, high: 90, count: 2, lastTs: 1 })
  })
})

describe('midi pipeline', () => {
  const ingest = vi.fn<(events: IngestEvent[]) => void>()
  const logMidi = vi.fn<(entries: MidiLogEntry[]) => void>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { deckpulse: { ingest, logMidi } })
    useMidiStore.setState({
      stream: [],
      controls: {},
      total: 0,
      hiddenRealtime: 0,
      logEnabled: false
    })
    useMappingStore.setState({ entries: {} })
    ingest.mockClear()
    logMidi.mockClear()
  })
  afterEach(() => {
    resetPipeline()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('sends only mapped controls to the main process, normalized and inverted when asked', () => {
    useMappingStore.getState().update('cc:1:7', { target: 'ch1.fader' })
    useMappingStore.getState().update('cc:1:8', { target: 'ch2.eqLow', invert: true })
    handleMidi('XDJ', [0xb0, 7, 127], 10)
    handleMidi('XDJ', [0xb0, 8, 0], 11)
    handleMidi('XDJ', [0xb0, 9, 64], 12)
    vi.advanceTimersByTime(100)
    expect(ingest).toHaveBeenCalledTimes(1)
    const events = ingest.mock.calls[0]?.[0] ?? []
    expect(events.map((e) => e.kind === 'mixerValue' && [e.target, e.value])).toEqual([
      ['ch1.fader', 1],
      ['ch2.eqLow', 1]
    ])
  })

  it('feeds the documented mixer controls of an XDJ-XZ without any saved mapping', () => {
    handleMidi('XDJ-XZ (2)', [0xb4, 9, 127], 1)
    handleMidi('XDJ-XZ (2)', [0xb4, 5, 0], 2)
    handleMidi('XDJ-XZ (2)', [0xb4, 24, 100], 3)
    handleMidi('Other synth', [0xb4, 9, 127], 4)
    vi.advanceTimersByTime(100)
    const events = ingest.mock.calls.flatMap((c) => c[0])
    expect(events.map((e) => e.kind === 'mixerValue' && [e.target, e.value])).toEqual([
      ['ch2.eqLow', 1],
      ['ch1.color', 0]
    ])
    expect(useMidiStore.getState().controls['cc:5:24']?.raw).toBe(100)
  })

  it('lets a saved mapping override the built-in one', () => {
    useMappingStore.getState().update('cc:5:9', { target: 'ch3.fader', invert: true })
    handleMidi('XDJ-XZ (2)', [0xb4, 9, 127], 1)
    vi.advanceTimersByTime(100)
    const events = ingest.mock.calls.flatMap((c) => c[0])
    expect(events).toMatchObject([{ target: 'ch3.fader', value: 0 }])
  })

  it('coalesces fast moves of one control into the latest value', () => {
    useMappingStore.getState().update('cc:1:7', { target: 'crossfader' })
    for (let v = 0; v < 50; v++) handleMidi('XDJ', [0xb0, 7, v], v)
    vi.advanceTimersByTime(100)
    const events = ingest.mock.calls.flatMap((c) => c[0])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ target: 'crossfader', value: 49 / 127 })
  })

  it('counts hidden clock messages and logs everything when logging is on', () => {
    useMidiStore.setState({ logEnabled: true })
    handleMidi('XDJ', [0xf8], 1)
    handleMidi('XDJ', [0xb0, 1, 1], 2)
    vi.advanceTimersByTime(300)
    const { stream, hiddenRealtime, total } = useMidiStore.getState()
    expect([stream.length, hiddenRealtime, total]).toEqual([1, 1, 2])
    expect(logMidi.mock.calls[0]?.[0]).toHaveLength(2)
    expect(ingest).not.toHaveBeenCalled()
  })
})

describe('usbcMixerMissing', () => {
  const base = {
    status: 'ready',
    selected: 'AZ',
    connected: true,
    mappedTargets: 1,
    messages: 5
  } as const

  it('names the first thing missing', () => {
    expect(usbcMixerMissing({ ...base, status: 'idle' })).toContain('not enabled')
    expect(usbcMixerMissing({ ...base, selected: null })).toContain('no MIDI input')
    expect(usbcMixerMissing({ ...base, connected: false })).toContain('AZ is not connected')
    expect(usbcMixerMissing({ ...base, mappedTargets: 0 })).toContain('mapped')
    expect(usbcMixerMissing({ ...base, messages: 0 })).toContain('no MIDI message')
    expect(usbcMixerMissing(base)).toContain('have not moved')
  })
})

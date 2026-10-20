import { describe, expect, it } from 'vitest'
import { classifyError, ProlinkError } from './errors'
import { beatPacket, statusPacket } from './testing/packetBuilders'
import { packetKind, parseBeatPacket } from './packets'
import { DeckMapper } from './deckMap'
import { BeatMerger } from './beatMerger'

describe('classifyError', () => {
  it('detects a rekordbox / port conflict', () => {
    const error = Object.assign(new Error('bind EADDRINUSE 0.0.0.0:50000'), { code: 'EADDRINUSE' })
    const result = classifyError(error)
    expect(result).toMatchObject({
      kind: 'rekordboxConflict',
      sourceState: 'rekordboxConflict',
      retryable: true
    })
    expect(result.message).toContain('rekordbox')
  })

  it('detects permission problems with per-platform help and does not retry them', () => {
    const mac = classifyError(new Error('/dev/bpf0: Permission denied'), 'darwin')
    expect(mac).toMatchObject({ kind: 'permissionDenied', retryable: false })
    expect(mac.message).toContain('/dev/bpf')
    expect(classifyError(new Error('Access denied'), 'win32').message).toContain('Npcap')
    expect(classifyError(new Error('Operation not permitted'), 'linux').message).toContain('setcap')
  })

  it('detects a missing or mis-built native module and a missing interface', () => {
    expect(classifyError(new Error("Cannot find module 'cap'"))).toMatchObject({
      kind: 'pcapUnavailable',
      retryable: false
    })
    expect(classifyError(new Error('en99: No such device exists'))).toMatchObject({
      kind: 'noInterface'
    })
    expect(classifyError(new Error('boom'))).toMatchObject({ kind: 'other', sourceState: 'error' })
  })

  it('keeps an existing ProlinkError unchanged', () => {
    const error = new ProlinkError('noInterface', 'x')
    expect(classifyError(error)).toBe(error)
  })
})

describe('packet decoding', () => {
  it('parses beat packets per the DJ Link layout', () => {
    expect(
      parseBeatPacket(beatPacket({ device: 2, beatInBar: 4, bpm: 127.5, pitchPercent: -3.5 }))
    ).toEqual({
      deviceNumber: 2,
      beatInBar: 4,
      trackBpm: 127.5,
      pitchPercent: -3.5
    })
  })

  it('rejects other packet types, short packets and invalid beat numbers', () => {
    expect(parseBeatPacket(statusPacket({ device: 1 }))).toBeNull()
    expect(
      parseBeatPacket(beatPacket({ device: 1, beatInBar: 4, bpm: 120 }).subarray(0, 0x40))
    ).toBeNull()
    expect(parseBeatPacket(beatPacket({ device: 1, beatInBar: 0, bpm: 120 }))).toBeNull()
    expect(parseBeatPacket(Buffer.from('hello'))).toBeNull()
  })

  it('names known packet kinds and labels the rest by type byte', () => {
    expect(packetKind(50001, beatPacket({ device: 1, beatInBar: 1, bpm: 120 }))).toBe('beat')
    expect(packetKind(50002, statusPacket({ device: 1 }))).toBe('status')
    expect(packetKind(50000, Buffer.from('xx'))).toBe('foreign')
    const unknown = statusPacket({ device: 1 })
    unknown[0x0a] = 0x55
    expect(packetKind(50001, unknown)).toBe('type_0x55')
  })
})

describe('DeckMapper', () => {
  it('keeps numbers 1-4 and assigns other players to the lowest free deck without hardcoding', () => {
    const notes: string[] = []
    const mapper = new DeckMapper((m) => notes.push(m))
    expect(mapper.deckFor(2)).toBe(2)
    expect(mapper.deckFor(9)).toBe(1)
    expect(mapper.deckFor(10)).toBe(3)
    expect(mapper.deckFor(11)).toBe(4)
    expect(mapper.deckFor(12)).toBeNull()
    expect(mapper.deckFor(9)).toBe(1)
    expect(notes).toHaveLength(5)
  })
})

describe('BeatMerger', () => {
  it('derives beats from status only while no beat packets arrive', () => {
    const merger = new BeatMerger()
    expect(merger.fromStatus(1, 0, 1, true)).toBeNull()
    expect(merger.fromStatus(1, 100, 2, true)).toMatchObject({ beatInBar: 2, source: 'status' })
    merger.fromPacket(1, 150, 3)
    expect(merger.fromStatus(1, 300, 3, true)).toBeNull()
    expect(merger.fromStatus(1, 2500, 4, true)).toMatchObject({ beatInBar: 4 })
    expect(merger.fromStatus(1, 2600, 1, false)).toBeNull()
  })
})

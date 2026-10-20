import { describe, expect, it } from 'vitest'
import { parseBeatPacket } from './packets'

/** Four consecutive beat packets captured from an XDJ-XZ (88 bytes each, device 1) on 2026-10-20. */
const HEADER =
  '51 73 70 74 31 57 6d 4a 4f 4c 28 58 44 4a 2d 58 5a 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 01 00 3c'
const PADDING = Array.from({ length: 24 }, () => 'ff').join(' ')
const packet = (fields: string): Buffer =>
  Buffer.from(
    `${HEADER} ${fields} ${PADDING} 00 0f f1 a9`.replace(/\s+/g, ' ').trim().split(' ').join(''),
    'hex'
  )

const CAPTURED = [
  packet('00 00 01 eb 00 00 03 d6 00 00 07 ad 00 00 07 ad 00 00 0f 5a 00 00 0f 5a'),
  packet('00 00 01 eb 00 00 03 d7 00 00 05 c2 00 00 07 ad 00 00 0d 6f 00 00 0f 5b'),
  packet('00 00 01 ec 00 00 03 d7 00 00 03 d7 00 00 07 ae 00 00 0b 84 00 00 0f 5b'),
  packet('00 00 01 eb 00 00 03 d6 00 00 01 eb 00 00 07 ad 00 00 09 98 00 00 0f 5a')
]

describe('parseBeatPacket with the 88-byte XDJ-XZ layout', () => {
  it('has the captured length', () => {
    expect(CAPTURED.map((p) => p.length)).toEqual([88, 88, 88, 88])
  })

  it('recovers the beat in the bar from the time left to the next bar', () => {
    expect(CAPTURED.map((p) => parseBeatPacket(p)?.beatInBar)).toEqual([1, 2, 3, 4])
  })

  it('reads the device number, pitch and a track BPM consistent with the beat interval', () => {
    const beat = parseBeatPacket(CAPTURED[0]!)
    expect(beat?.deviceNumber).toBe(1)
    expect(beat?.pitchPercent).toBe(-0.35)
    // 491 ms per beat is 122.2 BPM at -0.35% pitch, so the track runs at about 122.6 BPM.
    expect(beat?.trackBpm).toBeCloseTo(122.6, 1)
  })

  it('rejects packets with unusable timing', () => {
    const stopped = packet(
      'ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff'
    )
    expect(parseBeatPacket(stopped)).toBeNull()
    const zero = packet('00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00')
    expect(parseBeatPacket(zero)).toBeNull()
  })
})

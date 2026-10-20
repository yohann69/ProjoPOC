import type { BeatInBar, DeckId } from '@shared/types'

const PACKET_FRESH_MS = 2000

export interface MergedBeat {
  deck: DeckId
  beatInBar: BeatInBar
  ts: number
  /** `packet` beats carry the arrival time of a beat packet; `status` beats are only as exact as status polling. */
  source: 'packet' | 'status'
}

/**
 * Beat packets are the precise source. When a deck sends none (unverified for the XDJ-AZ), beats
 * are derived from changes of beatInMeasure in its status packets instead.
 */
export class BeatMerger {
  private readonly lastPacketTs = new Map<DeckId, number>()
  private readonly lastStatusBeat = new Map<DeckId, number>()

  fromPacket(deck: DeckId, ts: number, beatInBar: BeatInBar): MergedBeat {
    this.lastPacketTs.set(deck, ts)
    return { deck, beatInBar, ts, source: 'packet' }
  }

  fromStatus(deck: DeckId, ts: number, beatInMeasure: number, playing: boolean): MergedBeat | null {
    const previous = this.lastStatusBeat.get(deck)
    this.lastStatusBeat.set(deck, beatInMeasure)
    if (previous === undefined) return null
    const packetTs = this.lastPacketTs.get(deck)
    if (packetTs !== undefined && ts - packetTs < PACKET_FRESH_MS) return null
    if (!playing || beatInMeasure < 1 || beatInMeasure > 4 || beatInMeasure === previous)
      return null
    return { deck, beatInBar: beatInMeasure as BeatInBar, ts, source: 'status' }
  }
}

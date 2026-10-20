import type { BeatInBar, DeckId, TrackInfo } from '@shared/types'
import { SimChannel } from './channel'

export interface BeatTick {
  ts: number
  beatNumber: number
}

export interface PitchDrift {
  base: number
  amp: number
  periodS: number
  t0S: number
}

const EPS = 1e-6
const ON_AIR_FADER = 0.05

export const barPosition = (beatNumber: number): BeatInBar =>
  ((((beatNumber % 4) + 4) % 4) + 1) as BeatInBar

export class SimDeck {
  track: TrackInfo | null = null
  posMs = 0
  playing = false
  /** True from load until the first play. */
  cued = false
  ended = false
  synced = false
  pitchPercent = 0
  drift: PitchDrift = { base: 0, amp: 0, periodS: 100, t0S: 0 }
  readonly channel = new SimChannel()
  private startAtTs: number | null = null
  private lastBeat = -1

  constructor(readonly id: DeckId) {}

  get periodMs(): number {
    return this.track ? 60000 / this.track.bpmGrid.bpm : 0
  }

  get rate(): number {
    return 1 + this.pitchPercent / 100
  }

  get effectiveBpm(): number | null {
    return this.track ? this.track.bpmGrid.bpm * this.rate : null
  }

  get onAir(): boolean {
    return this.playing && this.channel.fader > ON_AIR_FADER
  }

  /** Bar position of the most recent beat; null until a beat has passed. */
  get beatInBar(): BeatInBar | null {
    return this.playing && this.lastBeat >= 0 ? barPosition(this.lastBeat) : null
  }

  load(track: TrackInfo, cueMs: number): void {
    this.track = track
    this.posMs = cueMs
    this.playing = false
    this.cued = true
    this.ended = false
    this.startAtTs = null
    const { bpm, firstBeatMs } = track.bpmGrid
    this.lastBeat = Math.ceil(((cueMs - firstBeatMs) * bpm) / 60000 - EPS) - 1
  }

  playAt(ts: number): void {
    if (this.track && !this.playing) this.startAtTs = ts
  }

  pause(): void {
    this.playing = false
    this.startAtTs = null
  }

  /** Real time at which the next downbeat reaches the playhead, assuming constant pitch. */
  nextDownbeatTs(now: number): number {
    if (!this.track || !this.playing) return now
    const { firstBeatMs } = this.track.bpmGrid
    const nextBeat = Math.floor((this.posMs - firstBeatMs) / this.periodMs + EPS) + 1
    const downbeat = Math.ceil(nextBeat / 4) * 4
    return now + (firstBeatMs + downbeat * this.periodMs - this.posMs) / this.rate
  }

  /** Moves the playhead from real time `from` to `to` at the current pitch; returns exact beat times. */
  advance(from: number, to: number): BeatTick[] {
    const track = this.track
    if (!track) return []
    let start = from
    if (!this.playing) {
      if (this.startAtTs === null || this.startAtTs > to) return []
      start = Math.max(from, this.startAtTs)
      this.startAtTs = null
      this.playing = true
      this.cued = false
    }
    const rate = this.rate
    const pos0 = this.posMs
    const pos1 = Math.min(pos0 + (to - start) * rate, track.durationMs)
    const ticks: BeatTick[] = []
    for (let n = this.lastBeat + 1; ; n++) {
      const gridMs = track.bpmGrid.firstBeatMs + n * this.periodMs
      if (gridMs > pos1 + EPS) break
      ticks.push({ ts: Math.max(start, start + (gridMs - pos0) / rate), beatNumber: n })
      this.lastBeat = n
    }
    this.posMs = pos1
    if (pos1 >= track.durationMs) {
      this.playing = false
      this.ended = true
    }
    return ticks
  }
}

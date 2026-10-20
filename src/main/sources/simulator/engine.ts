import { SCENARIO_DECK_COUNT, type SimulatorConfig } from '@shared/simulator'
import { DECK_IDS } from '@shared/types'
import { barPosition, SimDeck } from './deck'
import { Director } from './director'
import type { SimRawEvent } from './rawTypes'
import { deckRaw, mixerRaw } from './rawEvents'
import { createRng } from './rng'

export const MAX_STEP_MS = 10
export const DECK_TICK_MS = 100
export const MIXER_TICK_MS = 250
const MAX_PITCH_PERCENT = 16

/**
 * Deterministic simulation driven by an external clock: `advance(now)` returns every event up to
 * `now`. Beat events carry their exact scheduled time, not the time `advance` was called.
 */
export class SimulatorEngine {
  private readonly decks: [SimDeck, ...SimDeck[]]
  private readonly director: Director
  private readonly buffer: SimRawEvent[] = []
  private lastTs: number
  private nextDeckTick: number
  private nextMixerTick: number

  constructor(config: SimulatorConfig, startTs: number) {
    const count = SCENARIO_DECK_COUNT[config.scenario]
    const [first, ...rest] = DECK_IDS.slice(0, count).map((id) => new SimDeck(id))
    if (!first) throw new Error('Simulator needs at least one deck')
    this.decks = [first, ...rest]
    this.lastTs = startTs
    this.nextDeckTick = startTs
    this.nextMixerTick = startTs
    this.buffer.push({ kind: 'devices', ts: startTs, decks: this.decks.map((d) => d.id) })
    this.director = new Director(
      createRng(config.seed),
      this.decks,
      config.scenario,
      startTs,
      (event) => this.buffer.push(event)
    )
  }

  advance(now: number): SimRawEvent[] {
    while (this.lastTs < now) {
      const to = Math.min(now, this.lastTs + MAX_STEP_MS)
      const mark = this.buffer.length
      this.step(this.lastTs, to)
      const fresh = this.buffer.splice(mark).sort((a, b) => a.ts - b.ts)
      this.buffer.push(...fresh)
      this.lastTs = to
    }
    return this.buffer.splice(0)
  }

  private step(from: number, to: number): void {
    this.director.update(from)
    this.applyPitch(from)
    for (const deck of this.decks) {
      deck.channel.step(to - from)
      for (const tick of deck.advance(from, to)) {
        const beatInBar = barPosition(tick.beatNumber)
        this.buffer.push({ kind: 'beat', ts: tick.ts, deck: deck.id, beatInBar })
      }
    }
    for (; this.nextDeckTick <= to; this.nextDeckTick += DECK_TICK_MS) {
      for (const deck of this.decks) {
        this.buffer.push(deckRaw(deck, this.nextDeckTick, deck === this.director.master))
      }
    }
    for (; this.nextMixerTick <= to; this.nextMixerTick += MIXER_TICK_MS) {
      this.buffer.push(mixerRaw(this.decks, this.nextMixerTick))
    }
  }

  private applyPitch(now: number): void {
    const seconds = now / 1000
    const drift = (deck: SimDeck): number =>
      deck.drift.base +
      deck.drift.amp * Math.sin((2 * Math.PI * (seconds - deck.drift.t0S)) / deck.drift.periodS)
    const master = this.director.master
    master.pitchPercent = drift(master)
    const masterBpm = master.effectiveBpm
    for (const deck of this.decks) {
      if (deck === master) continue
      if (deck.synced && deck.track && masterBpm !== null) {
        const follow = (masterBpm / deck.track.bpmGrid.bpm - 1) * 100
        deck.pitchPercent = Math.max(-MAX_PITCH_PERCENT, Math.min(MAX_PITCH_PERCENT, follow))
      } else {
        deck.pitchPercent = drift(deck)
      }
    }
  }
}

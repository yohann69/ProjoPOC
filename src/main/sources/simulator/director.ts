import type { Scenario } from '@shared/simulator'
import type { SimDeck } from './deck'
import type { SimRawEvent } from './rawTypes'
import { between, pick, type Rng } from './rng'
import { createTrack, MAX_BPM, MIN_BPM } from './trackFactory'

const TRANSITION_GAP_MS: Record<Scenario, readonly [number, number]> = {
  single: [0, 0],
  mixing2: [30000, 60000],
  chaos4: [12000, 25000]
}
const END_MARGIN_MS = 25000
const RESTART_DELAY_MS = 2000

interface Transition {
  from: SimDeck
  to: SimDeck
  startTs: number
  durMs: number
}

/** Scripts what a DJ would do: loading tracks, pausing, and mixing from one deck to the next. */
export class Director {
  master: SimDeck
  private transition: Transition | null = null
  private nextTransitionTs: number
  private nextExtraTs: number
  private nextPauseTs: number
  private resumeTs: number | null = null
  private trackCount = 0

  constructor(
    private readonly rng: Rng,
    private readonly decks: [SimDeck, ...SimDeck[]],
    private readonly scenario: Scenario,
    startTs: number,
    private readonly emit: (event: SimRawEvent) => void
  ) {
    this.master = decks[0]
    const firstBpm = between(rng, MIN_BPM, MAX_BPM)
    for (const deck of decks) {
      deck.drift = {
        base: between(rng, -3, 3),
        amp: between(rng, 0.2, 0.5),
        periodS: between(rng, 90, 180),
        t0S: startTs / 1000
      }
      this.loadNext(deck, startTs, firstBpm)
    }
    this.master.channel.snapFader(1)
    this.master.playAt(startTs)
    this.nextTransitionTs = startTs + this.gap()
    this.nextExtraTs = startTs + between(rng, 4000, 9000)
    this.nextPauseTs = startTs + between(rng, 25000, 50000)
  }

  update(now: number): void {
    this.handleEnded(now)
    if (this.transition) this.runTransition(this.transition, now)
    else if (this.scenario === 'single') this.runPauseCycle(now)
    else if (now >= this.nextTransitionTs || this.masterNearEnd()) this.beginTransition(now)
    if (this.scenario === 'chaos4') this.runExtras(now)
  }

  private gap(): number {
    const [min, max] = TRANSITION_GAP_MS[this.scenario]
    return between(this.rng, min, max)
  }

  private loadNext(deck: SimDeck, ts: number, targetBpm: number): void {
    const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, targetBpm * between(this.rng, 0.96, 1.04)))
    const id = `sim-${++this.trackCount}`
    const track = createTrack(this.rng, id, Math.round(bpm * 10) / 10)
    deck.load(track, track.cues[0]?.positionMs ?? 0)
    deck.channel.faderTarget = 0
    deck.channel.eqLowTarget = 1
    this.emit({ kind: 'track', ts, deck: deck.id, track })
  }

  private masterBpm(): number {
    return this.master.effectiveBpm ?? MIN_BPM
  }

  private masterNearEnd(): boolean {
    const track = this.master.track
    return !!track && track.durationMs - this.master.posMs < END_MARGIN_MS
  }

  private handleEnded(now: number): void {
    for (const deck of this.decks) {
      if (!deck.ended) continue
      this.loadNext(deck, now, this.masterBpm())
      if (deck === this.master) {
        deck.channel.snapFader(1)
        deck.playAt(now + RESTART_DELAY_MS)
      }
    }
  }

  private runPauseCycle(now: number): void {
    if (this.resumeTs !== null) {
      if (now < this.resumeTs) return
      this.master.playAt(now)
      this.resumeTs = null
      this.nextPauseTs = now + between(this.rng, 25000, 50000)
    } else if (now >= this.nextPauseTs && this.master.playing) {
      this.master.pause()
      this.resumeTs = now + between(this.rng, 3000, 6000)
    }
  }

  private beginTransition(now: number): void {
    const candidates = this.decks.filter((d) => d !== this.master && d.track)
    if (candidates.length === 0) return
    const to = pick(this.rng, candidates)
    const from = this.master
    let startTs = now
    if (!to.playing) {
      startTs = from.nextDownbeatTs(now)
      to.synced = true
      to.playAt(startTs)
    }
    const beats = this.rng() < 0.5 ? 16 : 32
    this.transition = { from, to, startTs, durMs: beats * (60000 / this.masterBpm()) }
  }

  private runTransition(t: Transition, now: number): void {
    if (now < t.startTs) return
    const progress = Math.min(1, (now - t.startTs) / t.durMs)
    const swapped = progress >= 0.5
    t.to.channel.faderTarget = Math.min(1, progress * 2)
    t.to.channel.eqLowTarget = swapped ? 1 : 0.15
    t.from.channel.faderTarget = 1 - progress
    t.from.channel.eqLowTarget = swapped ? 0.15 : 1
    if (swapped && this.master === t.from) this.handOverMaster(t, now)
    if (progress >= 1) this.finishTransition(t, now)
  }

  private handOverMaster({ from, to }: Transition, now: number): void {
    this.master = to
    to.synced = false
    to.drift = { ...to.drift, base: to.pitchPercent, t0S: now / 1000 }
    from.synced = true
  }

  private finishTransition({ from }: Transition, now: number): void {
    from.pause()
    from.channel.snapFader(0)
    from.synced = false
    this.loadNext(from, now, this.masterBpm())
    this.transition = null
    this.nextTransitionTs = now + this.gap()
  }

  // Chaos scenario: non-master decks start and stop at random, some briefly on air.
  private runExtras(now: number): void {
    if (now < this.nextExtraTs) return
    this.nextExtraTs = now + between(this.rng, 4000, 9000)
    const busy = this.transition ? [this.transition.from, this.transition.to] : []
    const options = this.decks.filter((d) => d !== this.master && !busy.includes(d) && d.track)
    if (options.length === 0) return
    const deck = pick(this.rng, options)
    if (deck.playing) {
      deck.pause()
      deck.channel.faderTarget = 0
    } else {
      deck.synced = this.rng() < 0.6
      deck.playAt(now)
      deck.channel.faderTarget = this.rng() < 0.3 ? 0.7 : 0
    }
  }
}

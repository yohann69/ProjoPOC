import type { DeckId, MixerState, Tagged } from '@shared/types'

const KEEP_MS = 60_000
export const MIXER_WINDOW_MS = 30_000

interface Point {
  ts: number
  value: number
}

/** Recent mixer values per control, so a fade can be judged after the fact. */
export class MixerHistory {
  /** Keyed `usbc:` or `primary:` plus the control, so two sources never interleave in one series. */
  private readonly series = new Map<string, Point[]>()

  reset(): void {
    this.series.clear()
  }

  record(mixer: MixerState): void {
    const source = mixer.source === 'usbc' ? 'usbc' : 'primary'
    this.push(`${source}:crossfader`, mixer.crossfader)
    for (const [deck, channel] of Object.entries(mixer.channels)) {
      this.push(`${source}:ch${deck}`, channel?.fader)
    }
  }

  hasCrossfader(): boolean {
    return this.seriesFor('crossfader') !== undefined
  }

  hasFader(deck: DeckId): boolean {
    return this.seriesFor(`ch${deck}`) !== undefined
  }

  /** How far the latest value rose above, or fell below, its extremes inside the window. */
  swing(key: 'crossfader' | `ch${DeckId}`, ts: number): { rise: number; fall: number } {
    const recent = (this.seriesFor(key) ?? []).filter((p) => ts - p.ts <= MIXER_WINDOW_MS)
    const latest = recent.at(-1)
    if (!latest) return { rise: 0, fall: 0 }
    const values = recent.map((p) => p.value)
    return { rise: latest.value - Math.min(...values), fall: Math.max(...values) - latest.value }
  }

  /** USB-C values win when both sources have the control. */
  private seriesFor(control: string): Point[] | undefined {
    return this.series.get(`usbc:${control}`) ?? this.series.get(`primary:${control}`)
  }

  private push(key: string, tagged: Tagged<number> | undefined): void {
    if (!tagged) return
    const points = this.series.get(key) ?? []
    if (points.length === 0) this.series.set(key, points)
    if (points.at(-1)?.ts === tagged.ts) return
    points.push({ ts: tagged.ts, value: tagged.value })
    while (points.length > 1 && tagged.ts - (points[0]?.ts ?? 0) > KEEP_MS) points.shift()
  }
}

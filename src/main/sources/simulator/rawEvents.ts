import type { SimDeck } from './deck'
import type { SimRawEvent } from './rawTypes'

export function deckRaw(deck: SimDeck, ts: number, isMaster: boolean): SimRawEvent {
  const track = deck.track
  return {
    kind: 'deck',
    ts,
    deck: deck.id,
    playState: !track ? 'empty' : deck.playing ? 'playing' : deck.cued ? 'cued' : 'paused',
    trackId: track?.id ?? null,
    bpm: deck.effectiveBpm,
    pitchPercent: track ? deck.pitchPercent : null,
    beatInBar: deck.beatInBar,
    positionMs: track ? deck.posMs : null,
    isMaster,
    isSynced: deck.synced,
    isOnAir: deck.onAir
  }
}

export function mixerRaw(decks: readonly SimDeck[], ts: number): SimRawEvent {
  return {
    kind: 'mixer',
    ts,
    crossfader: 0.5,
    channels: decks.map(({ id, channel }) => ({
      deck: id,
      fader: channel.fader,
      eqHigh: channel.eqHigh,
      eqMid: channel.eqMid,
      eqLow: channel.eqLow
    }))
  }
}

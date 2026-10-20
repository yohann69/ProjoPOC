import type { CDJStatus, Device, MediaSlotInfo } from 'alphatheta-connect'
import type { SessionContext } from './context'
import type { CapturedPacket } from './capture'
import { BeatMerger } from './beatMerger'
import { DeckMapper } from './deckMap'
import { describeFields, flatten } from './fields'
import { parseBeatPacket } from './packets'
import { isPlayingCode } from './playState'
import { PositionTracker } from './position'
import type { ProlinkDevice, ProlinkDeviceKind, ProlinkDeckStatus } from './rawTypes'
import { SnapshotPublisher } from './snapshots'
import { TrackLoader, type TrackLoaderDeps } from './trackLoader'

/** Values of alphatheta-connect's DeviceType. */
const DEVICE_KINDS: Record<number, ProlinkDeviceKind> = { 1: 'player', 3: 'mixer', 4: 'rekordbox' }

const macText = (mac: Uint8Array): string =>
  [...mac].map((b) => b.toString(16).padStart(2, '0')).join(':')

export function toDeckStatus(s: CDJStatus.State): ProlinkDeckStatus {
  return {
    deviceId: s.deviceId,
    trackId: s.trackId,
    trackDeviceId: s.trackDeviceId,
    trackSlot: s.trackSlot,
    trackType: s.trackType,
    playState: s.playState,
    isOnAir: s.isOnAir,
    isSync: s.isSync,
    isMaster: s.isMaster,
    trackBpm: s.trackBPM,
    effectivePitch: s.effectivePitch,
    beatInMeasure: s.beatInMeasure,
    beat: s.beat
  }
}

/** Turns library status events and beat packets into raw events; shared by passive and active mode. */
export class DeckPipeline {
  readonly decks: DeckMapper
  readonly loader: TrackLoader
  private readonly beats = new BeatMerger()
  private readonly positions = new PositionTracker()
  private readonly snapshots: SnapshotPublisher

  constructor(
    private readonly ctx: SessionContext,
    loaderDeps: TrackLoaderDeps,
    private readonly listDevices: () => Device[]
  ) {
    this.snapshots = new SnapshotPublisher(ctx)
    this.decks = new DeckMapper((message) => {
      ctx.log('info', message)
      this.emitDevices()
    })
    this.loader = new TrackLoader(loaderDeps, ctx)
  }

  stop(): void {
    this.loader.stop()
  }

  emitDevices(): void {
    const devices: ProlinkDevice[] = this.listDevices().map((d) => ({
      id: d.id,
      name: d.name,
      ip: d.ip.address,
      kind: DEVICE_KINDS[d.type] ?? 'other',
      deck: this.decks.deckOf(d.id)
    }))
    this.ctx.emit({ kind: 'devices', ts: this.ctx.now(), devices })
    for (const d of this.listDevices()) {
      this.snapshots.publish(`eth.device.${d.id}`, `Device ${d.id}: ${d.name}`, {
        ...describeFields({ id: d.id, name: d.name, type: d.type }),
        ip: d.ip.address,
        mac: macText(d.macAddr),
        lastActive: d.lastActive?.toISOString() ?? null,
        deck: this.decks.deckOf(d.id) ?? null
      })
    }
  }

  onMediaSlot(info: MediaSlotInfo): void {
    this.snapshots.publish(
      `eth.media.${info.deviceId}.${info.slot}`,
      `Media: device ${info.deviceId}, slot ${info.slot}`,
      describeFields(info)
    )
  }

  onAir(status: CDJStatus.OnAirStatus): void {
    this.snapshots.publish(
      `eth.onair.${status.deviceId}`,
      `On-air flags from mixer ${status.deviceId}`,
      flatten(status)
    )
  }

  onMixerState(state: CDJStatus.MixerState): void {
    this.snapshots.publish(
      `eth.mixer.${state.deviceId}`,
      `Mixer state: ${state.deviceName} (${state.deviceId})`,
      flatten(state),
      true
    )
  }

  onPosition(position: CDJStatus.PositionState): void {
    this.snapshots.publish(
      `eth.position.${position.deviceId}`,
      `Absolute position: device ${position.deviceId}`,
      describeFields(position),
      true
    )
  }

  onDevice(action: 'connected' | 'disconnected', device: Device): void {
    this.ctx.log(
      'info',
      `device ${action}: ${device.name} number ${device.id} type ${device.type} ip ${device.ip.address}`
    )
    this.emitDevices()
  }

  onStatus(state: CDJStatus.State): void {
    const ts = this.ctx.now()
    const deck = this.decks.deckFor(state.deviceId)
    if (!deck) {
      this.snapshots.publish(
        `eth.status.${state.deviceId}`,
        `Status from device ${state.deviceId} (no deck)`,
        describeFields(state),
        true
      )
      return
    }
    const status = toDeckStatus(state)
    const positionMs = this.positions.positionMs(
      deck,
      status.beat,
      ts,
      isPlayingCode(state.playState),
      status.effectivePitch > -100 ? status.effectivePitch : 0,
      this.loader.beatToMs(deck)
    )
    this.snapshots.publish(
      `eth.deck.${deck}`,
      `Deck ${deck}: status from device ${state.deviceId}`,
      {
        ...describeFields(state),
        'derived.deck': deck,
        'derived.positionMs': positionMs === null ? null : Math.round(positionMs)
      },
      true
    )
    this.ctx.emit({ kind: 'deck', ts, deck, status, positionMs })
    const beat = this.beats.fromStatus(
      deck,
      ts,
      state.beatInMeasure,
      isPlayingCode(state.playState)
    )
    if (beat) {
      this.ctx.emit({
        kind: 'beat',
        ts,
        deck,
        beatInBar: beat.beatInBar,
        trackBpm: state.trackBPM,
        pitchPercent: state.effectivePitch
      })
    }
    this.loader.onStatus(deck, status)
  }

  onBeatPacket(packet: CapturedPacket): void {
    const beat = parseBeatPacket(packet.payload)
    if (!beat) return
    const deck = this.decks.deckOf(beat.deviceNumber)
    if (deck === undefined) {
      this.ctx.observe(
        `beat-unmapped:${beat.deviceNumber}`,
        `beat packets from device ${beat.deviceNumber}, which has sent no status (a mixer metronome?); not used for decks`
      )
      return
    }
    this.beats.fromPacket(deck, packet.ts, beat.beatInBar)
    this.ctx.emit({
      kind: 'beat',
      ts: packet.ts,
      deck,
      beatInBar: beat.beatInBar,
      trackBpm: beat.trackBpm,
      pitchPercent: beat.pitchPercent
    })
  }
}

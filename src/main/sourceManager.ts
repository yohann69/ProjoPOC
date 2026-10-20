import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StartSourceRequest } from '@shared/ipc'
import type { HookRequest, HookServerStatus } from '@shared/hooks'
import type { ReplayConfig, ReplayItem } from '@shared/recording'
import type { AppEvent, SourceId } from '@shared/types'
import type { IngestEvent, MidiLogEntry } from '@shared/usb'
import type { ErrorLog } from './diagnostics/errorLog'
import { HookEngine } from './hooks/hookEngine'
import { HookServer } from './hooks/hookServer'
import { Normalizer } from './normalizer'
import { Recorder } from './recording/recorder'
import { ReplaySource } from './recording/replaySource'
import { PcapCapture } from './sources/prolink/capture'
import { loadLibrary } from './sources/prolink/library'
import type { ProlinkRawEvent } from './sources/prolink/rawTypes'
import { ProlinkSource } from './sources/prolink'
import { SimulatorSource } from './sources/simulator'
import type { SimRawEvent } from './sources/simulator/rawTypes'
import { TransitionDetector } from './transition/detector'
import { MidiLogger } from './usb/midiLog'
import { MixerAccumulator } from './usb/mixerAccumulator'

export interface SourceManagerOptions {
  logDir: string
  recordDir: string
  errors?: ErrorLog
  readFile?: (path: string) => string
}

/** Owns the running source and routes every event, including renderer-side ones, to one bus. */
export class SourceManager {
  private readonly active = new Map<SourceId, { stop(): void }>()
  private readonly normalizer = new Normalizer()
  private readonly detector = new TransitionDetector()
  private readonly mixer = new MixerAccumulator()
  private readonly midiLog: MidiLogger
  private readonly hookServer: HookServer
  private hooks = new HookEngine('simulator')
  private prolink: ProlinkSource | null = null
  private recorder: Recorder | null = null
  private primary: SourceId | null = null

  constructor(
    private readonly send: (event: AppEvent) => void,
    private readonly options: SourceManagerOptions
  ) {
    this.hookServer = new HookServer((status) => send({ type: 'hookServer', status }))
    this.midiLog = new MidiLogger(options.logDir)
  }

  /** Starting a source stops the others, so simulated and real data are never mixed. */
  start(request: StartSourceRequest): void {
    this.stopAll()
    this.normalizer.reset()
    this.detector.reset()
    this.primary = request.source
    this.hooks = new HookEngine(request.source)
    if (request.source === 'replay') return this.startReplay(request.config)
    if (request.source === 'simulator') {
      const source = new SimulatorSource(request.config)
      source.on('event', (raw) => {
        this.recorder?.raw('simulator', raw)
        this.forward(this.normalizer.fromSimulator(raw))
      })
      this.active.set(source.id, source)
      source.start()
      return
    }
    const source = new ProlinkSource(request.config, {
      loadLibrary,
      createCapture: (iface) => new PcapCapture(iface),
      logDir: this.options.logDir
    })
    source.on('event', (raw) => {
      this.recorder?.raw('prolink', raw)
      this.forward(this.normalizer.fromProlink(raw))
    })
    this.prolink = source
    this.active.set(source.id, source)
    source.start()
  }

  stop(id: SourceId): void {
    this.active.get(id)?.stop()
    this.active.delete(id)
    if (id === 'prolink') this.prolink = null
  }

  stopAll(): void {
    for (const id of [...this.active.keys()]) this.stop(id)
  }

  setPacketLog(enabled: boolean): string | null {
    return this.prolink?.setPacketLog(enabled) ?? null
  }

  async setHooks(request: HookRequest): Promise<HookServerStatus> {
    if (request.enabled) return this.hookServer.start(request.port)
    await this.hookServer.stop()
    return this.hookServer.status()
  }

  async dispose(): Promise<void> {
    this.stopAll()
    this.setRecording(false)
    this.midiLog.close()
    await this.hookServer.stop()
  }

  /** Starts or stops the JSONL recording; returns the file path while recording. */
  setRecording(enabled: boolean): string | null {
    this.recorder?.close()
    this.recorder = null
    if (!enabled || this.primary === 'replay') return null
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const path = join(this.options.recordDir, `deckpulse-${stamp}.jsonl`)
    this.recorder = new Recorder(path, this.primary, (e) => {
      this.options.errors?.add('main', `recording failed: ${e.message}`)
      this.recorder = null
    })
    return path
  }

  /** Events from the renderer-side optional sources (USB-C MIDI mixer values, audio analysis). */
  ingest(events: IngestEvent[]): void {
    this.recorder?.ingest(events)
    this.applyIngest(events)
  }

  private applyIngest(events: IngestEvent[]): void {
    for (const e of events) {
      switch (e.kind) {
        case 'mixerValue':
          this.publish({ type: 'mixer', mixer: this.mixer.apply(e) })
          break
        case 'energy':
          this.publish({ type: 'energy', ts: e.ts, rms: e.rms, bands: e.bands, origin: 'DERIVED' })
          break
        case 'onset':
          this.publish({ type: 'onset', ts: e.ts, strength: e.strength, origin: 'DERIVED' })
          break
        case 'drop':
          this.publish({ type: 'drop', ts: e.ts, phase: e.phase, origin: 'DERIVED' })
          break
      }
    }
  }

  setMidiLog(enabled: boolean): string | null {
    return this.midiLog.set(enabled)
  }

  logMidi(entries: MidiLogEntry[]): void {
    this.midiLog.write(entries)
  }

  private forward(events: AppEvent[]): void {
    for (const event of events) this.publish(event)
  }

  private startReplay(config: ReplayConfig): void {
    this.setRecording(false)
    const readFile = this.options.readFile ?? ((path: string) => readFileSync(path, 'utf8'))
    const source = new ReplaySource(config, { readFile })
    source.on('event', (item) => this.replayItem(item))
    this.active.set(source.id, source)
    source.start()
  }

  /** Raw records take the same path as live data: normalizer, detector, hooks. */
  private replayItem(item: ReplayItem): void {
    try {
      switch (item.kind) {
        case 'raw':
          this.forward(
            item.source === 'prolink'
              ? this.normalizer.fromProlink(item.raw as ProlinkRawEvent)
              : this.normalizer.fromSimulator(item.raw as SimRawEvent)
          )
          break
        case 'event':
          this.publish(item.event)
          break
        case 'ingest':
          this.applyIngest(item.events)
          break
        case 'restart':
          this.normalizer.reset()
          this.detector.reset()
          break
        case 'status':
          if (item.recordedFrom !== undefined) {
            this.hooks = new HookEngine('replay', item.recordedFrom === 'simulator')
          }
          this.publish({
            type: 'sourceStatus',
            source: 'replay',
            state: item.state,
            message: item.message
          })
          break
      }
    } catch (error) {
      this.options.errors?.add('source', `replay record failed: ${String(error)}`)
    }
  }

  private publish(event: AppEvent): void {
    this.recorder?.event(event)
    if (event.type === 'sourceLog' && event.level === 'error') {
      this.options.errors?.add('source', `${event.source}: ${event.message}`)
    }
    this.send(event)
    for (const hook of this.hooks.process(event)) {
      this.send({ type: 'hook', hook })
      this.hookServer.broadcast(hook)
    }
    for (const derived of this.detector.process(event)) this.publish(derived)
  }
}

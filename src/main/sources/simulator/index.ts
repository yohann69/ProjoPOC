import { EventEmitter } from 'node:events'
import type { SimulatorConfig } from '@shared/simulator'
import type { SourceId } from '@shared/types'
import type { DataSource } from '../types'
import { SimulatorEngine } from './engine'
import type { SimRawEvent } from './rawTypes'

const PUMP_INTERVAL_MS = 5

const wallClock = (): number => performance.timeOrigin + performance.now()

export class SimulatorSource implements DataSource<SimRawEvent> {
  readonly id: SourceId = 'simulator'
  private readonly emitter = new EventEmitter()
  private engine: SimulatorEngine | null = null
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly config: SimulatorConfig,
    private readonly now: () => number = wallClock
  ) {}

  on(event: 'event', listener: (raw: SimRawEvent) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  off(event: 'event', listener: (raw: SimRawEvent) => void): this {
    this.emitter.off(event, listener)
    return this
  }

  start(): void {
    if (this.timer) return
    this.emitStatus('starting')
    this.engine = new SimulatorEngine(this.config, this.now())
    this.timer = setInterval(() => this.pump(), PUMP_INTERVAL_MS)
    this.emitStatus('running', `seed ${this.config.seed}, scenario ${this.config.scenario}`)
    this.pump()
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
    this.engine = null
    this.emitStatus('stopped')
  }

  private pump(): void {
    for (const raw of this.engine?.advance(this.now()) ?? []) this.emitter.emit('event', raw)
  }

  private emitStatus(state: 'starting' | 'running' | 'stopped', message?: string): void {
    this.emitter.emit('event', { kind: 'status', ts: this.now(), state, message })
  }
}

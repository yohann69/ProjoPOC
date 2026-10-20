import { EventEmitter } from 'node:events'

/** Minimal typed wrapper over EventEmitter: each event carries exactly one payload. */
export class TypedEmitter<Events extends object> {
  private readonly emitter = new EventEmitter()

  on<K extends keyof Events & string>(event: K, listener: (payload: Events[K]) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  off<K extends keyof Events & string>(event: K, listener: (payload: Events[K]) => void): this {
    this.emitter.off(event, listener)
    return this
  }

  emit<K extends keyof Events & string>(event: K, payload: Events[K]): void {
    this.emitter.emit(event, payload)
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }
}

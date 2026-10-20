import type { Fields } from './fields'
import type { SessionContext } from './context'

const THROTTLE_MS = 200

/** Publishes `dataSnapshot` events; unchanged values are skipped and fast streams are rate-limited per group. */
export class SnapshotPublisher {
  private readonly last = new Map<string, { at: number; json: string }>()

  constructor(
    private readonly ctx: SessionContext,
    private readonly throttleMs = THROTTLE_MS
  ) {}

  publish(group: string, title: string, fields: Fields, throttled = false): void {
    const at = this.ctx.now()
    const json = JSON.stringify(fields)
    const previous = this.last.get(group)
    if (previous?.json === json) return
    if (throttled && previous && at - previous.at < this.throttleMs) return
    this.last.set(group, { at, json })
    this.ctx.emit({
      kind: 'inspector',
      event: { type: 'dataSnapshot', source: 'prolink', group, title, fields, ts: at }
    })
  }
}

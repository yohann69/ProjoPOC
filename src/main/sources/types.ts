import type { SourceId } from '@shared/types'

/** Contract every data source implements; TRaw is the source-specific shape fed to the normalizer. */
export interface DataSource<TRaw> {
  readonly id: SourceId
  start(): void
  stop(): void
  on(event: 'event', listener: (raw: TRaw) => void): this
  off(event: 'event', listener: (raw: TRaw) => void): this
}

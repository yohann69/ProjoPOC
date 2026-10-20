import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as library from 'alphatheta-connect'
import { describe, expect, it } from 'vitest'
import { Normalizer } from '../../normalizer'
import { createContext } from './context'
import { PacketInspector } from './inspector'
import { PassiveSession } from './passiveSession'
import type { ProlinkRawEvent } from './rawTypes'
import { ReplayCapture, readRecordingFile } from './testing/replay'

/** Drop JSONL packet logs recorded from real hardware into this folder to replay them in CI. */
const RECORDINGS = join(__dirname, 'testing', 'recordings')
const files = existsSync(RECORDINGS)
  ? readdirSync(RECORDINGS).filter((f) => f.endsWith('.jsonl'))
  : []

describe.skipIf(files.length === 0)('recorded hardware sessions', () => {
  it.each(files)('replays %s without errors and produces unified events', (file) => {
    const raws: ProlinkRawEvent[] = []
    const packets = readRecordingFile(join(RECORDINGS, file))
    const ctx = createContext(
      (r) => raws.push(r),
      () => undefined,
      () => 0
    )
    const inspector = new PacketInspector(
      () => undefined,
      () => 0
    )
    const session = new PassiveSession(library, new ReplayCapture(packets), ctx, inspector)
    session.start()
    session.stop()
    const normalizer = new Normalizer()
    const events = raws.flatMap((r) => normalizer.fromProlink(r))
    expect(packets.length).toBeGreaterThan(0)
    expect(session.failure).toBeNull()
    expect(events.length).toBeGreaterThan(0)
  })
})

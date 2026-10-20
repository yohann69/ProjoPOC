import type { ReactNode } from 'react'
import type { DeckId } from '@shared/types'
import type { SnapshotView } from '../../lib/dataFold'
import { useDataStore } from '../../store/useDataStore'
import { useLiveStore } from '../../store/useLiveStore'
import { PortStatsTable } from '../inspector/PortStatsTable'
import { HexDump } from './HexDump'
import { DeckDetails } from './DeckDetails'
import { DeviceCard, GenericCard, MediaCard } from './NetworkCards'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(24rem,1fr))] items-start gap-3'
const DECK_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(34rem,1fr))] items-start gap-3'

const inGroup = (snaps: Record<string, SnapshotView>, prefix: string): SnapshotView[] =>
  Object.values(snaps)
    .filter((s) => s.group.startsWith(prefix))
    .sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true }))

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold text-slate-50">{title}</h2>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </section>
  )
}

function SourceNote() {
  const source = useLiveStore((s) => s.source)
  const state = useLiveStore((s) => s.sourceState)
  const message = useLiveStore((s) => s.sourceMessage)
  if (source === 'prolink') {
    return (
      <p className="text-sm text-slate-300">
        Ethernet source: {state}
        {message ? ` \u2014 ${message}` : ''}
      </p>
    )
  }
  return (
    <p className="rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      Nothing here until the Ethernet Pro DJ Link source runs (current source: {source ?? 'none'}).
      Choose it in the top bar and press Start.
    </p>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>
}

/** Everything the Ethernet source reads, decoded and as raw packets. */
export function EthernetData() {
  const snaps = useDataStore((s) => s.snapshots)
  const dumps = useDataStore((s) => s.dumps)
  const decks = [1, 2, 3, 4].filter((d) => snaps[`eth.deck.${d}`] || snaps[`eth.track.${d}`])
  const other = [
    ...inGroup(snaps, 'eth.status.'),
    ...inGroup(snaps, 'eth.mixer.'),
    ...inGroup(snaps, 'eth.onair.'),
    ...inGroup(snaps, 'eth.position.')
  ]
  const media = inGroup(snaps, 'eth.media.')
  const devices = inGroup(snaps, 'eth.device.')
  const packets = Object.values(dumps).sort(
    (a, b) => a.port - b.port || a.kind.localeCompare(b.kind) || (a.device ?? -1) - (b.device ?? -1)
  )
  return (
    <div className="flex flex-col gap-6">
      <SourceNote />
      <Section
        title="Decks"
        hint="Live playback, where each track comes from, its library entry and analysis."
      >
        {decks.length === 0 ? (
          <Empty text="No deck status received yet." />
        ) : (
          <div className={DECK_GRID}>
            {decks.map((d) => (
              <DeckDetails
                key={d}
                deck={d as DeckId}
                status={snaps[`eth.deck.${d}`]}
                track={snaps[`eth.track.${d}`]}
              />
            ))}
          </div>
        )}
      </Section>
      <Section title="Devices on the network">
        {devices.length === 0 ? (
          <Empty text="No device announced itself yet." />
        ) : (
          <div className={GRID}>
            {devices.map((s) => (
              <DeviceCard key={s.group} snap={s} />
            ))}
          </div>
        )}
      </Section>
      <Section title="Media" hint="USB sticks and SD cards the players report.">
        {media.length === 0 ? (
          <Empty text="No media information received." />
        ) : (
          <div className={GRID}>
            {media.map((s) => (
              <MediaCard key={s.group} snap={s} />
            ))}
          </div>
        )}
      </Section>
      {other.length > 0 && (
        <Section
          title="Mixer, on-air, position and other senders"
          hint="Position packets are decoded as CDJ-3000 ones; other models may send values that do not mean that."
        >
          <div className={GRID}>
            {other.map((s) => (
              <GenericCard key={s.group} snap={s} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Packets per port">
        <PortStatsTable />
      </Section>
      <details className="rounded-lg border border-slate-800 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">
          Advanced: raw packets ({packets.length})
        </summary>
        <div className={`${GRID} mt-3`}>
          {packets.map((p) => (
            <HexDump key={p.key} dump={p} />
          ))}
        </div>
      </details>
    </div>
  )
}

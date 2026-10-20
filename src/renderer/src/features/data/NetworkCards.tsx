import { epochNow } from '../../lib/frameLoop'
import type { SnapshotView } from '../../lib/dataFold'
import { useTicker } from '../../ui/primitives'
import { InfoCard, InfoGroup } from './InfoGrid'
import { DEVICE_SPECS, MEDIA_SPECS, otherRows, rowsFor, type Spec } from './formatters'

function SnapshotInfo({ snap, specs }: { snap: SnapshotView; specs: Spec[] }) {
  useTicker(500)
  const now = epochNow()
  const used = new Set<string>()
  const main = rowsFor(snap.fields, specs, used)
  const rest = otherRows(snap.fields, used)
  return (
    <InfoCard title={snap.title} updatedAt={snap.updatedAt} now={now}>
      <InfoGroup title="" rows={main} changedAt={snap.changedAt} now={now} />
      <InfoGroup
        title={main.length > 0 ? 'More' : ''}
        rows={rest}
        changedAt={snap.changedAt}
        now={now}
      />
    </InfoCard>
  )
}

export const DeviceCard = ({ snap }: { snap: SnapshotView }) => (
  <SnapshotInfo snap={snap} specs={DEVICE_SPECS} />
)

export const MediaCard = ({ snap }: { snap: SnapshotView }) => (
  <SnapshotInfo snap={snap} specs={MEDIA_SPECS} />
)

/** Mixer, on-air, position and unmapped-sender snapshots: every field with a readable label. */
export const GenericCard = ({ snap }: { snap: SnapshotView }) => (
  <SnapshotInfo snap={snap} specs={[]} />
)

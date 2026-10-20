import type { AppEventType } from '@shared/types'
import { useEventStore } from '../../store/useEventStore'

const TYPES: AppEventType[] = [
  'deckState',
  'track',
  'mixer',
  'beat',
  'transition',
  'energy',
  'onset',
  'drop',
  'deviceList',
  'sourceStatus',
  'rawPacket',
  'packetStats',
  'dataSnapshot',
  'packetDump',
  'trackStatus',
  'sourceLog',
  'hook',
  'hookServer'
]

export function TypeFilter() {
  const hiddenTypes = useEventStore((s) => s.hiddenTypes)
  const toggleType = useEventStore((s) => s.toggleType)
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Show event types">
      {TYPES.map((type) => {
        const visible = !hiddenTypes.includes(type)
        return (
          <button
            key={type}
            type="button"
            aria-pressed={visible}
            onClick={() => toggleType(type)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${
              visible
                ? 'border-slate-300 bg-slate-700 text-white'
                : 'border-slate-700 text-slate-300'
            }`}
          >
            {type}
          </button>
        )
      })}
    </div>
  )
}

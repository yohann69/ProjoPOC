import { useViewStore, type DataTab } from '../../store/useViewStore'
import { ErrorBoundary } from '../../ui/ErrorBoundary'
import { EthernetData } from './EthernetData'
import { UsbData } from './UsbData'

const TABS: { id: DataTab; label: string }[] = [
  { id: 'ethernet', label: 'Ethernet (Pro DJ Link)' },
  { id: 'usb', label: 'USB-C (MIDI)' }
]

/** Full-width view of every value the app can read, undecorated. */
export function DataView() {
  const tab = useViewStore((s) => s.dataTab)
  const setTab = useViewStore((s) => s.setDataTab)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div role="tablist" aria-label="Data source" className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${
              t.id === tab ? 'bg-slate-600 text-white' : 'text-slate-200 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto pr-2">
        <ErrorBoundary key={tab} label="The data view">
          {tab === 'ethernet' ? <EthernetData /> : <UsbData />}
        </ErrorBoundary>
      </div>
    </div>
  )
}

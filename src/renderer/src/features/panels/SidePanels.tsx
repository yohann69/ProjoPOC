import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { ErrorBoundary } from '../../ui/ErrorBoundary'
import { AudioPanel } from '../audio/AudioPanel'
import { DeviceList } from '../devices/DeviceList'
import { DiagnosticsPanel } from '../diagnostics/DiagnosticsPanel'
import { EventLog } from '../event-log/EventLog'
import { InspectorPanel } from '../inspector/InspectorPanel'
import { MidiExplorer } from '../midi/MidiExplorer'
import { XzMixerPanel } from '../midi/xz/XzMixerPanel'
import { BpmHistoryChart } from '../panels/BpmHistoryChart'
import { HooksPanel } from '../panels/HooksPanel'
import { MixerPanel } from '../panels/MixerPanel'
import { PhrasePanel } from '../panels/PhrasePanel'
import { RateSparklines } from '../panels/RateSparklines'
import { TransitionList } from '../panels/TransitionList'
import { TransitionTimeline } from '../panels/TransitionTimeline'
import { DeckTracks } from '../tracks/DeckTracks'

const TABS: { id: string; label: string; content: () => ReactNode }[] = [
  {
    id: 'overview',
    label: 'Overview',
    content: () => (
      <div className="flex flex-col gap-3">
        <BpmHistoryChart />
        <TransitionTimeline />
        <TransitionList />
        <PhrasePanel />
      </div>
    )
  },
  {
    id: 'usbc',
    label: 'USB-C',
    content: () => (
      <div className="flex flex-col gap-3">
        <XzMixerPanel />
        <details className="rounded-lg border border-slate-800">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-100">
            MIDI explorer: raw messages, labels, manual mappings
          </summary>
          <div className="p-2">
            <MidiExplorer />
          </div>
        </details>
        <MixerPanel />
      </div>
    )
  },
  { id: 'audio', label: 'Audio', content: () => <AudioPanel /> },
  { id: 'events', label: 'Events', content: () => <EventLog /> },
  { id: 'hooks', label: 'Hooks', content: () => <HooksPanel /> },
  {
    id: 'packets',
    label: 'Packets',
    content: () => (
      <div className="flex flex-col gap-3">
        <RateSparklines />
        <InspectorPanel />
      </div>
    )
  },
  {
    id: 'devices',
    label: 'Devices',
    content: () => (
      <div className="flex flex-col gap-3">
        <DeviceList />
        <DeckTracks />
      </div>
    )
  },
  { id: 'diagnostics', label: 'Diagnostics', content: () => <DiagnosticsPanel /> }
]

/** Tabbed global panels; arrow keys, Home and End move between tabs. */
export function SidePanels() {
  const active = useSettingsStore((s) => s.ui.sideTab)
  const updateUi = useSettingsStore((s) => s.updateUi)
  const setActive = (sideTab: string): void => updateUi({ sideTab })
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (event: KeyboardEvent): void => {
    const index = TABS.findIndex((t) => t.id === active)
    const target =
      event.key === 'ArrowRight'
        ? index + 1
        : event.key === 'ArrowLeft'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : null
    if (target === null) return
    event.preventDefault()
    const next = TABS[(target + TABS.length) % TABS.length]!
    setActive(next.id)
    refs.current[next.id]?.focus()
  }
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]!
  return (
    <aside className="flex min-h-0 w-[30rem] shrink-0 flex-col gap-3" aria-label="Global panels">
      <div role="tablist" aria-label="Panels" onKeyDown={onKey} className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(node) => {
              refs.current[t.id] = node
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === active}
            aria-controls="panel-body"
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActive(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${
              t.id === active ? 'bg-slate-600 text-white' : 'text-slate-200 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id="panel-body"
        role="tabpanel"
        aria-labelledby={`tab-${tab.id}`}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1"
      >
        <ErrorBoundary key={tab.id} label={`The ${tab.label} panel`}>
          {tab.content()}
        </ErrorBoundary>
      </div>
    </aside>
  )
}

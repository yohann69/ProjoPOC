import { useEffect } from 'react'
import { DeckGrid } from './features/deck/DeckGrid'
import { useEventBridge } from './features/event-bridge/useEventBridge'
import { useOptionalBootstrap } from './features/optional/useOptionalBootstrap'
import { useBpmSampler } from './features/panels/useBpmSampler'
import { SidePanels } from './features/panels/SidePanels'
import { FirstRunChecklist } from './features/diagnostics/FirstRunChecklist'
import { ReplayBanner } from './features/topbar/ReplayBanner'
import { SimulatedBanner } from './features/topbar/SimulatedBanner'
import { TopBar } from './features/topbar/TopBar'
import { useSettingsStore } from './store/useSettingsStore'
import { useViewStore } from './store/useViewStore'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DataView } from './features/data/DataView'

export function App() {
  useEventBridge()
  useBpmSampler()
  useOptionalBootstrap()
  const load = useSettingsStore((s) => s.load)
  const dataOpen = useViewStore((s) => s.dataOpen)
  useEffect(() => void load(), [load])
  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <SimulatedBanner />
      <ReplayBanner />
      <ErrorBoundary label="The top bar">
        <TopBar />
      </ErrorBoundary>
      <ErrorBoundary label="The first-run checklist">
        <FirstRunChecklist />
      </ErrorBoundary>
      {dataOpen ? (
        <ErrorBoundary label="The data view">
          <DataView />
        </ErrorBoundary>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 p-4">
          <ErrorBoundary label="The deck view">
            <DeckGrid />
          </ErrorBoundary>
          <SidePanels />
        </div>
      )}
    </main>
  )
}

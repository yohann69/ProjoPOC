import { DECK_IDS } from '@shared/types'
import { useShallow } from 'zustand/react/shallow'
import { isDeckActive, useDeckStore } from '../../store/useDeckStore'
import { useLiveStore } from '../../store/useLiveStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { ErrorBoundary } from '../../ui/ErrorBoundary'
import { DemoButton } from '../topbar/DemoButton'
import { DeckCard } from './DeckCard'

function EmptyState() {
  const state = useLiveStore((s) => s.sourceState)
  const source = useLiveStore((s) => s.source)
  const message = useLiveStore((s) => s.sourceMessage)
  const devices = useLiveStore((s) => s.devices.length)
  const running = state !== 'stopped'
  const connectedNoDeck = source === 'prolink' && running && devices > 0
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-700 p-8 text-center">
      <p className="text-2xl font-semibold text-slate-50">
        {running ? 'Waiting for a deck to load a track…' : 'No source running'}
      </p>
      <p className="max-w-md text-slate-300">
        {running
          ? 'Only decks that have a track or are playing are shown. Use "Show all decks" to see empty ones.'
          : 'Start the simulator to review the dashboard without hardware, or connect to the XDJ-AZ.'}
      </p>
      {connectedNoDeck && message && (
        <p className="max-w-md rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {devices} device(s) found. {message}
        </p>
      )}
      {!running && <DemoButton />}
    </div>
  )
}

export function DeckGrid() {
  const showAll = useSettingsStore((s) => s.dashboard.showAllDecks)
  const update = useSettingsStore((s) => s.updateDashboard)
  const visible = useDeckStore(
    useShallow((s) => DECK_IDS.filter((d) => showAll || isDeckActive(s.decks[d])))
  )
  return (
    <section
      aria-label="Decks"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-50">Decks</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => update({ showAllDecks: e.target.checked })}
            className="size-4 accent-sky-400"
          />
          Show all decks
        </label>
      </div>
      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(27rem,1fr))] gap-4">
          {visible.map((deck) => (
            <ErrorBoundary key={deck} label={`Deck ${deck}`}>
              <DeckCard deck={deck} />
            </ErrorBoundary>
          ))}
        </div>
      )}
    </section>
  )
}

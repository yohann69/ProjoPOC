import {
  TRANSITION_SIGNAL_SOURCES,
  TRANSITION_SIGNAL_NAMES,
  type TransitionSignal,
  type TransitionSignalName
} from '@shared/transition'
import { transitions } from '../../live/timeline'
import { OriginBadge } from '../../ui/OriginBadge'
import { Panel, useTicker } from '../../ui/primitives'
import { useSignalAvailability } from './signalAvailability'

const LABELS: Record<TransitionSignalName, string> = {
  masterChange: 'master flag',
  overlap: 'overlap',
  onAir: 'on air',
  bpmSync: 'BPM sync',
  fader: 'fader / crossfader',
  audio: 'audio drop'
}

function Chip({ signal }: { signal: TransitionSignal }) {
  const label = LABELS[signal.name]
  if (!signal.available) {
    return (
      <span
        title={`Missing: ${TRANSITION_SIGNAL_SOURCES[signal.name]}`}
        className="rounded border border-dashed border-slate-600 px-1.5 py-0.5 text-[11px] italic text-slate-400"
      >
        {label}: N/A
      </span>
    )
  }
  return signal.contributed ? (
    <span
      title={signal.detail}
      className="rounded border border-emerald-500 bg-emerald-950 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-200"
    >
      {'\u2713'} {label} +{Math.round(signal.weight * 100)}
    </span>
  ) : (
    <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[11px] text-slate-300">
      {'\u00b7'} {label} not seen
    </span>
  )
}

function Availability() {
  const available = useSignalAvailability()
  const missing = TRANSITION_SIGNAL_NAMES.filter((n) => !available[n])
  const used = TRANSITION_SIGNAL_NAMES.filter((n) => available[n])
  return (
    <p className="text-xs text-slate-300">
      Signals in use: {used.length > 0 ? used.map((n) => LABELS[n]).join(', ') : 'none'}.
      {missing.length > 0 && (
        <span className="text-slate-400">
          {' '}
          Missing: {missing.map((n) => `${LABELS[n]} (${TRANSITION_SIGNAL_SOURCES[n]})`).join('; ')}
          .
        </span>
      )}
    </p>
  )
}

/** Detected transitions with the signals behind each confidence score. */
export function TransitionList() {
  useTicker(500)
  const recent = transitions.slice(-6).reverse()
  return (
    <Panel title="Detected transitions" badges={<OriginBadge origin="DERIVED" />}>
      <Availability />
      {recent.length === 0 ? (
        <p className="text-sm text-slate-400">No transition detected yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {recent.map((t) => (
            <li key={`${t.ts}-${t.fromDeck}-${t.toDeck}`} className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-slate-100">
                Deck {t.fromDeck} {'\u2192'} deck {t.toDeck}{' '}
                <span className="tabular-nums text-violet-200">
                  {Math.round(t.confidence * 100)}%
                </span>
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {new Date(t.ts).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.signals.map((s) => (
                  <Chip key={s.name} signal={s} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

import { DECK_IDS, type MixerState, type Tagged } from '@shared/types'
import { DECK_COLORS } from '../../lib/deckColors'
import { mixerLive } from '../../live/mixerLive'
import { useLiveStore } from '../../store/useLiveStore'
import { useMappingStore } from '../../store/useMappingStore'
import { useMidiStore } from '../../store/useMidiStore'
import { OriginBadge } from '../../ui/OriginBadge'
import { NotAvailable, Panel, useTicker } from '../../ui/primitives'
import { usbcMixerMissing } from './mixerReason'

function Level({ label, value }: { label: string; value?: Tagged<number> }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 shrink-0 text-slate-300">{label}</span>
      {value ? (
        <>
          <div
            className="h-2 flex-1 overflow-hidden rounded bg-slate-800"
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={Number(value.value.toFixed(2))}
          >
            <div className="h-full bg-slate-200" style={{ width: `${value.value * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums text-slate-300">
            {value.value.toFixed(2)}
          </span>
        </>
      ) : (
        <NotAvailable text="not mapped" />
      )}
    </div>
  )
}

function MixerValues({ mixer }: { mixer: MixerState }) {
  return (
    <div className="flex flex-col gap-2">
      <Level label="Xfade" value={mixer.crossfader} />
      <div className="grid grid-cols-2 gap-2">
        {DECK_IDS.map((deck) => {
          const ch = mixer.channels[deck]
          if (!ch) return null
          return (
            <div key={deck} className="flex flex-col gap-1 rounded border border-slate-800 p-2">
              <span className="text-xs font-semibold" style={{ color: DECK_COLORS[deck] }}>
                Channel {deck}
              </span>
              <Level label="Fader" value={ch.fader} />
              <Level label="Trim" value={ch.trim} />
              <Level label="High" value={ch.eqHigh} />
              <Level label="Mid" value={ch.eqMid} />
              <Level label="Low" value={ch.eqLow} />
              <Level label="Color" value={ch.color} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UsbcMixer() {
  const status = useMidiStore((s) => s.status)
  const selected = useMidiStore((s) => s.listening[0] ?? s.selected)
  const connected = useMidiStore((s) => s.listening.length > 0)
  const messages = useMidiStore((s) => s.total)
  const mappedTargets = useMappingStore(
    (s) => Object.values(s.entries).filter((e) => e.target).length
  )
  const mixer = mixerLive.usbc
  return (
    <section className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        USB-C mixer values <OriginBadge origin="USBC" ts={mixer?.crossfader?.ts} />
      </h4>
      {mixer ? (
        <MixerValues mixer={mixer} />
      ) : (
        <NotAvailable
          text={`N/A: ${usbcMixerMissing({ status, selected, connected, mappedTargets, messages })}.`}
        />
      )}
    </section>
  )
}

function PrimaryMixer() {
  const source = useLiveStore((s) => s.source)
  const mixer = mixerLive.primary
  if (source === null) return null
  return (
    <section className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        {source === 'simulator' ? 'Simulated mixer' : 'Pro DJ Link mixer'}
      </h4>
      {mixer ? (
        <MixerValues mixer={mixer} />
      ) : (
        <NotAvailable text="N/A: the Ethernet source carries no mixer values." />
      )}
    </section>
  )
}

/** Mixer values from each source kept apart: USB-C MIDI mappings and the running primary source. */
export function MixerPanel() {
  useTicker(100)
  return (
    <Panel title="Mixer">
      <UsbcMixer />
      <PrimaryMixer />
    </Panel>
  )
}

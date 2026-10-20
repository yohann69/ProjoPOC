import { DECK_IDS, type DeckId } from '@shared/types'
import { DECK_COLORS } from '../../../lib/deckColors'
import { XZ_CONTROLS, type XzControl } from '../../../lib/xzMap'
import { XzButton, XzGauge } from './XzGauge'

const forDeck = (deck: DeckId): XzControl[] => XZ_CONTROLS.filter((c) => c.deck === deck)
const global = (section: XzControl['section']): XzControl[] =>
  XZ_CONTROLS.filter((c) => !c.deck && c.section === section)

function ChannelStrip({ deck }: { deck: DeckId }) {
  const color = DECK_COLORS[deck]
  const controls = forDeck(deck)
  const knobs = controls.filter((c) => c.kind === 'knob')
  const fader = controls.find((c) => c.kind === 'fader')
  const buttons = controls.filter((c) => c.kind === 'button' || c.kind === 'switch')
  return (
    <section
      aria-label={`Channel ${deck}`}
      className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2"
    >
      <h4 className="text-xs font-bold" style={{ color }}>
        CH {deck}
      </h4>
      <div className="flex justify-between gap-1">
        <div className="flex flex-col gap-1.5">
          {knobs.map((k) => (
            <XzGauge key={k.cc} control={k} color={color} />
          ))}
        </div>
        {fader && <XzGauge control={fader} color={color} />}
      </div>
      <div className="flex flex-wrap gap-1">
        {buttons.map((b) => (
          <XzButton key={b.cc} control={b} color={color} />
        ))}
      </div>
    </section>
  )
}

function Group({ title, section }: { title: string; section: XzControl['section'] }) {
  const controls = global(section)
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <div className="flex flex-wrap items-start gap-3">
        {controls
          .filter((c) => c.kind === 'knob')
          .map((c) => (
            <XzGauge key={c.cc} control={c} color="#e2e8f0" />
          ))}
        {controls
          .filter((c) => c.kind === 'button')
          .map((c) => (
            <XzButton key={c.cc} control={c} color="#e2e8f0" />
          ))}
      </div>
    </section>
  )
}

/** Channel strips, crossfader and master section of the XDJ-XZ, filled from live MIDI values. */
export function XzMixer() {
  const crossfader = XZ_CONTROLS.find((c) => c.id === 'crossfader')
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2">
        {DECK_IDS.map((deck) => (
          <ChannelStrip key={deck} deck={deck} />
        ))}
      </div>
      {crossfader && <XzGauge control={crossfader} color="#e2e8f0" />}
      <div className="grid grid-cols-2 gap-3">
        <Group title="Master" section="master" />
        <div className="flex flex-col gap-3">
          <Group title="Headphones" section="headphones" />
          <Group title="Beat FX" section="fx" />
        </div>
      </div>
    </div>
  )
}

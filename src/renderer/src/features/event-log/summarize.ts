import type { AppEvent, Origin, Tagged } from '@shared/types'

export interface EventSummary {
  detail: string
  origins: Origin[]
}

const originsOf = (...tagged: (Tagged<unknown> | null | undefined)[]): Origin[] => [
  ...new Set(tagged.flatMap((t) => (t ? [t.origin] : [])))
]

const signed = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`

export function summarize(event: AppEvent): EventSummary {
  switch (event.type) {
    case 'deckState': {
      const s = event.state
      const flags = [
        s.isMaster?.value && 'MASTER',
        s.isSynced?.value && 'SYNC',
        s.isOnAir?.value && 'ON-AIR'
      ]
      const parts = [
        `D${s.deck} ${s.playState.value}`,
        s.bpm && `${s.bpm.value.toFixed(2)} bpm`,
        s.pitchPercent && `${signed(s.pitchPercent.value)}%`,
        s.beatInBar && `bar ${s.beatInBar.value}`,
        s.beatPhase && `phase ${s.beatPhase.value.toFixed(2)}`,
        ...flags
      ]
      return {
        detail: parts.filter(Boolean).join(' · '),
        origins: originsOf(s.playState, s.bpm, s.beatPhase)
      }
    }
    case 'track': {
      const t = event.track?.value
      return {
        detail: t
          ? `D${event.deck} ${t.title} — ${t.artist} · ${t.key} · ${t.bpmGrid.bpm} bpm · ${t.phrases.length} phrases`
          : `D${event.deck} unloaded`,
        origins: originsOf(event.track)
      }
    }
    case 'mixer': {
      const levels = Object.entries(event.mixer.channels).map(
        ([deck, c]) => `ch${deck} ${c.fader?.value.toFixed(2) ?? 'n/a'}`
      )
      return {
        detail: [`xfade ${event.mixer.crossfader?.value.toFixed(2) ?? 'n/a'}`, ...levels].join(
          ' · '
        ),
        origins: originsOf(event.mixer.crossfader)
      }
    }
    case 'energy': {
      const b = event.bands
      return {
        detail: `rms ${event.rms.toFixed(3)} · low ${b.low.toFixed(2)} mid ${b.mid.toFixed(2)} high ${b.high.toFixed(2)}`,
        origins: [event.origin]
      }
    }
    case 'onset':
      return { detail: `onset strength ${event.strength.toFixed(2)}`, origins: [event.origin] }
    case 'drop':
      return { detail: `audio ${event.phase}`, origins: [event.origin] }
    case 'beat':
      return { detail: `D${event.deck} beat ${event.beatInBar}`, origins: [event.origin] }
    case 'transition': {
      const seen = event.signals?.filter((s) => s.contributed).map((s) => s.name) ?? []
      return {
        detail: `D${event.fromDeck} → D${event.toDeck} · confidence ${event.confidence.toFixed(2)}${seen.length ? ` · ${seen.join(', ')}` : ''}`,
        origins: [event.origin]
      }
    }
    case 'deviceList':
      return { detail: event.devices.map((d) => d.name).join(', '), origins: [] }
    case 'sourceStatus':
      return { detail: `${event.source} ${event.state} ${event.message ?? ''}`.trim(), origins: [] }
    case 'rawPacket':
      return {
        detail: `${event.source}:${event.port} ${event.length} B ${event.kind ?? ''} ${event.hexPreview}`,
        origins: []
      }
    case 'packetStats':
      return {
        detail:
          event.ports.map((p) => `${p.port}: ${p.packetsPerSecond}/s`).join(' · ') || 'no packets',
        origins: []
      }
    case 'dataSnapshot':
      return {
        detail: `${event.group}: ${Object.keys(event.fields).length} fields`,
        origins: []
      }
    case 'packetDump':
      return {
        detail: `${event.srcAddr}:${event.port} ${event.kind} ${event.length} B (#${event.count})`,
        origins: []
      }
    case 'trackStatus':
      return {
        detail: `D${event.deck} ${event.state}${event.message ? ` — ${event.message}` : ''}`,
        origins: []
      }
    case 'sourceLog':
      return { detail: `${event.level}: ${event.message}`, origins: [] }
    case 'hook': {
      const h = event.hook
      const deck = 'deck' in h ? ` D${h.deck}` : ''
      return { detail: `${h.type}${deck}${h.simulated ? ' (simulated)' : ''}`, origins: [h.origin] }
    }
    case 'hookServer': {
      const s = event.status
      return {
        detail: s.listening
          ? `listening on ${s.port}, ${s.clients} client(s)`
          : (s.error ?? 'stopped'),
        origins: []
      }
    }
  }
}

import type { HookRequest, HookServerStatus } from './hooks'
import type { DiagnosticsInfo, RendererErrorReport } from './diagnostics'
import type { AppSettings, ConnectionTestResult, InterfaceInfo, ProlinkConfig } from './prolink'
import type { ReplayConfig } from './recording'
import type { SimulatorConfig } from './simulator'
import type { AppEvent, SourceId } from './types'
import type { IngestEvent, MicAccessResult, MidiLogEntry, MidiMapping } from './usb'

export const IPC = {
  event: 'deckpulse:event',
  startSource: 'deckpulse:source:start',
  stopSource: 'deckpulse:source:stop',
  listInterfaces: 'deckpulse:net:interfaces',
  testConnection: 'deckpulse:net:test',
  getSettings: 'deckpulse:settings:get',
  saveSettings: 'deckpulse:settings:save',
  setPacketLog: 'deckpulse:inspector:log',
  setHooks: 'deckpulse:hooks:set',
  ingest: 'deckpulse:optional:ingest',
  getMidiMapping: 'deckpulse:midi:mapping:get',
  saveMidiMapping: 'deckpulse:midi:mapping:save',
  setMidiLog: 'deckpulse:midi:log:set',
  logMidi: 'deckpulse:midi:log',
  requestMicAccess: 'deckpulse:audio:access',
  getDiagnostics: 'deckpulse:diagnostics:get',
  logRenderer: 'deckpulse:log:renderer',
  setRecording: 'deckpulse:recording:set',
  chooseRecording: 'deckpulse:recording:choose'
} as const

/** The usbc and audio sources run in the renderer and enter through `ingest`. */
export type StartSourceRequest =
  | { source: 'simulator'; config: SimulatorConfig }
  | { source: 'prolink'; config: ProlinkConfig }
  | { source: 'replay'; config: ReplayConfig }

/** Surface exposed to the renderer as `window.deckpulse`. */
export interface DeckPulseApi {
  /** Returns an unsubscribe function. */
  onEvent(listener: (event: AppEvent) => void): () => void
  startSource(request: StartSourceRequest): Promise<void>
  stopSource(source: SourceId): Promise<void>
  listInterfaces(): Promise<InterfaceInfo[]>
  /** Listens briefly on the interface with pcap and reports the devices heard. */
  testConnection(iface: string): Promise<ConnectionTestResult>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>
  /** Toggles the JSONL packet log while prolink runs; resolves with the file path when enabled. */
  setPacketLog(enabled: boolean): Promise<string | null>
  /** Starts or stops the local WebSocket that broadcasts visual-hook events as JSON. */
  setHookBroadcast(request: HookRequest): Promise<HookServerStatus>
  /** Publishes events produced in the renderer (MIDI values, audio analysis) on the main event bus. */
  ingest(events: IngestEvent[]): void
  getMidiMapping(): Promise<MidiMapping>
  saveMidiMapping(mapping: MidiMapping): Promise<void>
  /** Toggles the JSONL log of raw MIDI bytes; resolves with the file path when enabled. */
  setMidiLog(enabled: boolean): Promise<string | null>
  logMidi(entries: MidiLogEntry[]): void
  /** Asks the operating system for microphone/audio-input access (macOS prompt). */
  requestMicAccess(): Promise<MicAccessResult>
  getDiagnostics(): Promise<DiagnosticsInfo>
  /** Sends a renderer error to the main-process log and the diagnostics list. */
  logRenderer(report: RendererErrorReport): void
  /** Starts or stops the JSONL recording of raw and normalized events; resolves with the file path. */
  setRecording(enabled: boolean): Promise<string | null>
  /** Opens a file dialog for a recording; null when cancelled. */
  chooseRecording(): Promise<string | null>
}

# DeckPulse

Desktop app that shows live data from a Pioneer/AlphaTheta XDJ-AZ: a simulator, the `prolink` source (Pro DJ Link
over Ethernet), a live dashboard, optional USB-C MIDI and audio analysis, recording and replay, diagnostics and
packaging.

Stack: Electron + electron-vite + React + TypeScript (strict) + Zustand + Tailwind CSS.

## Scripts

| Command                           | What it does                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | Starts the app with hot reload                               |
| `npm run build`                   | Type-checks, then bundles main, preload and renderer         |
| `npm run typecheck`               | `tsc` for the node side and the renderer side                |
| `npm run lint`                    | ESLint                                                       |
| `npm run format` / `format:check` | Prettier                                                     |
| `npm test`                        | Vitest (normalizer, simulator, prolink pipeline)             |
| `npm run rebuild`                 | Rebuilds the native modules (`cap`, SQLite) for Electron     |
| `npm run pack`                    | Unpacked app in `release/` (no installer), for a quick check |
| `npm run dist:mac` / `dist:win`   | Installers for macOS (dmg, zip) / Windows (NSIS)             |

npm 11 skips install scripts unless a package is approved. `package.json` lists `allowScripts` for
`electron`, `cap` and `better-sqlite3-multiple-ciphers`; `postinstall` runs `npm run rebuild`
(`@electron/rebuild`). The rebuilt modules target Electron's Node ABI, so run them through Electron, not plain Node.

## Architecture

```
src/
  shared/      types used by both processes (unified model, capabilities, IPC contract)
  main/        all hardware/network code lives here
    sources/     one module per data source (simulator.ts folder, prolink.ts + prolink/; USB-C MIDI and audio run in the renderer)
    normalizer.ts   source-specific events -> unified AppEvent
    sourceManager.ts   owns the running source (switchable at runtime), forwards normalized events
    ipc.ts / validate.ts   validated IPC handlers
    networkInterfaces.ts / settingsStore.ts   interface list + connection test, remembered settings
  preload/     typed contextBridge: window.deckpulse
  renderer/    React dashboard (feature folders, Tailwind): decks, global panels, packet inspector
```

```
source (raw, source-specific) -> normalizer -> AppEvent -> IPC -> preload bridge -> Zustand store -> UI
```

- Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer only sees
  `window.deckpulse` (`onEvent`, `startSource`, `stopSource`); IPC payloads from the renderer are validated
  in the main process. Production builds get a strict CSP meta tag.
- Every source implements `DataSource<TRaw>`: `start()`, `stop()`, `on('event', cb)`.
- The normalizer is stateful: it derives beat phase (from the last beat). Transitions come from the
  `TransitionDetector` in `main/transition/`, which sees every published event (step 4).
- `shared/capabilities.ts` maps each source to the fields it can provide, so the UI can show "not available
  from this hardware" via `originFor(sources, field)` instead of an empty value.

## The Origin concept

Every value is a `Tagged<T> = { value, origin, ts }`, so the UI always knows where it came from:

| Origin        | Meaning                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| `ETH_LIVE`    | Real-time Pro DJ Link packets over Ethernet (beat, BPM, play state, loaded track id...)    |
| `ETH_LIBRARY` | Metadata read over the network from the rekordbox-exported USB stick (title, key, cues...) |
| `USBC`        | Computer-control USB-C port (MIDI), step 4, only what you map. Never used for library data |
| `DERIVED`     | Computed by the app (beat phase, transition detection, energy)                             |

The simulator imitates the real sources, so it tags values with the origin the real source would use
(deck fields `ETH_LIVE`, track metadata `ETH_LIBRARY`, mixer `USBC`). Which source is active is reported by
`sourceStatus` events.

Note: the `prolink` and `usbc` entries in the capability map follow the product brief and are unverified
assumptions until steps 2 and 4.

## Simulator

Pick a scenario (single deck, mixing 2 decks, 4-deck chaos) and a seed in the UI, then Start.

- Deterministic for a given seed. `SimulatorEngine.advance(now)` is driven by an injected clock, so tests
  step time manually.
- Beat events carry their exact scheduled time (interpolated inside each 10 ms step), not the timer's fire
  time. Deck state is emitted at 10 Hz, mixer at 4 Hz.
- Tracks are 4/4 at 120-150 BPM with hot cues, a loop, phrases (intro/verse/chorus/drop/outro) and a
  waveform preview.
- Pitch drifts slowly; synced decks follow the master's BPM. Transitions start on the master's downbeat,
  move the master flag at the midpoint and fade the old deck out (bass swap on the EQ).

## Debug view

Lists incoming events with their origins. `deckState`, `mixer`, `rawPacket` and `packetStats` are hidden by
default (high rate); toggle them with the chips. Toggling only affects events received afterwards. The source
tabs switch between the simulator and the XDJ-AZ at runtime; starting one stops the other. `dataSnapshot` and
`packetDump` (below) are hidden by default too.

## All data view

The **All data** button in the top bar replaces the dashboard with every value the app can read, laid out as
readable cards.

- **Ethernet**: one card per deck with the artwork, title and artist, the on-air/master/sync flags, playback (state,
  BPM, pitch, pitch fader, position, beat counter), where the track plays from, the full library entry (artist, album,
  genre, key, label, year, rating, play count, bitrate, sample rate, file path, dates...) and the analysis summary
  (beats, cues, waveforms, which files could not be read). Fields the app has no label for still appear under
  "Other". Below: devices (name, IP, MAC, deck), media (USB name, track and playlist counts, free space), and mixer,
  on-air or absolute-position packets when the hardware sends them. Values that just changed are highlighted. A
  collapsed "Advanced" section holds the newest raw packet of each kind as a hex dump (grey: constant, blue: has
  changed, amber: just changed; click a byte to read it as a number).
- **USB-C**: the XDJ-XZ mixer view, then every connected MIDI input (not only the XDJ-XZ ports) with message counts
  and rate, and one row per port and control with value, range and count (named for the XDJ-XZ mixer controls and
  any control you labelled in the explorer). SysEx and the raw stream are in a collapsed "Advanced" section.

Both are carried as `dataSnapshot` and `packetDump` events from the prolink source; they are recorded and replayed
with the rest. The simulator produces none.

## Prolink source (step 2)

Uses [`alphatheta-connect`](https://github.com/chrisle/alphatheta-connect) 0.28.5. The summary of what was
read in its README, docs and typings is at the top of `src/main/sources/prolink.ts`.

**Modes** (setting `auto` / `passive` / `active`, default `auto`, remembered between runs):

- `active`: joins as a virtual CDJ (`bringOnline`, device number 7). **This is the mode that works with the XDJ-XZ:**
  the unit sends deck status (UDP 50002) only to devices that joined the network. Fails while rekordbox (or a second
  instance) holds UDP 50000-50002; this is detected up front and shown as `rekordbox conflict`. It needs no pcap
  access (the packet inspector uses pcap when it is allowed).
- `passive`: captures packets with pcap and sends nothing. On an XDJ-XZ it hears the device announcements (UDP 50000)
  and beat packets (UDP 50001) but never a status packet, so no deck appears. After 8 s without status the source
  switches itself to active mode once (logged as a warning); if rekordbox holds the ports it stays passive and the
  source message suggests quitting rekordbox.
- `auto`: active, falling back to passive when rekordbox holds the ports.

**OS requirements for passive mode**

| OS      | Needed                                                                                      |
| ------- | ------------------------------------------------------------------------------------------- |
| Windows | Npcap installed                                                                             |
| macOS   | Read access to `/dev/bpf*` (e.g. Wireshark's ChmodBPF helper) or run the app with `sudo`    |
| Linux   | libpcap, and `sudo setcap cap_net_raw,cap_net_admin=eip <electron binary>` (or run as root) |

Without them the status shows `permission denied` with these instructions.

**Library problems found and worked around**

- `alphatheta-connect` declares `metadata-connect` and `onelibrary-connect` as `file:../` dependencies that do
  not exist when installed from npm, so both are installed explicitly.
- Its `PcapAdapter.start()` always throws (the bundle fails to resolve `cap`). Passive mode therefore uses
  our own capture (`prolink/capture.ts`) and feeds the library's passive services (device manager, status
  emitter, local rekordbox database over NFS) through a stand-in adapter.
- `cap` 0.2.1 crashes the process when an instance whose `open()` failed is garbage collected. Failed
  instances are kept alive on purpose.
- The library does not decode beat packets (port 50001, type 0x28). They are parsed in `prolink/packets.ts`
  per the DJ Link analysis. If a deck sends none (unverified for the XDJ-AZ), beats are derived from status
  `beatInMeasure` changes, which is less precise.

**What is mapped**

- Live status, BPM, pitch, beat, master/sync/on-air: `ETH_LIVE`. Beat phase and transitions: `DERIVED`.
- Title, artist, album, key, genre, cues, loops, waveform (400-column preview plus 3-band when present) and
  phrases, read from the rekordbox export over the network: `ETH_LIBRARY`.
- Mixer data is never invented: no prolink field is mapped to it. The AZ's mixer may not report faders or on-air.
- Device numbers are not hardcoded: 1-4 keep their deck, other player numbers take the lowest free deck in order
  of appearance, and each assignment is logged.
- Track pipeline: change of loaded track starts an asynchronous fetch (LRU cache, retries, `trackStatus`
  loading / ready / unavailable). A stick not exported with rekordbox gives "USB not exported with rekordbox:
  beat grid and cues unavailable"; partial analysis gives a "Partial metadata" note.

**Resilience**: status events `connecting`, `online`, `no devices`, `permission denied`, `rekordbox conflict`,
`error`; automatic reconnect with back-off (not for permission or missing-pcap problems); an unplugged
cable or USB interface is detected and retried; nothing throws into the main process.

**Packet inspector** (second tab): packets per second and kinds per port, sampled packets with hex preview, and
an observations list (new devices, deck mapping, first raw status bytes per device, mixer on-air packets,
mediaSlot broadcasts). Tick "Write every packet to a JSONL file" to record everything (file in the user data
folder under `packet-logs/`, path shown in the panel). Each record has port, length, kind, hex preview and the
full payload.

**Tests with packet fixtures**: `prolink/testing/packetBuilders.ts` builds synthetic announce, status and beat
packets (layouts from the library parsers and the DJ Link analysis; they are not hardware recordings) and
`passiveSession.integration.test.ts` replays them through the real library services. JSONL logs recorded from
the AZ can be dropped into `src/main/sources/prolink/testing/recordings/`; `recordings.test.ts` replays them
automatically.

## Dashboard (step 3)

Dark theme, large type, one card per active deck (toggle "Show all decks"). Try it without hardware: **Start demo
mode** runs the simulator, and a **SIMULATED DATA** banner plus a SIMULATED chip on every card stay visible while
simulated data is on screen. Hook events also carry `source` and `simulated`.

**Origin badges.** Every value or panel has a badge: ETH LIVE, ETH LIBRARY, USB-C or DERIVED, each with its own color
and icon, a legend in the top bar, and a tooltip with the value's age ("updated 38 ms ago"). Fields the active
source cannot provide (`shared/capabilities.ts`) show a muted "N/A on this hardware"; fields still to arrive show
"waiting". There are no blanks or placeholder zeros. When the source stops, cards are dimmed and marked STALE.

**Performance.** Beats cost no React renders. Events are batched every 50 ms into Zustand slices that keep the same
object when only a timestamp changed, and into a mutable `live/liveData.ts` registry. One shared
`requestAnimationFrame` loop draws the beat pulses and the phase ring (canvas, direct DOM writes). The phase is
interpolated from BPM and the last beat time (`lib/phaseSmoother.ts`); a new beat re-anchors it through a decaying
offset, so there is no visible jump. The waveform is a cached canvas with a transform-only playhead. Measured in
the running app with four simulated decks: 60 fps, p99 frame 20 ms.

**Panels** (side tabs): BPM history (uPlot, 5 minutes, one line per deck), transition timeline (overlaps and
DERIVED transitions with confidence), energy/phrases (current section and time to the next change), event log
(filterable, pausable), packet rate sparklines per port, devices, packet inspector and **visual hooks**.

**Visual hooks.** `main/hooks/hookEngine.ts` derives `beat`, `phraseChange`, `transition` and `bpmChange` from the
normalized stream (a BPM change needs a 0.5 BPM move, so pitch drift stays quiet). The Hooks panel shows the exact
JSON; "Broadcast over WebSocket" starts a small send-only server on `ws://127.0.0.1:8765` (loopback only, port
configurable, no dependency: `main/hooks/hookServer.ts` implements the RFC 6455 handshake and text frames).

**Position.** Playhead, elapsed/remaining and phrase timing need the track position. The simulator reports it like
the CDJ-3000 absolute-position packets. On an XDJ-XZ the prolink source derives it: the status packets carry the
track's beat counter (`beat`), which is looked up in the ANLZ beat grid and advanced at the current pitch between
beats, so it is re-anchored on every beat (about 200 ms of error at most, `DERIVED`). It needs the track's analysis
file on the stick; without it the position shows "N/A".

**Artwork.** The cover is read from the stick (`/PIONEER/Artwork/.../aNN_m.jpg`, else `aNN.jpg`) when rekordbox
exported one for the track; tracks without artwork stay empty.

**Accessibility.** High-contrast text, visible focus rings, a native modal settings dialog (Esc closes, Tab stays
inside), arrow-key tab navigation, a reduce-motion setting, labelled controls.

## Optional sources and transition detection (step 4)

Two optional sources run in the renderer next to the primary one (simulator or Ethernet). They never replace it:
their status is separate (top-bar chips "USB-C MIDI" and "Audio"), and every panel that depends on them says
which source is missing instead of showing zeros. Their values enter the same event bus, hook engine and
WebSocket through one validated IPC channel (`ingest`, batches of at most 200 events).

**USB-C MIDI (origin `USBC`).** Tab "USB-C". MIDI starts with the app and listens to every port of a recognised device
(port names starting with `XDJ-XZ`, i.e. both "XDJ-XZ (1)" and "XDJ-XZ (2)") plus one extra input you may choose. For the
XDJ-XZ the **XDJ-XZ mixer** panel draws the four channel strips (TRIM, HI, MID, LOW, COLOR knobs, fader, CUE, crossfader
assign), the crossfader, master level, booth, master EQ, headphones and Beat FX, filled live. The map
(`lib/xzMap.ts`) comes from Pioneer's "XDJ-XZ MIDI Message List" (E3): mixer controls are Control Change on MIDI channel 5,
value 0-127. Two of them were seen on the unit (CC 9 = deck 2 EQ LOW, CC 5 = deck 1 COLOR); the rest follow the list and
are UNVERIFIED until moved. Knobs show the raw 0-127 number, not dB, because the list gives only the end points. The
unit sends mixer messages only while UTILITY > MIXER MIDI MESSAGE is on SEND. Recognised channel, EQ, trim, color and
crossfader controls feed `mixer` events automatically (a saved mapping overrides). The explorer (collapsed under the
panel) lists every message live (raw bytes plus a decoded guess using only the standard MIDI layout),
keeps a per-control summary (last value, range, count) and lets you label a control and map it to a mixer value
(`crossfader`, `chN.fader|trim|color|eqHigh|eqMid|eqLow`, optionally inverted). "Save mapping" writes
`midi-mapping.json` in the user data folder (also copy/import as JSON). Mapped and recognised controls reach the app as
`mixer` events tagged `USBC` with `source: 'usbc'`; the Mixer panel shows them apart from the simulator's mixer.
Clock and active sensing are hidden from the stream by default (still counted). "Write every message to a JSONL
file" logs raw bytes and the guess under `packet-logs/midi-*.jsonl`.
A control is identified as `group:channel:number` (`cc:1:7`, `note:1:36`, `pitchbend:1:0`; note on/off share one
key, channels are 1-16, note 60 = C4).

**Audio analysis (origin `DERIVED`).** Tab "Audio". Choose an input device and Start. `AnalyserNode`
(fft 2048, no smoothing; echo cancellation, noise suppression and auto gain off; the input is never played back)
is read every 25 ms for: RMS, low/mid/high band energy (20-150 Hz, 150-2 kHz, 2-16 kHz; mean power per band mapped
from -90..-20 dB to 0..1), spectral flux with adaptive-threshold onset peaks (90 ms minimum gap, silence gate) and
a buildup/drop detector (bass held below half its long-term level for 1.5 s while mid/high rise = `buildup`;
bass jumping back by 0.25 or more during a buildup = `drop`; 8 s cool-down, 30 s timeout). The spectrum and band
bars draw at 60 fps from a mutable registry. Published events: `energy` (10 Hz), `onset`, `drop` (with `phase`),
also as hooks with `source: 'audio'`. The thresholds are starting points checked on synthetic signals and the
electron fake audio device, not tuned on real DJ audio.

**Transition detection (origin `DERIVED`).** `main/transition/` replaces the old master-flag-only rule. A
transition is emitted when the master flag moves to another deck, or when an audible deck (playing and on air)
stops after at least 2 s of overlap with another (not repeated for the same pair within 25 s). Confidence is the
weight of signals seen divided by the weight of signals whose data was available, and the event lists every signal:

| Signal         | Weight | Seen when                                                                  | Needs                             |
| -------------- | ------ | -------------------------------------------------------------------------- | --------------------------------- |
| `masterChange` | .30    | master flag moved from -> to in the last 30 s                              | deck states                       |
| `overlap`      | .20    | both decks audible together for 2 s or more                                | deck states                       |
| `onAir`        | .15    | target went on air or source went off air in the last 30 s                 | on-air flags                      |
| `bpmSync`      | .10    | target synced, or BPMs within 1%                                           | BPM or sync flags                 |
| `fader`        | .15    | faders crossed 0.4 in opposite directions, or crossfader moved 0.4 in 30 s | mixer values (USB-C or simulator) |
| `audio`        | .10    | a `drop` within the previous 20 s                                          | fresh `energy` events             |

The Overview tab lists recent transitions with chips for seen, not seen and N/A signals (hover for the missing
source) and a line naming the signals currently in use. USB-C mixer values take precedence over the simulator's.

**Permissions.** `main/permissions.ts` allows only MIDI (Electron reports every MIDI request as `midiSysex`, so
SysEx input is allowed; the app opens no outputs), audio-only capture and clipboard writes; video and everything else
is refused. On macOS the first audio start asks the OS for microphone access (`askForMediaAccess`); a refusal shows
"permission refused" with the OS status. The window is created with `backgroundThrottling: false` so analysis keeps
its 25 ms cadence behind other windows.

**Not verified on hardware.** Nothing here has been run against a real XDJ-AZ: whether it exposes a MIDI port over
USB-C, what it sends, and whether it appears as an audio input are unknown. MIDI was verified only to the point of
Web MIDI access being granted with zero ports, plus unit tests on synthetic bytes; audio was verified with
Chromium's fake input device.

## Settings, logging, diagnostics, recording (final pass)

**Settings** are kept with [`electron-store`](https://github.com/sindresorhus/electron-store) in `settings.json` in the
user data folder (atomic writes, a corrupt file is reset). Each section is validated on its own and falls back to its
defaults, so a damaged section never loses the others, and files from older versions load as they are. Remembered:
network interface, mode (auto/passive/active), packet-log flag, dashboard options (all decks, reduce motion, hook port),
the MIDI port and audio device, the selected source tab, the open side tab, whether the first-run checklist was
dismissed, and the window size and position (dropped when no screen shows the saved position).

**Logging** uses [`electron-log`](https://github.com/megahertz/electron-log): `console.*` in the main process, uncaught
errors, renderer errors (forwarded over IPC), renderer/child process crashes and source errors go to
`~/Library/Logs/deckpulse/main.log` on macOS (`%USERPROFILE%\AppData\Roaming\deckpulse\logs\main.log` on Windows),
5 MB per file. React error boundaries wrap the top bar, the deck view, every deck card and every side panel; a failing
part shows an error box with "Try again" while the rest keeps running.

**Diagnostics tab.** OS and versions (Electron, Node, Chrome), whether the native `cap` module loads and how many
capture devices libpcap lists, capture permission (macOS: whether any `/dev/bpf*` device is readable; Windows and Linux
cannot be probed, so they say `unknown`), selected interface and mode, source state, devices seen, packets per port,
the last 50 errors from all processes and the log file path. "Copy diagnostics" puts the same facts, plus the checklist,
on the clipboard as plain text (no track titles).

**First-run checklist.** A banner (and the top of the Diagnostics tab) judges five things from live data: cable and
interface (selected interface exists and has an IPv4 address), same subnet (heard device addresses lie inside an
interface subnet), rekordbox not running on this computer (a problem only in active mode), USB stick exported by
rekordbox (from the track-loading status, unknown until a track loads), and capture permissions. Each shows OK, Check,
Problem or Unknown and what to do. Dismiss it once you are set up.

**Recording and replay.** "Record" in the top bar writes a JSONL file to `recordings/` in the user data folder. Line 1
is a header; then one `raw` record per source event (before normalization), one `event` record per normalized event and
one `ingest` record per batch from MIDI/audio, each with its wall-clock time `t`. Typed arrays (waveforms) are stored
as base64. Choose the **Replay** source tab, pick the file, press Start: raw and ingest records are played at real-time
speed through the same pipeline as live data (normalizer, transition detector, hook engine, WebSocket, dashboard), with
timestamps moved to the present. A file that only has normalized events is replayed from those (derived `transition`,
`hook` and `sourceStatus` records are skipped because they are derived again). "Loop" restarts after one second. A blue
REPLAY banner stays on screen; the source is `replay`, and hook events carry `source: 'replay'` with `simulated: true`
when the recording came from the simulator. Recording is off while replaying. Damaged lines are counted and skipped.

## Packaging

`electron-builder.yml` builds macOS (dmg and zip, arm64 and x64) and Windows (NSIS, x64). Native modules (`cap`,
`better-sqlite3-multiple-ciphers`) are rebuilt for Electron's ABI and unpacked from the asar archive. Renderer
libraries are bundled by Vite, so they are `devDependencies` and stay out of the installer. No icon is set yet
(Electron's default is used): put `icon.icns` and `icon.ico` in `build/`.

| Topic                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native `cap` module     | No prebuilt binaries: it compiles with node-gyp (Python and a C++ toolchain: Xcode command line tools on macOS, Visual Studio Build Tools on Windows). Build each platform and arch on its own OS; cross-compiling is not supported.                                                                                                                                                                            |
| macOS runtime           | Uses the system libpcap. Capturing needs read access to `/dev/bpf*`: install Wireshark's ChmodBPF helper or run the app with sudo. This cannot be granted through an entitlement or the installer.                                                                                                                                                                                                              |
| Windows runtime         | Needs [Npcap](https://npcap.com) installed in WinPcap-compatible mode. It is not bundled (its license restricts redistribution), so list it as a prerequisite in your installer notes.                                                                                                                                                                                                                          |
| macOS signing           | Set `CSC_LINK` and `CSC_KEY_PASSWORD` (a Developer ID Application certificate) and, for notarization, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Hardened runtime and `build/entitlements.mac.plist` (JIT, audio input) are already configured. Without credentials use `-c.mac.identity=null -c.mac.notarize=false`; Gatekeeper will then block the app until the quarantine flag is removed. |
| Microphone              | `NSMicrophoneUsageDescription` and the audio-input entitlement are set for the audio panel.                                                                                                                                                                                                                                                                                                                     |
| Windows signing         | Set `CSC_LINK` and `CSC_KEY_PASSWORD` for a code-signing certificate (an EV certificate avoids the SmartScreen warning at first). Unsigned installers install, with a warning.                                                                                                                                                                                                                                  |
| What was actually built | An unsigned macOS arm64 unpacked app (`electron-builder --mac dir`) was built and started: `cap` loaded from `app.asar.unpacked`, `electron-store` and `electron-log` worked. **UNVERIFIED:** the dmg and zip targets, x64, signing, notarization and everything for Windows.                                                                                                                                   |

## Troubleshooting

Open the Diagnostics tab first; it names most of these. Logs are in the folder given there.

| Symptom                                             | Cause and fix                                                                                                                                                                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permission denied` when starting the XDJ-AZ source | macOS: no `/dev/bpf*` device is readable. Install Wireshark's ChmodBPF helper (then log out and in) or start the app with sudo. Windows: install Npcap, try an administrator shell. Linux: `sudo setcap cap_net_raw,cap_net_admin=eip <electron binary>`. |
| `rekordbox conflict`                                | Active mode needs UDP 50000-50002 and rekordbox holds them. Quit rekordbox; `auto` then falls back to passive, which shows no deck status on an XDJ-XZ.                                                                                                   |
| Devices found, but no decks or track data           | Passive capture only hears announcements and beats. The XDJ-XZ sends deck status only to devices that joined the network: set Mode to `auto` or `active` in Settings and press Start again.                                                               |
| Two USB Ethernet adapters plugged into the deck     | Both see the same traffic (the deck switches its LAN ports internally), so either works. Use one cable, and pick its interface in Settings, to avoid ambiguity between two link-local networks.                                                           |
| `no devices`                                        | Check the cable (AZ LAN port to this computer or a switch), pick that interface in Settings, run "Test connection", and make sure the AZ has Pro DJ Link enabled and is not only connected over USB-C.                                                    |
| Devices heard but wrong subnet                      | The checklist flags device addresses outside the interface network. Set a manual address in the same range (link-local `169.254.x.x` if the AZ has no DHCP).                                                                                              |
| Tracks show "USB not exported with rekordbox"       | The stick must be exported from rekordbox (Export mode); a stick with plain files has no beat grid, cues or waveform. Live BPM and beats still work without it.                                                                                           |
| "pcap module did not load"                          | Run `npm run rebuild`. On Windows install Npcap (WinPcap-compatible mode). A `NODE_MODULE_VERSION` message means the module was built for a different Electron: rebuild.                                                                                  |
| Interface vanished                                  | A USB or Ethernet adapter was unplugged. The source waits and reconnects by itself.                                                                                                                                                                       |
| USB-C MIDI lists no input                           | The unit exposes none to this computer, or the cable is charge-only. Check that macOS Audio MIDI Setup lists it.                                                                                                                                          |
| Audio: "permission refused"                         | macOS: System Settings > Privacy & Security > Microphone, enable DeckPulse (or Electron in dev), then Start again.                                                                                                                                        |
| A panel shows "stopped working"                     | An error boundary caught a bug. "Try again" re-renders it; the stack is in the log file and the Diagnostics error list. Please attach the copied diagnostics when reporting it.                                                                           |
| Settings look reset                                 | A corrupt `settings.json` is cleared on start. Sections that fail validation fall back to defaults. Delete the file to start fresh.                                                                                                                       |
| Replay says "Cannot replay"                         | The file is missing, not DeckPulse JSONL, or from a newer format version. A recording with only a header has nothing to replay.                                                                                                                           |

## What data comes from where on the XDJ-XZ / XDJ-AZ

Status words: **CONFIRMED** means it was observed in logs or runs on this project's machine; **UNVERIFIED** means it
follows library documentation, the DJ Link analysis or the product brief but was never observed. The unit used so far
is an **XDJ-XZ** (it announces itself as "XDJ-XZ"; players 1 and 2, mixer 33, one address `169.254.62.225`). Everything
below marked CONFIRMED was seen on it on 2026-10-20 (macOS, two USB Ethernet adapters, link-local addresses). Nothing
was observed on an XDJ-AZ, so its rows stay UNVERIFIED. Packet logs of the unit exist only for the debugging session
in `/tmp`, not in the project; keep `recordings/` and `packet-logs/` from your own runs as evidence.

| Data                                               | Origin        | Path                                                   | Status         | Evidence                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------- | ------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device announcements, deck mapping                 | `ETH_LIVE`    | Ethernet, UDP 50000                                    | CONFIRMED      | `main.log`: players 1 and 2 (type 1) and mixer 33 (type 3) announced from one IP, named "XDJ-XZ"                                                                                                                                                                                                                                                        |
| Play state, BPM, pitch, titles' deck mapping       | `ETH_LIVE`    | Ethernet, status packets (UDP 50002), active mode only | CONFIRMED (XZ) | Active mode: ~11 status packets/s, decks 1 and 2 mapped, play state and BPM shown. Passive capture saw none in 15 s                                                                                                                                                                                                                                     |
| Pitch of an idle deck                              | `ETH_LIVE`    | Status packets                                         | CONFIRMED (XZ) | An idle deck reported a raw pitch of 0, i.e. -100%; the app now treats it as unknown                                                                                                                                                                                                                                                                    |
| Master/sync/on-air flags                           | `ETH_LIVE`    | Status packets                                         | UNVERIFIED     | Parsed, but no deck had a flag lit during the observation                                                                                                                                                                                                                                                                                               |
| Beat packets                                       | `ETH_LIVE`    | Ethernet, UDP 50001 type 0x28                          | CONFIRMED (XZ) | 88 bytes, not the documented 96: no BPM and no beat-in-bar. The parser derives both from the next-beat and next-bar times, checked on four captured packets                                                                                                                                                                                             |
| Loaded track id and slot                           | `ETH_LIVE`    | Ethernet, status packets                               | CONFIRMED (XZ) | Track ids such as `1:3:101` read; a track played from the other deck's stick is fetched from that deck                                                                                                                                                                                                                                                  |
| Title, artist, key, track BPM                      | `ETH_LIBRARY` | Ethernet (NFS) from the rekordbox-exported stick       | CONFIRMED (XZ) | The stick holds both `exportLibrary.db` (OneLibrary) and `export.pdb` with different track ids. The XZ's ids matched only `export.pdb` (ids 102/132 gave other titles in OneLibrary; the PDB rows' BPM equalled the player's 133). The library's lookup now compares the player's BPM and switches format; the switch is logged. Checked on three loads |
| Cues, waveform, phrases                            | `ETH_LIBRARY` | Same                                                   | UNVERIFIED     | Not inspected on the unit                                                                                                                                                                                                                                                                                                                               |
| Playhead position                                  | `DERIVED`     | Status-packet beat counter + ANLZ beat grid            | UNVERIFIED     | The beat counter was confirmed on the XZ (it counted 406, 407, 408... while playing, 17 while idle); the position built from it is tested on synthetic data only. Not exact: re-anchored every beat                                                                                                                                                     |
| Artwork                                            | `ETH_LIBRARY` | Ethernet (NFS) `/PIONEER/Artwork/...`                  | CONFIRMED (XZ) | The track's artwork path was read from the database and both `a85.jpg` and `a85_m.jpg` fetched as valid JPEGs from the stick                                                                                                                                                                                                                            |
| Media slot info (name, track and playlist counts)  | `ETH_LIVE`    | Status port, media-slot packets                        | CONFIRMED (XZ) | A 184-byte media-slot packet from device 1 was captured and decoded (track count 493, 20 playlists); shown in All data                                                                                                                                                                                                                                  |
| Faders, EQ, crossfader via Ethernet                | none          | Not provided: never invented                           | N/A            | Mixer values come only from USB-C MIDI mappings                                                                                                                                                                                                                                                                                                         |
| Beat phase, transitions, energy, drops             | `DERIVED`     | Computed in the app                                    | UNVERIFIED     | Logic tested on the simulator and synthetic signals, not on hardware data                                                                                                                                                                                                                                                                               |
| Packet capture permission on macOS                 | n/a           | `/dev/bpf*` read access                                | CONFIRMED      | Two packet logs and the Diagnostics probe: devices exist, none readable                                                                                                                                                                                                                                                                                 |
| Native pcap module loads (dev and packaged macOS)  | n/a           | `cap` + libpcap                                        | CONFIRMED      | Diagnostics reports the module loaded with 23-24 capture devices                                                                                                                                                                                                                                                                                        |
| Web MIDI access is possible in the app             | n/a           | Chromium Web MIDI, permission handler                  | CONFIRMED      | Request granted, zero ports listed (no unit attached)                                                                                                                                                                                                                                                                                                   |
| XDJ exposes MIDI over USB-C, and what it sends     | `USBC`        | USB-C                                                  | CONFIRMED (XZ) | Two inputs, "XDJ-XZ (1)" and "XDJ-XZ (2)"; (2) sent 351 messages in 8 s, e.g. `b4 09 2f`, `b4 09 2e`... = CC 9 on channel 5 counting down = deck 2 EQ LOW, as in Pioneer's MIDI list; CC 5 (deck 1 COLOR) read 63. 10 of 43 mixer controls seen in 24 s of casual use                                                                                   |
| AZ appears as a USB audio input                    | `DERIVED`     | USB-C audio                                            | UNVERIFIED     | Analysis was run only on Chromium's fake input device (band bars and onsets worked)                                                                                                                                                                                                                                                                     |
| Record and replay round trip                       | n/a           | JSONL                                                  | CONFIRMED      | A recorded simulator run (247 raw and 247 normalized records) replayed to the end                                                                                                                                                                                                                                                                       |
| Settings, logging, diagnostics in the packaged app | n/a           | electron-store, electron-log                           | CONFIRMED      | Unsigned macOS arm64 build started; log file written, settings persisted                                                                                                                                                                                                                                                                                |

## Not included yet

- Absolute position packets (CDJ-3000-class only) and the Stagehand connection mode are not used.

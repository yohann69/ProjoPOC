/*
 * Prolink source: real Pro DJ Link data from an XDJ-AZ (or other AlphaTheta gear) via alphatheta-connect.
 *
 * What the library docs and typings (v0.28.5) say, as read before writing this:
 * - bringOnline() joins as a virtual CDJ (active mode). It needs UDP 50000-50002 for itself and
 *   fails (EADDRINUSE) while rekordbox or a second instance runs on the same computer.
 * - All-in-one units (XDJ-XZ/RX/AZ, Opus Quad) cannot be joined that way, so the library offers a
 *   passive mode that captures packets with pcap (native `cap` module, needs capture rights) and
 *   sends nothing. The XDJ-AZ is listed as "untested"; the XDJ-XZ is the tested reference.
 * - All-in-ones may expose several decks (device numbers 1, 2, mixer 33 on the XZ) behind one IP,
 *   report their USB ports as the SD (USB 1) and USB (USB 2) slots of player 1, use different
 *   play-state flag bytes than nexus players, and were documented to send no mediaSlot broadcasts
 *   (an XDJ-XZ in active mode was seen sending them). Without them the library fetches export.pdb
 *   over NFS without media info (PassiveLocalDatabase.get).
 * - Library data: rekordbox exports hold export.pdb and/or exportLibrary.db (OneLibrary) plus
 *   PIONEER/USBANLZ ANLZ files. DAT has beat grid, cues and the 400-column preview; EXT has
 *   extended cues, phrases (PSSI) and detail waveforms; 2EX has 3-band waveforms. A stick that was
 *   not exported with rekordbox has none of this.
 * - Beat packets (port 50001, type 0x28) are not decoded by the library; positions packets
 *   (0x0b) exist only on CDJ-3000-class players. Beat packets are parsed in packets.ts per the
 *   DJ Link analysis; without them, beats are derived from status beat-in-measure changes.
 *
 * Known library defect (0.28.5): PcapAdapter.start() always throws because its bundle cannot
 * resolve `cap`. Passive mode therefore uses our own capture plus the library's passive services.
 *
 * Everything unverified on the AZ is logged as an observation (sourceLog + JSONL packet log).
 */
import { EventEmitter } from 'node:events'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import type { ProlinkConfig } from '@shared/prolink'
import type { SourceId, SourceState } from '@shared/types'
import type { DataSource } from './types'
import type { PacketCapture } from './prolink/capture'
import { connectSession } from './prolink/connect'
import { createContext, type SessionContext } from './prolink/context'
import { classifyError, ProlinkError } from './prolink/errors'
import { PacketInspector } from './prolink/inspector'
import type { Library } from './prolink/library'
import { JsonlLog } from './prolink/packetLog'
import type { SessionInfo } from './prolink/passiveSession'
import type { ProlinkRawEvent } from './prolink/rawTypes'

export interface ProlinkDeps {
  loadLibrary: () => Promise<Library>
  createCapture: (iface: string) => PacketCapture
  /** Folder for JSONL packet logs. */
  logDir: string
  pollMs?: number
  /** How long passive capture may hear devices without deck status before hinting at active mode. */
  noStatusMs?: number
  /** Passive mode switches to active once when devices are heard but send no status. Default true. */
  upgradeToActive?: boolean
  retryDelaysMs?: number[]
}

const NO_STATUS_MS = 8000

const hasIpv4 = (iface: string): boolean =>
  (networkInterfaces()[iface] ?? []).some((i) => i.family === 'IPv4')

export class ProlinkSource implements DataSource<ProlinkRawEvent> {
  readonly id: SourceId = 'prolink'
  private readonly emitter = new EventEmitter()
  private readonly inspector: PacketInspector
  private readonly ctx: SessionContext
  private session: SessionInfo | null = null
  private stopped = true
  private lastStatus = ''
  private wake: (() => void) | null = null
  private forceActive = false
  private upgradeTried = false

  constructor(
    private readonly config: ProlinkConfig,
    private readonly deps: ProlinkDeps
  ) {
    const emit = (raw: ProlinkRawEvent): void => void this.emitter.emit('event', raw)
    this.inspector = new PacketInspector((event) => emit({ kind: 'inspector', event }))
    this.ctx = createContext(emit, (level, message) => {
      console[level === 'info' ? 'info' : level]('[prolink]', message)
      this.inspector.writeObservation(level, message)
    })
  }

  on(event: 'event', listener: (raw: ProlinkRawEvent) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  off(event: 'event', listener: (raw: ProlinkRawEvent) => void): this {
    this.emitter.off(event, listener)
    return this
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.inspector.start()
    if (this.config.packetLog) this.setPacketLog(true)
    void this.run()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    this.wake?.()
    void this.session?.stop()
    this.session = null
    this.inspector.stop()
    this.setStatus('stopped')
  }

  /** Starts or stops the JSONL packet log; returns the file path when enabled. */
  setPacketLog(enabled: boolean): string | null {
    if (!enabled) {
      this.inspector.setLog(null)
      return null
    }
    const path = join(
      this.deps.logDir,
      `prolink-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
    )
    this.inspector.setLog(
      new JsonlLog(path, (e) => this.ctx.log('error', `packet log failed: ${e.message}`))
    )
    this.ctx.log('info', `packet log: ${path}`)
    return path
  }

  private setStatus(state: SourceState, message?: string): void {
    const key = `${state}|${message ?? ''}`
    if (key === this.lastStatus) return
    this.lastStatus = key
    this.emitter.emit('event', { kind: 'status', ts: this.ctx.now(), state, message })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms)
      this.wake = () => {
        clearTimeout(timer)
        resolve()
      }
    })
  }

  /** Connect, watch, and reconnect with back-off until stopped or the failure cannot fix itself. */
  private async run(): Promise<void> {
    const delays = this.deps.retryDelaysMs ?? [2000, 4000, 8000, 15000]
    let attempt = 0
    while (!this.stopped) {
      this.setStatus('connecting', `mode ${this.config.mode}`)
      try {
        const { session, iface } = await this.connect()
        if (this.stopped) return void session.stop()
        this.session = session
        attempt = 0
        await this.watch(session, iface)
      } catch (error) {
        const failure = classifyError(error)
        const upgradeBlocked = this.forceActive && failure.kind === 'rekordboxConflict'
        if (upgradeBlocked) this.forceActive = false
        this.setStatus(failure.sourceState, failure.message)
        this.ctx.log('error', failure.message)
        if (!failure.retryable && !upgradeBlocked) return
      }
      await this.session?.stop()
      this.session = null
      if (this.stopped) return
      await this.sleep(delays[Math.min(attempt++, delays.length - 1)] ?? 15000)
    }
  }

  private connect(): Promise<{ session: SessionInfo; iface: string }> {
    return connectSession(
      this.forceActive ? { ...this.config, mode: 'active' } : this.config,
      this.deps,
      this.ctx,
      this.inspector
    )
  }

  private async watch(session: SessionInfo, iface: string): Promise<void> {
    const startedAt = this.ctx.now()
    while (!this.stopped) {
      if (session.failure) throw session.failure
      if (!hasIpv4(iface)) {
        throw new ProlinkError(
          'noInterface',
          `Interface ${iface} is gone (cable or USB unplugged?). Waiting for it to return.`
        )
      }
      const count = session.deviceCount
      const noStatus =
        session.statusSeen === false &&
        this.ctx.now() - startedAt > (this.deps.noStatusMs ?? NO_STATUS_MS)
      const heard = noStatus
        ? `${count} device(s) on ${iface}, but no deck status packets: the unit sends them only to devices that joined the network. Use Active mode.`
        : `${count} device(s) on ${iface}`
      this.setStatus(
        count > 0 ? 'online' : 'noDevices',
        count > 0 ? heard : `listening on ${iface}: no Pro DJ Link devices heard`
      )
      if (
        noStatus &&
        this.config.mode === 'passive' &&
        !this.upgradeTried &&
        this.deps.upgradeToActive !== false
      ) {
        this.upgradeTried = this.forceActive = true
        this.ctx.log(
          'warn',
          'Passive capture hears no deck status from this unit; switching to active mode (virtual CDJ).'
        )
        return
      }
      await this.sleep(this.deps.pollMs ?? 2000)
    }
  }
}

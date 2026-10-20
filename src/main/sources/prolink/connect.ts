import { networkInterfaces, type NetworkInterfaceInfoIPv4 } from 'node:os'
import type { ProlinkConfig } from '@shared/prolink'
import { ActiveSession } from './activeSession'
import type { PacketCapture } from './capture'
import type { SessionContext } from './context'
import { classifyError, ProlinkError } from './errors'
import type { PacketInspector } from './inspector'
import type { Library } from './library'
import { PassiveSession, type SessionInfo } from './passiveSession'

export interface ConnectDeps {
  loadLibrary: () => Promise<Library>
  createCapture: (iface: string) => PacketCapture
}

/**
 * Opens a session in the configured mode. `auto` joins as a virtual CDJ (the only way an XDJ-XZ
 * sends deck status) and falls back to passive capture when rekordbox holds the ports.
 */
export async function connectSession(
  config: ProlinkConfig,
  deps: ConnectDeps,
  ctx: SessionContext,
  inspector: PacketInspector
): Promise<{ session: SessionInfo; iface: string }> {
  const library = await deps.loadLibrary()
  const iface = config.iface ?? library.findAlphaThetaInterface()?.name
  if (!iface) {
    throw new ProlinkError(
      'noInterface',
      'No network interface selected and no AlphaTheta hardware detected on any interface.'
    )
  }
  if (config.mode !== 'passive') {
    try {
      return { session: await startActive(library, deps, ctx, inspector, iface), iface }
    } catch (error) {
      const failure = classifyError(error)
      if (config.mode !== 'auto' || failure.kind !== 'rekordboxConflict') throw failure
      ctx.log(
        'warn',
        `${failure.message} Falling back to passive mode, which shows no deck status.`
      )
    }
  }
  const passive = new PassiveSession(library, deps.createCapture(iface), ctx, inspector)
  try {
    passive.start()
    return { session: passive, iface }
  } catch (error) {
    passive.stop()
    throw classifyError(error)
  }
}

async function startActive(
  library: Library,
  deps: ConnectDeps,
  ctx: SessionContext,
  inspector: PacketInspector,
  iface: string
): Promise<SessionInfo> {
  const info =
    (networkInterfaces()[iface] ?? []).find(
      (i): i is NetworkInterfaceInfoIPv4 => i.family === 'IPv4'
    ) ?? null
  const active = new ActiveSession(library, ctx, inspector, info, deps.createCapture(iface))
  try {
    await active.start()
  } catch (error) {
    await active.stop()
    throw error
  }
  return active
}

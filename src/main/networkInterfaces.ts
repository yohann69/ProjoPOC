import { networkInterfaces } from 'node:os'
import type { ConnectionTestResult, InterfaceInfo } from '@shared/prolink'
import { classifyError } from './sources/prolink/errors'
import type { Library } from './sources/prolink/library'
import { createLibraryAdapter } from './sources/prolink/libraryAdapter'
import type { PacketCapture } from './sources/prolink/capture'

interface Deps {
  loadLibrary: () => Promise<Library>
  createCapture: (iface: string) => PacketCapture
}

const TEST_WINDOW_MS = 4000

/** Non-internal IPv4 interfaces, flagged when alphatheta-connect recognizes AlphaTheta hardware. */
export async function listInterfaceInfos(
  loadLibrary: Deps['loadLibrary']
): Promise<InterfaceInfo[]> {
  const detected = new Map<string, string>()
  try {
    for (const found of (await loadLibrary()).findAllAlphaThetaInterfaces()) {
      detected.set(found.name, found.connectionType)
    }
  } catch {
    // Detection only adds hints; the plain interface list still works without it.
  }
  const result: InterfaceInfo[] = []
  for (const [name, infos] of Object.entries(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      const connection = detected.get(name)
      const linkLocal = info.address.startsWith('169.254.')
        ? 'link-local address, typical for a USB link'
        : undefined
      result.push({
        name,
        address: info.address,
        alphaTheta: connection !== undefined,
        hint: connection ? `AlphaTheta hardware detected (${connection})` : linkLocal
      })
    }
  }
  return result.sort((a, b) => Number(b.alphaTheta) - Number(a.alphaTheta))
}

/** Captures for a few seconds and reports which Pro DJ Link devices announced themselves. */
export async function testConnection(iface: string, deps: Deps): Promise<ConnectionTestResult> {
  const capture = deps.createCapture(iface)
  let packets = 0
  let manager: InstanceType<Library['PassiveDeviceManager']> | null = null
  try {
    const library = await deps.loadLibrary()
    const { adapter, route } = createLibraryAdapter(iface)
    manager = new library.PassiveDeviceManager(adapter)
    capture.on('packet', (packet) => {
      packets++
      route(packet)
    })
    capture.start()
    await new Promise((resolve) => setTimeout(resolve, TEST_WINDOW_MS))
    const devices = [...manager.devices.values()].map((d) => `${d.name} #${d.id} (${d.ip.address})`)
    if (devices.length > 0) {
      return {
        ok: true,
        message: `Heard ${devices.length} Pro DJ Link device(s) on ${iface}.`,
        devices
      }
    }
    const message =
      packets > 0
        ? `Heard ${packets} packets on UDP 50000-50100 but no device announcement yet.`
        : `No Pro DJ Link traffic heard on ${iface} in ${TEST_WINDOW_MS / 1000} s.`
    return { ok: packets > 0, message, devices }
  } catch (error) {
    return { ok: false, message: classifyError(error).message, devices: [] }
  } finally {
    capture.stop()
    manager?.stop()
  }
}

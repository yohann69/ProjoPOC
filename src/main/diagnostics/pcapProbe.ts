import { accessSync, constants, readdirSync } from 'node:fs'
import type { DiagnosticsInfo, PcapPermission } from '@shared/diagnostics'
import type { CapModule } from '../sources/prolink/capTypes'

export interface PcapReport {
  moduleLoaded: boolean
  error?: string
  deviceCount: number | null
  permission: PcapPermission
  permissionDetail: string
}

export interface FsProbe {
  list(dir: string): string[]
  canReadWrite(path: string): boolean
}

export const realFs: FsProbe = {
  list: (dir) => readdirSync(dir),
  canReadWrite(path) {
    try {
      accessSync(path, constants.R_OK | constants.W_OK)
      return true
    } catch {
      return false
    }
  }
}

/** macOS only lets libpcap capture through a readable /dev/bpf* device. */
export function bpfAccess(fs: FsProbe): { permission: PcapPermission; detail: string } {
  let devices: string[]
  try {
    devices = fs.list('/dev').filter((name) => /^bpf\d+$/.test(name))
  } catch {
    return { permission: 'unknown', detail: 'Could not list /dev.' }
  }
  if (devices.length === 0) return { permission: 'denied', detail: 'No /dev/bpf* devices found.' }
  const open = devices.find((name) => fs.canReadWrite(`/dev/${name}`))
  return open
    ? { permission: 'ok', detail: `/dev/${open} is readable and writable.` }
    : {
        permission: 'denied',
        detail: `${devices.length} /dev/bpf* devices exist but none is readable by this user (install Wireshark's ChmodBPF helper or run with sudo).`
      }
}

function permissionFor(platform: NodeJS.Platform, fs: FsProbe): Omit<PcapReport, 'moduleLoaded'> {
  if (platform === 'darwin') {
    const { permission, detail } = bpfAccess(fs)
    return { deviceCount: null, permission, permissionDetail: detail }
  }
  const detail =
    platform === 'win32'
      ? 'Npcap is installed when the module loads; capture may still need administrator rights.'
      : 'Capture needs cap_net_raw,cap_net_admin on the Electron binary or root; not checked here.'
  return { deviceCount: null, permission: 'unknown', permissionDetail: detail }
}

/** Loads the native `cap` module and checks what the operating system allows. */
export function probePcap(
  load: () => CapModule,
  platform: NodeJS.Platform = process.platform,
  fs: FsProbe = realFs
): DiagnosticsInfo['pcap'] {
  const base = permissionFor(platform, fs)
  try {
    const cap = load()
    return { ...base, moduleLoaded: true, deviceCount: cap.Cap.deviceList().length }
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return { ...base, moduleLoaded: false, error: message, deviceCount: null }
  }
}

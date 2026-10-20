import type { DiagnosticsInfo } from '@shared/diagnostics'
import type { ProlinkMode } from '@shared/prolink'
import type { DeckId, DeviceInfo, SourceId, SourceState, TrackLoadState } from '@shared/types'

export type CheckStatus = 'ok' | 'problem' | 'warning' | 'unknown'

export interface CheckItem {
  id: 'cable' | 'subnet' | 'rekordbox' | 'usb' | 'permissions'
  title: string
  status: CheckStatus
  /** What was found. */
  detail: string
  /** What to do when it is not ok. */
  fix: string
}

export interface ChecklistInput {
  diagnostics: DiagnosticsInfo | null
  iface: string | null
  mode: ProlinkMode
  source: SourceId | null
  sourceState: SourceState
  devices: DeviceInfo[]
  trackStatus: Partial<Record<DeckId, { state: TrackLoadState; message?: string }>>
}

const toInt = (ip: string): number | null => {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return (
    (((parts[0] ?? 0) << 24) |
      ((parts[1] ?? 0) << 16) |
      ((parts[2] ?? 0) << 8) |
      (parts[3] ?? 0)) >>>
    0
  )
}

/** True when `ip` lies inside the network of `cidr` (e.g. `169.254.3.4/16`). */
export function sameSubnet(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/')
  const prefix = Number(bits)
  const a = toInt(ip)
  const b = toInt(base ?? '')
  if (a === null || b === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32)
    return false
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (a & mask) === (b & mask)
}

const item = (
  id: CheckItem['id'],
  title: string,
  status: CheckStatus,
  detail: string,
  fix: string
): CheckItem => ({ id, title, status, detail, fix })

function cable(input: ChecklistInput): CheckItem {
  const title = 'Cable and network interface'
  const fix =
    'Connect the AZ LAN port to this computer (or a switch) and pick that interface in Settings.'
  const d = input.diagnostics
  if (!d) return item('cable', title, 'unknown', 'Reading network interfaces...', fix)
  if (input.iface) {
    const found = d.interfaces.find((i) => i.name === input.iface)
    return found
      ? item('cable', title, 'ok', `${found.name} is up with ${found.address}.`, fix)
      : item(
          'cable',
          title,
          'problem',
          `${input.iface} has no IPv4 address (unplugged or link down).`,
          fix
        )
  }
  if (d.interfaces.length === 0) {
    return item('cable', title, 'problem', 'No network interface has an IPv4 address.', fix)
  }
  if (input.devices.length > 0) {
    const detail = `${input.devices.length} device(s) heard; the interface was chosen automatically.`
    return item('cable', title, 'ok', detail, fix)
  }
  return item(
    'cable',
    title,
    'warning',
    'No interface selected; the app picks an AlphaTheta one if it finds it.',
    fix
  )
}

function subnet(input: ChecklistInput): CheckItem {
  const title = 'Same subnet as the deck'
  const fix =
    'Give the computer an address in the deck network (the AZ uses link-local 169.254.x.x when no DHCP is present).'
  const ips = input.devices.flatMap((d) => (d.ip ? [d.ip] : []))
  const cidrs = (input.diagnostics?.interfaces ?? [])
    .filter((i) => !input.iface || i.name === input.iface)
    .map((i) => i.cidr)
  if (ips.length === 0)
    return item('subnet', title, 'unknown', 'No Pro DJ Link device heard yet.', fix)
  const outside = ips.filter((ip) => !cidrs.some((c) => sameSubnet(ip, c)))
  return outside.length === 0
    ? item('subnet', title, 'ok', `${ips.length} device(s) heard inside the interface subnet.`, fix)
    : item(
        'subnet',
        title,
        'problem',
        `${outside.join(', ')} is outside the interface subnet.`,
        fix
      )
}

function rekordbox(input: ChecklistInput): CheckItem {
  const title = 'rekordbox not running on this computer'
  const fix =
    'Quit rekordbox. Active mode needs UDP 50000-50002, which rekordbox holds; passive mode works but the XDJ-XZ then sends no deck status.'
  const running = input.diagnostics?.rekordbox
  if (input.diagnostics === null)
    return item('rekordbox', title, 'unknown', 'Checking processes...', fix)
  if (!running) return item('rekordbox', title, 'ok', 'No rekordbox process found.', fix)
  const status = input.mode === 'passive' ? 'warning' : 'problem'
  return item('rekordbox', title, status, `${running} is running (mode: ${input.mode}).`, fix)
}

function usb(input: ChecklistInput): CheckItem {
  const title = 'USB stick exported by rekordbox'
  const fix =
    'Export the stick from rekordbox (Export mode), plug it into the deck and load a track from it.'
  const states = Object.values(input.trackStatus)
  if (states.some((s) => s.state === 'ready'))
    return item('usb', title, 'ok', 'Track metadata was read from the stick.', fix)
  const bad = states.find((s) => s.state === 'unavailable')
  if (bad)
    return item('usb', title, 'problem', bad.message ?? 'Track metadata is unavailable.', fix)
  if (states.some((s) => s.state === 'loading'))
    return item('usb', title, 'unknown', 'Reading track metadata...', fix)
  return item('usb', title, 'unknown', 'No track loaded yet, so this cannot be checked.', fix)
}

function permissions(input: ChecklistInput): CheckItem {
  const title = 'Capture permissions'
  const fix =
    'macOS: brew install --cask wireshark-chmodbpf, then log out and in (or, until reboot, sudo chmod o+rw /dev/bpf*). Windows: install Npcap. Linux: setcap on the Electron binary.'
  const pcap = input.diagnostics?.pcap
  if (input.sourceState === 'permissionDenied') {
    return item('permissions', title, 'problem', 'The source reported permission denied.', fix)
  }
  if (!pcap) return item('permissions', title, 'unknown', 'Probing pcap...', fix)
  if (!pcap.moduleLoaded) {
    return item(
      'permissions',
      title,
      'problem',
      `The pcap module did not load: ${pcap.error ?? 'unknown error'}.`,
      fix
    )
  }
  if (pcap.permission === 'denied') {
    const detail =
      input.mode === 'passive'
        ? pcap.permissionDetail
        : `${pcap.permissionDetail} Only the packet inspector needs it in ${input.mode} mode.`
    return item('permissions', title, input.mode === 'passive' ? 'problem' : 'warning', detail, fix)
  }
  return pcap.permission === 'ok'
    ? item('permissions', title, 'ok', pcap.permissionDetail, fix)
    : item('permissions', title, 'warning', pcap.permissionDetail, fix)
}

/** The first-run checks, each judged from what is known right now. */
export function evaluateChecklist(input: ChecklistInput): CheckItem[] {
  return [cable(input), subnet(input), rekordbox(input), usb(input), permissions(input)]
}

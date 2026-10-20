import { execFile } from 'node:child_process'
import type { SourceState } from '@shared/types'

export type ProlinkFailureKind =
  'permissionDenied' | 'rekordboxConflict' | 'pcapUnavailable' | 'noInterface' | 'other'

export class ProlinkError extends Error {
  constructor(
    readonly kind: ProlinkFailureKind,
    message: string
  ) {
    super(message)
  }

  /** Permission and missing-pcap problems cannot fix themselves, so retrying is pointless. */
  get retryable(): boolean {
    return this.kind !== 'permissionDenied' && this.kind !== 'pcapUnavailable'
  }

  get sourceState(): SourceState {
    return this.kind === 'permissionDenied' || this.kind === 'rekordboxConflict'
      ? this.kind
      : 'error'
  }
}

const PERMISSION_HELP: Partial<Record<NodeJS.Platform, string>> = {
  darwin:
    'On macOS give your user access to /dev/bpf*: run "brew install --cask wireshark-chmodbpf" and log out and in, or until the next reboot run "sudo chmod o+rw /dev/bpf*". Starting the app with sudo also works.',
  win32: 'On Windows install Npcap and run the app as administrator if capture still fails.',
  linux:
    'On Linux grant capture capabilities to the Electron binary: sudo setcap cap_net_raw,cap_net_admin=eip <path to electron>.'
}

function text(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function classifyError(
  error: unknown,
  platform: NodeJS.Platform = process.platform
): ProlinkError {
  if (error instanceof ProlinkError) return error
  const message = text(error)
  const code = (error as { code?: string } | null)?.code
  if (code === 'EADDRINUSE' || /EADDRINUSE|address already in use/i.test(message)) {
    return new ProlinkError(
      'rekordboxConflict',
      'UDP ports 50000-50002 are already in use. rekordbox (or another Pro DJ Link program) is probably running on this computer: quit it, or use passive mode.'
    )
  }
  if (/permission|not permitted|EPERM|EACCES|access denied/i.test(message)) {
    return new ProlinkError(
      'permissionDenied',
      `Not allowed to capture packets. ${PERMISSION_HELP[platform] ?? ''}`.trim()
    )
  }
  if (
    /Cannot find module|wpcap|dlopen|NODE_MODULE_VERSION|was compiled against|Module did not self-register/i.test(
      message
    )
  ) {
    return new ProlinkError(
      'pcapUnavailable',
      `The native pcap module could not be loaded (${message.split('\n')[0]}). Run "npm run rebuild" and, on Windows, install Npcap.`
    )
  }
  if (/no such device|doesn't exist|does not exist|no suitable device/i.test(message)) {
    return new ProlinkError('noInterface', `Network interface not available: ${message}`)
  }
  return new ProlinkError('other', message)
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 3000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) =>
      resolve(error ? '' : stdout)
    )
  })
}

/** Name of a running rekordbox process on this computer, if any. */
export async function findRekordboxProcess(
  platform: NodeJS.Platform = process.platform
): Promise<string | null> {
  const output =
    platform === 'win32'
      ? await run('tasklist', ['/FO', 'CSV', '/NH'])
      : await run('ps', ['-A', '-o', 'comm='])
  const line = output.split('\n').find((l) => /rekordbox/i.test(l))
  return line ? line.trim() : null
}

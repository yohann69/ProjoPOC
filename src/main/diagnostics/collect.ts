import { networkInterfaces, release } from 'node:os'
import type { DiagnosticsInfo } from '@shared/diagnostics'
import type { CapModule } from '../sources/prolink/capTypes'
import type { ErrorLog } from './errorLog'
import { probePcap } from './pcapProbe'

export interface DiagnosticsDeps {
  name: string
  version: string
  userData: string
  logFile: () => string | null
  errors: ErrorLog
  loadCap: () => CapModule
  findRekordbox: () => Promise<string | null>
  interfaces?: () => ReturnType<typeof networkInterfaces>
  versions?: NodeJS.ProcessVersions
  platform?: NodeJS.Platform
}

/** Non-internal IPv4 interfaces. */
export function listIpv4(all: ReturnType<typeof networkInterfaces>): DiagnosticsInfo['interfaces'] {
  return Object.entries(all).flatMap(([name, infos]) =>
    (infos ?? [])
      .filter((i) => i.family === 'IPv4' && !i.internal)
      .map((i) => ({ name, address: i.address, cidr: i.cidr ?? i.address }))
  )
}

export async function collectDiagnostics(deps: DiagnosticsDeps): Promise<DiagnosticsInfo> {
  const versions = deps.versions ?? process.versions
  const platform = deps.platform ?? process.platform
  return {
    app: {
      name: deps.name,
      version: deps.version,
      platform,
      arch: process.arch,
      osRelease: release(),
      electron: versions.electron ?? 'n/a',
      node: versions.node,
      chrome: versions.chrome ?? 'n/a',
      userData: deps.userData,
      logFile: deps.logFile()
    },
    pcap: probePcap(deps.loadCap, platform),
    interfaces: listIpv4((deps.interfaces ?? networkInterfaces)()),
    rekordbox: await deps.findRekordbox(),
    errors: deps.errors.list()
  }
}

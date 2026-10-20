export interface DiagnosticError {
  ts: number
  origin: 'main' | 'renderer' | 'source'
  message: string
}

export type PcapPermission = 'ok' | 'denied' | 'unknown'

export interface DiagnosticsInfo {
  app: {
    name: string
    version: string
    platform: string
    arch: string
    osRelease: string
    electron: string
    node: string
    chrome: string
    userData: string
    logFile: string | null
  }
  pcap: {
    moduleLoaded: boolean
    /** Why the module did not load. */
    error?: string
    /** Capture devices libpcap lists; null when the module is not loaded. */
    deviceCount: number | null
    permission: PcapPermission
    permissionDetail: string
  }
  /** Non-internal IPv4 interfaces, with `cidr` for subnet checks. */
  interfaces: { name: string; address: string; cidr: string }[]
  /** Name of a rekordbox process running on this computer, if any. */
  rekordbox: string | null
  /** Newest last. */
  errors: DiagnosticError[]
}

export interface RendererErrorReport {
  message: string
  stack?: string
  componentStack?: string
}

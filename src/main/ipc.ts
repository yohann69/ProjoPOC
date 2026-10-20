import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { DiagnosticsInfo } from '@shared/diagnostics'
import { IPC } from '@shared/ipc'
import type { ErrorLog } from './diagnostics/errorLog'
import { log } from './logger'
import { listInterfaceInfos, testConnection } from './networkInterfaces'
import { requestMicAccess } from './permissions'
import type { SettingsStore } from './settingsStore'
import type { SourceManager } from './sourceManager'
import { PcapCapture } from './sources/prolink/capture'
import { loadLibrary } from './sources/prolink/library'
import type { MidiMappingStore } from './usb/midiMappingStore'
import {
  parseBoolean,
  parseHookRequest,
  parseInterfaceName,
  parseSettings,
  parseSourceId,
  parseStartRequest
} from './validate'
import { parseIngest, parseMidiLog, parseMidiMapping } from './validateOptional'
import { parseRendererError } from './validateUi'

export interface IpcExtras {
  diagnostics: () => Promise<DiagnosticsInfo>
  errors: ErrorLog
  recordDir: string
}

export function registerIpc(
  manager: SourceManager,
  settings: SettingsStore,
  mapping: MidiMappingStore,
  extras: IpcExtras
): void {
  ipcMain.handle(IPC.startSource, (_event, request: unknown) =>
    manager.start(parseStartRequest(request))
  )
  ipcMain.handle(IPC.stopSource, (_event, id: unknown) => manager.stop(parseSourceId(id)))
  ipcMain.handle(IPC.listInterfaces, () => listInterfaceInfos(loadLibrary))
  ipcMain.handle(IPC.testConnection, (_event, iface: unknown) =>
    testConnection(parseInterfaceName(iface), {
      loadLibrary,
      createCapture: (name) => new PcapCapture(name)
    })
  )
  ipcMain.handle(IPC.getSettings, () => settings.load())
  ipcMain.handle(IPC.saveSettings, (_event, value: unknown) => settings.save(parseSettings(value)))
  ipcMain.handle(IPC.setPacketLog, (_event, enabled: unknown) =>
    manager.setPacketLog(parseBoolean(enabled))
  )
  ipcMain.handle(IPC.setHooks, (_event, request: unknown) =>
    manager.setHooks(parseHookRequest(request))
  )
  ipcMain.on(IPC.ingest, (_event, events: unknown) => {
    try {
      manager.ingest(parseIngest(events))
    } catch {
      // Malformed batches from the renderer are dropped.
    }
  })
  ipcMain.on(IPC.logMidi, (_event, entries: unknown) => {
    try {
      manager.logMidi(parseMidiLog(entries))
    } catch {
      // Malformed batches from the renderer are dropped.
    }
  })
  ipcMain.handle(IPC.getMidiMapping, () => mapping.load())
  ipcMain.handle(IPC.saveMidiMapping, (_event, value: unknown) =>
    mapping.save(parseMidiMapping(value))
  )
  ipcMain.handle(IPC.setMidiLog, (_event, enabled: unknown) =>
    manager.setMidiLog(parseBoolean(enabled))
  )
  ipcMain.handle(IPC.requestMicAccess, () => requestMicAccess())
  ipcMain.handle(IPC.getDiagnostics, () => extras.diagnostics())
  ipcMain.on(IPC.logRenderer, (_event, value: unknown) => {
    try {
      const report = parseRendererError(value)
      log.error('[renderer]', report.message, report.stack ?? '', report.componentStack ?? '')
      extras.errors.add('renderer', report.message)
    } catch {
      // Malformed reports from the renderer are dropped.
    }
  })
  ipcMain.handle(IPC.setRecording, (_event, enabled: unknown) =>
    manager.setRecording(parseBoolean(enabled))
  )
  ipcMain.handle(IPC.chooseRecording, async (event) => {
    const options = {
      title: 'Choose a DeckPulse recording',
      defaultPath: extras.recordDir,
      properties: ['openFile' as const],
      filters: [{ name: 'DeckPulse recording', extensions: ['jsonl'] }]
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
}

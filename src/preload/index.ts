import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type DeckPulseApi } from '@shared/ipc'
import type { AppEvent } from '@shared/types'

const api: DeckPulseApi = {
  onEvent(listener) {
    const handler = (_event: IpcRendererEvent, appEvent: AppEvent): void => listener(appEvent)
    ipcRenderer.on(IPC.event, handler)
    return () => {
      ipcRenderer.removeListener(IPC.event, handler)
    }
  },
  startSource: (request) => ipcRenderer.invoke(IPC.startSource, request),
  stopSource: (source) => ipcRenderer.invoke(IPC.stopSource, source),
  listInterfaces: () => ipcRenderer.invoke(IPC.listInterfaces),
  testConnection: (iface) => ipcRenderer.invoke(IPC.testConnection, iface),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.saveSettings, settings),
  setPacketLog: (enabled) => ipcRenderer.invoke(IPC.setPacketLog, enabled),
  setHookBroadcast: (request) => ipcRenderer.invoke(IPC.setHooks, request),
  ingest: (events) => ipcRenderer.send(IPC.ingest, events),
  getMidiMapping: () => ipcRenderer.invoke(IPC.getMidiMapping),
  saveMidiMapping: (mapping) => ipcRenderer.invoke(IPC.saveMidiMapping, mapping),
  setMidiLog: (enabled) => ipcRenderer.invoke(IPC.setMidiLog, enabled),
  logMidi: (entries) => ipcRenderer.send(IPC.logMidi, entries),
  requestMicAccess: () => ipcRenderer.invoke(IPC.requestMicAccess),
  getDiagnostics: () => ipcRenderer.invoke(IPC.getDiagnostics),
  logRenderer: (report) => ipcRenderer.send(IPC.logRenderer, report),
  setRecording: (enabled) => ipcRenderer.invoke(IPC.setRecording, enabled),
  chooseRecording: () => ipcRenderer.invoke(IPC.chooseRecording)
}

contextBridge.exposeInMainWorld('deckpulse', api)

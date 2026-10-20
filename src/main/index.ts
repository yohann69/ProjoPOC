import { join } from 'node:path'
import { app, BrowserWindow, screen, session } from 'electron'
import Store from 'electron-store'
import { IPC } from '@shared/ipc'
import { collectDiagnostics } from './diagnostics/collect'
import { ErrorLog } from './diagnostics/errorLog'
import { registerIpc } from './ipc'
import { initLogging, log, logFilePath } from './logger'
import { installPermissionHandlers } from './permissions'
import { SettingsStore } from './settingsStore'
import { SourceManager } from './sourceManager'
import { loadCap } from './sources/prolink/capTypes'
import { findRekordboxProcess } from './sources/prolink/errors'
import { MidiMappingStore } from './usb/midiMappingStore'
import { persistBounds, sanitizeBounds } from './windowState'

const errors = new ErrorLog()
initLogging(errors)

function createWindow(store: Store<Record<string, unknown>>): BrowserWindow {
  const bounds = sanitizeBounds(
    store.get('window'),
    screen.getAllDisplays().map((d) => d.workArea)
  )
  const win = new BrowserWindow({
    ...bounds,
    show: false,
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Audio analysis runs on a timer in the renderer and must not slow down behind other windows.
      backgroundThrottling: false
    }
  })
  win.once('ready-to-show', () => win.show())
  persistBounds(win, store)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('[renderer] process gone:', details.reason, details.exitCode)
    errors.add('renderer', `renderer process gone: ${details.reason}`)
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

void app.whenReady().then(() => {
  log.info(`DeckPulse ${app.getVersion()} starting on ${process.platform} ${process.arch}`)
  installPermissionHandlers(session.defaultSession)
  const store = new Store<Record<string, unknown>>({ name: 'settings', clearInvalidConfig: true })
  const win = createWindow(store)
  const userData = app.getPath('userData')
  const recordDir = join(userData, 'recordings')
  const manager = new SourceManager(
    (event) => {
      if (!win.isDestroyed()) win.webContents.send(IPC.event, event)
    },
    { logDir: join(userData, 'packet-logs'), recordDir, errors }
  )
  registerIpc(
    manager,
    new SettingsStore(store),
    new MidiMappingStore(join(userData, 'midi-mapping.json')),
    {
      errors,
      recordDir,
      diagnostics: () =>
        collectDiagnostics({
          name: app.getName(),
          version: app.getVersion(),
          userData,
          logFile: logFilePath,
          errors,
          loadCap,
          findRekordbox: () => findRekordboxProcess()
        })
    }
  )
  win.on('closed', () => void manager.dispose())
})

app.on('child-process-gone', (_event, details) => {
  log.error('[child process] gone:', details.type, details.reason)
  errors.add('main', `${details.type} process gone: ${details.reason}`)
})

app.on('window-all-closed', () => app.quit())

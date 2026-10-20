import type { BrowserWindow } from 'electron'
import type { KeyValueStore } from './settingsStore'

export interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

export const DEFAULT_BOUNDS: WindowBounds = { width: 1200, height: 800 }
const MIN_SIZE = 640
const MAX_SIZE = 10_000

interface Area {
  x: number
  y: number
  width: number
  height: number
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** Saved bounds, with the position dropped when no screen shows it any more. */
export function sanitizeBounds(raw: unknown, areas: Area[]): WindowBounds {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const { width, height, x, y } = r
  if (!isInt(width) || !isInt(height)) return DEFAULT_BOUNDS
  const size = {
    width: Math.min(MAX_SIZE, Math.max(MIN_SIZE, width)),
    height: Math.min(MAX_SIZE, Math.max(MIN_SIZE, height))
  }
  if (!isInt(x) || !isInt(y)) return size
  const visible = areas.some(
    (a) => x >= a.x && x < a.x + a.width - 100 && y >= a.y && y < a.y + a.height - 100
  )
  return visible ? { ...size, x, y } : size
}

/** Debounced save of the window position and size into the settings file. */
export function persistBounds(win: BrowserWindow, store: KeyValueStore, delayMs = 500): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = (): void => {
    clearTimeout(timer)
    timer = undefined
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
    store.set('window', win.getNormalBounds())
  }
  const schedule = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, delayMs)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('close', save)
}

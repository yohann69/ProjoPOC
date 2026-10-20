import { create } from 'zustand'
import { emptyUsb, foldUsb, type UsbState } from '../lib/usbStats'
import type { Received } from './useMidiStore'

interface UsbStore {
  usb: UsbState
  push(rows: Received[], now: number): void
  clear(): void
}

/** Statistics over every MIDI message of every port, kept apart from the explorer's filtered stream. */
export const useUsbStore = create<UsbStore>((set) => ({
  usb: emptyUsb(),
  push: (rows, now) => set((s) => ({ usb: foldUsb(s.usb, rows, now) })),
  clear: () => set({ usb: emptyUsb() })
}))

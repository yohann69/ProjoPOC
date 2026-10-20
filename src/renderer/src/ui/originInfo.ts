import type { Origin } from '@shared/types'

export interface OriginInfo {
  label: string
  description: string
  /** Badge classes: dark tinted background with a light text color for contrast. */
  classes: string
  /** Hex color for canvas drawing. */
  color: string
}

export const ORIGIN_INFO: Record<Origin, OriginInfo> = {
  ETH_LIVE: {
    label: 'ETH LIVE',
    description: 'Real-time Pro DJ Link packets over Ethernet',
    classes: 'border-emerald-700 bg-emerald-950 text-emerald-300',
    color: '#34d399'
  },
  ETH_LIBRARY: {
    label: 'ETH LIBRARY',
    description: 'Metadata read from the rekordbox USB stick through the network',
    classes: 'border-sky-700 bg-sky-950 text-sky-300',
    color: '#38bdf8'
  },
  USBC: {
    label: 'USB-C',
    description: 'Computer-control USB-C port (MIDI / HID / audio)',
    classes: 'border-amber-700 bg-amber-950 text-amber-300',
    color: '#fbbf24'
  },
  DERIVED: {
    label: 'DERIVED',
    description: 'Computed by DeckPulse from other values',
    classes: 'border-violet-700 bg-violet-950 text-violet-300',
    color: '#a78bfa'
  }
}

export const ORIGINS: readonly Origin[] = ['ETH_LIVE', 'ETH_LIBRARY', 'USBC', 'DERIVED']

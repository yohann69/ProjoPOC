export const ADJECTIVES = [
  'Midnight',
  'Neon',
  'Velvet',
  'Electric',
  'Golden',
  'Hollow',
  'Crystal',
  'Static',
  'Lunar',
  'Rapid'
] as const

export const NOUNS = [
  'Echoes',
  'Skyline',
  'Pulse',
  'Horizon',
  'Voltage',
  'Mirage',
  'Circuit',
  'Gravity',
  'Rhythm',
  'Signal'
] as const

export const ARTISTS = [
  'Nova Kline',
  'Hexa Drift',
  'Mara Voss',
  'The Low Orbit',
  'Kito Arai',
  'Sable & Rue',
  'Deep Cartel',
  'Ivo Lund'
] as const

export const GENRES = ['House', 'Techno', 'Tech House', 'Progressive', 'Melodic House'] as const

export const CAMELOT_KEYS = Array.from({ length: 12 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat()

export const CUE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'] as const

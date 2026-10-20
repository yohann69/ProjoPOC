const MAJOR = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B']
const MINOR = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A']
const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export interface KeyDisplay {
  /** Key as stored in the track. */
  name: string
  /** Camelot code, or null when the key could not be read. */
  camelot: string | null
}

/** Accepts Camelot codes (`8A`) and musical names (`Am`, `F#m`, `Bb`, `C minor`). */
export function keyDisplay(key: string): KeyDisplay {
  const name = key.trim()
  const camelot = /^(1[0-2]|[1-9])([AB])$/i.exec(name)
  if (camelot) return { name, camelot: `${camelot[1]}${camelot[2]?.toUpperCase()}` }
  const music = /^([A-Ga-g])([#b\u266f\u266d]?)\s*(m|min|minor|maj|major)?$/.exec(name)
  if (!music) return { name, camelot: null }
  const base = PITCH_CLASS[music[1]!.toUpperCase()]
  if (base === undefined) return { name, camelot: null }
  const accidental = music[2] === '#' || music[2] === '\u266f' ? 1 : music[2] ? -1 : 0
  const pitchClass = (base + accidental + 12) % 12
  const minor = music[3] === 'm' || music[3] === 'min' || music[3] === 'minor'
  return { name, camelot: (minor ? MINOR : MAJOR)[pitchClass] ?? null }
}

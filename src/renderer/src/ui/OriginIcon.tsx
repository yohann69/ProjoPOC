import type { Origin } from '@shared/types'

/** One distinct glyph per origin so the badge reads without relying on color. */
export function OriginIcon({ origin }: { origin: Origin }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 12 12',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }
  switch (origin) {
    case 'ETH_LIVE':
      return (
        <svg {...common}>
          <path d="M7 1 2.5 7H6l-1 4L9.5 5H6z" />
        </svg>
      )
    case 'ETH_LIBRARY':
      return (
        <svg {...common}>
          <ellipse cx="6" cy="3" rx="4" ry="1.7" />
          <path d="M2 3v6c0 .9 1.8 1.7 4 1.7s4-.8 4-1.7V3M2 6c0 .9 1.8 1.7 4 1.7S10 6.900 10 6" />
        </svg>
      )
    case 'USBC':
      return (
        <svg {...common}>
          <rect x="1.5" y="4" width="9" height="4" rx="2" />
          <path d="M4 6h4" />
        </svg>
      )
    case 'DERIVED':
      return (
        <svg {...common}>
          <path d="M9 2H7.500C6.600 2 6 2.600 5.800 3.500L4.800 8.500C4.600 9.400 4 10 3.100 10H2M3 6h5" />
        </svg>
      )
  }
}

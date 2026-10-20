/// <reference types="vite/client" />
import type { DeckPulseApi } from '@shared/ipc'

declare global {
  interface Window {
    deckpulse: DeckPulseApi
  }
}

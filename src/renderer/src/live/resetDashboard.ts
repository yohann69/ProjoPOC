import { useDeckStore } from '../store/useDeckStore'
import { useDataStore } from '../store/useDataStore'
import { useHookStore } from '../store/useHookStore'
import { useLiveStore } from '../store/useLiveStore'
import { resetLive } from './liveData'

/** Clears everything shown for the previous source run. */
export function resetDashboard(): void {
  resetLive()
  useDeckStore.getState().reset()
  useDataStore.getState().reset()
  useHookStore.getState().clear()
  useLiveStore.getState().reset()
}

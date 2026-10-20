import type { TransitionSignalName } from '@shared/transition'
import { LIVE_STATES } from '../../live/liveData'
import { mixerLive } from '../../live/mixerLive'
import { useAudioStore } from '../../store/useAudioStore'
import { useDeckStore } from '../../store/useDeckStore'
import { useLiveStore } from '../../store/useLiveStore'

/** Which transition signals have a source delivering data right now. */
export function useSignalAvailability(): Record<TransitionSignalName, boolean> {
  const source = useLiveStore((s) => s.source)
  const state = useLiveStore((s) => s.sourceState)
  const hasDecks = useDeckStore((s) => Object.keys(s.decks).length > 0)
  const audio = useAudioStore((s) => s.status === 'running')
  const decks =
    (source === 'simulator' || source === 'prolink') && LIVE_STATES.includes(state) && hasDecks
  const mixer = mixerLive.usbc !== null || mixerLive.primary !== null
  return {
    masterChange: decks,
    overlap: decks,
    onAir: decks,
    bpmSync: decks,
    fader: mixer,
    audio
  }
}

import { useEffect } from 'react'
import { epochNow } from '../../lib/frameLoop'
import { sampleBpm } from '../../live/bpmHistory'
import { deckLive } from '../../live/liveData'

/** Samples every deck's tempo once a second into the five-minute history, whichever tab is open. */
export function useBpmSampler(): void {
  useEffect(() => {
    const timer = setInterval(() => {
      sampleBpm(epochNow(), {
        1: deckLive[1].playing ? deckLive[1].bpm : null,
        2: deckLive[2].playing ? deckLive[2].bpm : null,
        3: deckLive[3].playing ? deckLive[3].bpm : null,
        4: deckLive[4].playing ? deckLive[4].bpm : null
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])
}

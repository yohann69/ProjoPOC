import type { AppEvent } from '@shared/types'
import { useEffect } from 'react'
import { applyLive } from '../../live/liveData'
import { resetDashboard } from '../../live/resetDashboard'
import { useDeckStore } from '../../store/useDeckStore'
import { useDataStore } from '../../store/useDataStore'
import { useEventStore } from '../../store/useEventStore'
import { useHookStore } from '../../store/useHookStore'
import { useLiveStore } from '../../store/useLiveStore'

const FLUSH_MS = 50

function dispatch(batch: AppEvent[]): void {
  if (batch.length === 0) return
  applyLive(batch)
  useDeckStore.getState().apply(batch)
  useDataStore.getState().apply(batch)
  useHookStore.getState().apply(batch)
  useEventStore.getState().push(batch)
  useLiveStore.getState().apply(batch)
}

/** Applies a batch, clearing the dashboard first whenever a different source starts reporting. */
export function dispatchBatch(batch: AppEvent[]): void {
  let current = useLiveStore.getState().source
  let from = 0
  batch.forEach((event, i) => {
    if (event.type !== 'sourceStatus') return
    if (event.state !== 'stopped' && event.source !== current) {
      dispatch(batch.slice(from, i))
      resetDashboard()
      from = i
    }
    current = event.source
  })
  dispatch(batch.slice(from))
}

/** Hands main-process events to the stores in batches; a timer, because rAF stops in hidden windows. */
export function useEventBridge(): void {
  useEffect(() => {
    let buffer: AppEvent[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = (): void => {
      timer = undefined
      const batch = buffer
      buffer = []
      dispatchBatch(batch)
    }
    const unsubscribe = window.deckpulse.onEvent((event) => {
      buffer.push(event)
      timer ??= setTimeout(flush, FLUSH_MS)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [])
}

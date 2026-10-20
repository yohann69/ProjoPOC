import type { IngestEvent } from '@shared/usb'
import { bandLevels, rmsOf } from '../../lib/audio/bands'
import { DropDetector } from '../../lib/audio/drop'
import { OnsetDetector, SpectralFlux } from '../../lib/audio/flux'
import { epochNow } from '../../lib/frameLoop'
import { audioLive, resetAudioLive } from '../../live/audioLive'
import { useAudioStore, type AudioStatus } from '../../store/useAudioStore'
import { useSettingsStore } from '../../store/useSettingsStore'

const INTERVAL_MS = 25
const ENERGY_EVERY_MS = 100
const ONSET_WINDOW_MS = 10_000

interface Running {
  ctx: AudioContext
  stream: MediaStream
  analyser: AnalyserNode
  freq: Float32Array<ArrayBuffer>
  time: Float32Array<ArrayBuffer>
  timer: ReturnType<typeof setInterval>
}

let running: Running | null = null
let lastEnergy = 0
const flux = new SpectralFlux()
const onsets = new OnsetDetector()
const drops = new DropDetector()

export async function refreshAudioDevices(): Promise<void> {
  const all = await navigator.mediaDevices.enumerateDevices()
  const inputs = all.filter((d) => d.kind === 'audioinput')
  const devices = inputs.map((d, i) => ({
    id: d.deviceId,
    label: d.label || `Audio input ${i + 1}`
  }))
  useAudioStore.getState().setDevices(
    devices,
    inputs.some((d) => d.label !== '')
  )
}

function failure(error: unknown): { status: AudioStatus; message: string } {
  const name = error instanceof DOMException ? error.name : ''
  const detail = error instanceof Error ? error.message : 'unknown error'
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { status: 'denied', message: 'Audio input was refused.' }
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { status: 'noDevice', message: 'The chosen audio input is not available.' }
  }
  return { status: 'error', message: detail }
}

function tick(): void {
  const r = running
  if (!r) return
  r.analyser.getFloatFrequencyData(r.freq)
  r.analyser.getFloatTimeDomainData(r.time)
  const ts = epochNow()
  const rms = rmsOf(r.time)
  const bands = bandLevels(r.freq, r.ctx.sampleRate)
  Object.assign(audioLive, {
    spectrum: r.freq,
    sampleRate: r.ctx.sampleRate,
    bands,
    rms,
    lastTs: ts
  })
  const events: IngestEvent[] = []
  const store = useAudioStore.getState()

  const onset = onsets.step(flux.step(r.freq, r.ctx.sampleRate), ts, rms)
  if (onset) {
    events.push({ kind: 'onset', ts: onset.ts, strength: onset.strength })
    audioLive.onsetTs = onset.ts
    audioLive.onsetStrength = onset.strength
    audioLive.onsetTimes = [
      ...audioLive.onsetTimes.filter((t) => ts - t < ONSET_WINDOW_MS),
      onset.ts
    ]
  }
  const phase = drops.step(ts, bands)
  if (phase) {
    events.push({ kind: 'drop', ts, phase })
    store.mark(phase, ts)
  }
  if (store.phase === 'buildup' && !drops.inBuildup) store.setPhase('idle')
  else if (phase === 'buildup') store.setPhase('buildup')
  if (ts - lastEnergy >= ENERGY_EVERY_MS) {
    lastEnergy = ts
    events.push({ kind: 'energy', ts, rms: Math.min(1, rms), bands })
  }
  if (events.length > 0) window.deckpulse.ingest(events)
}

export function stopAudio(): void {
  if (running) {
    clearInterval(running.timer)
    running.stream.getTracks().forEach((t) => t.stop())
    void running.ctx.close()
    running = null
  }
  flux.reset()
  onsets.reset()
  drops.reset()
  resetAudioLive()
  const store = useAudioStore.getState()
  store.setPhase('idle')
  store.setStatus('idle')
}

/** Opens the chosen input (or the default) and starts analysing; nothing is played back. */
export async function startAudio(deviceId: string | null): Promise<void> {
  stopAudio()
  const store = useAudioStore.getState()
  store.setStatus('requesting')
  const access = await window.deckpulse.requestMicAccess()
  if (!access.granted) {
    store.setStatus('denied', `Audio-input access is ${access.status} in the operating system.`)
    return
  }
  let stream: MediaStream | undefined
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0
    analyser.minDecibels = -100
    analyser.maxDecibels = -30
    ctx.createMediaStreamSource(stream).connect(analyser)
    await ctx.resume()
    const timer = setInterval(tick, INTERVAL_MS)
    running = {
      ctx,
      stream,
      analyser,
      freq: new Float32Array(analyser.frequencyBinCount),
      time: new Float32Array(analyser.fftSize),
      timer
    }
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      stopAudio()
      useAudioStore.getState().setStatus('noDevice', 'The audio input was disconnected.')
    })
    store.select(deviceId)
    useSettingsStore.getState().updateOptional({ audioDeviceId: deviceId })
    store.setStatus('running')
    await refreshAudioDevices()
  } catch (error) {
    stream?.getTracks().forEach((t) => t.stop())
    const { status, message } = failure(error)
    store.setStatus(status, message)
  }
}

/** Asks for access once so the browser reveals device names, then lists the inputs. */
export async function allowAudioAccess(): Promise<void> {
  const store = useAudioStore.getState()
  const access = await window.deckpulse.requestMicAccess()
  if (!access.granted) {
    store.setStatus('denied', `Audio-input access is ${access.status} in the operating system.`)
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    await refreshAudioDevices()
  } catch (error) {
    const { status, message } = failure(error)
    store.setStatus(status, message)
  }
}

export function watchAudioDevices(): () => void {
  const onChange = (): void => void refreshAudioDevices()
  navigator.mediaDevices.addEventListener('devicechange', onChange)
  return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
}

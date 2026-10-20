import { useEffect } from 'react'
import { useMappingStore } from '../../store/useMappingStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { refreshAudioDevices, startAudio, watchAudioDevices } from '../audio/audioEngine'
import { startMidi } from '../midi/midiEngine'

/** Loads saved mappings and resumes the optional sources the user used last time. */
export function useOptionalBootstrap(): void {
  const loaded = useSettingsStore((s) => s.loaded)
  useEffect(() => {
    void useMappingStore.getState().load()
    void refreshAudioDevices().catch(() => undefined)
    return watchAudioDevices()
  }, [])
  useEffect(() => {
    if (!loaded) return
    const { audioDeviceId } = useSettingsStore.getState().optional
    void startMidi()
    if (audioDeviceId) void startAudio(audioDeviceId)
  }, [loaded])
}

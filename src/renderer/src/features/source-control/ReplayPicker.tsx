import { useSettingsStore } from '../../store/useSettingsStore'

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path

/** Chooses the recording to replay, and whether it loops. */
export function ReplayPicker() {
  const replay = useSettingsStore((s) => s.replay)
  const update = useSettingsStore((s) => s.updateReplay)
  const choose = (): void => {
    void window.deckpulse.chooseRecording().then((path) => {
      if (path) update({ path })
    })
  }
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <button
        type="button"
        onClick={choose}
        className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100 outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-white"
      >
        Choose recording…
      </button>
      <span className="max-w-48 truncate" title={replay.path || undefined}>
        {replay.path ? fileName(replay.path) : 'none chosen'}
      </span>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={replay.loop}
          onChange={(e) => update({ loop: e.target.checked })}
        />
        Loop
      </label>
    </div>
  )
}

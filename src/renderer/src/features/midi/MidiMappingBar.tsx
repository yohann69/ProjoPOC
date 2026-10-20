import { parseMidiMapping } from '@shared/usbMapping'
import { useRef, useState } from 'react'
import { useMappingStore } from '../../store/useMappingStore'
import { useMidiStore } from '../../store/useMidiStore'
import { setMidiLogging } from './midiEngine'

const button =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-white outline-none'

/** Save, copy and import the mapping JSON, and toggle the raw-byte log. */
export function MidiMappingBar() {
  const dirty = useMappingStore((s) => s.dirty)
  const saveError = useMappingStore((s) => s.error)
  const count = useMappingStore((s) => Object.keys(s.entries).length)
  const logEnabled = useMidiStore((s) => s.logEnabled)
  const logPath = useMidiStore((s) => s.logPath)
  const [note, setNote] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const { save, replace, toMapping } = useMappingStore.getState()

  const copy = (): void => {
    navigator.clipboard
      .writeText(JSON.stringify(toMapping(), null, 2))
      .then(() => setNote('Mapping JSON copied.'))
      .catch(() => setNote('Copy was refused; use Save and read the file in the app data folder.'))
  }
  const importFile = async (chosen: File | undefined): Promise<void> => {
    if (!chosen) return
    try {
      replace(parseMidiMapping(JSON.parse(await chosen.text())))
      setNote('Mapping imported; press Save to keep it.')
    } catch (error) {
      setNote(`Import failed: ${error instanceof Error ? error.message : 'invalid file'}`)
    }
    if (file.current) file.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2 text-sm text-slate-300">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void save()} className={button}>
          Save mapping
        </button>
        <button type="button" onClick={copy} className={button}>
          Copy JSON
        </button>
        <button type="button" onClick={() => file.current?.click()} className={button}>
          Import JSON
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
        <span className="text-xs text-slate-400">
          {count} saved {count === 1 ? 'entry' : 'entries'}
          {dirty ? ', unsaved changes' : ''}
        </span>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={logEnabled}
          onChange={(e) => void setMidiLogging(e.target.checked)}
        />
        Write every message (raw bytes + decoded guess) to a JSONL file
      </label>
      {logEnabled && logPath && <p className="break-all text-xs text-slate-400">{logPath}</p>}
      {note && <p className="text-xs text-slate-300">{note}</p>}
      {saveError && <p className="text-xs text-red-400">{saveError}</p>}
    </div>
  )
}

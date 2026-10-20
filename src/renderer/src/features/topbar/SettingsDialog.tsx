import { useRef } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { NetworkSetup } from '../network-setup/NetworkSetup'
import { SimulatorControls } from '../source-control/SimulatorControls'

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-base text-slate-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-sky-400"
      />
      {label}
    </label>
  )
}

/** Settings button plus a native modal dialog: Esc closes it, Tab stays inside, focus returns to the button. */
export function SettingsDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  const dashboard = useSettingsStore((s) => s.dashboard)
  const update = useSettingsStore((s) => s.updateDashboard)
  const selected = useSettingsStore((s) => s.selected)
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-100 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-white"
      >
        Settings
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="settings-title"
        className="m-auto w-full max-w-xl rounded-xl border border-slate-600 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/70"
      >
        <form method="dialog" className="flex flex-col gap-5 p-6">
          <h2 id="settings-title" className="text-xl font-bold">
            Settings
          </h2>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300">
              Display
            </legend>
            <Toggle
              label="Show all four decks, including empty ones"
              checked={dashboard.showAllDecks}
              onChange={(showAllDecks) => update({ showAllDecks })}
            />
            <Toggle
              label="Reduce motion (no beat pulses, ring shows the beat number)"
              checked={dashboard.reduceMotion}
              onChange={(reduceMotion) => update({ reduceMotion })}
            />
          </fieldset>
          {selected === 'simulator' ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300">
                Simulator
              </legend>
              <SimulatorControls />
              <p className="text-xs text-slate-300">Applies the next time the simulator starts.</p>
            </fieldset>
          ) : selected === 'replay' ? (
            <p className="text-sm text-slate-300">
              Replay has no settings here: choose the recording and loop option in the top bar.
            </p>
          ) : (
            <NetworkSetup />
          )}
          <button
            type="submit"
            className="self-end rounded-md bg-sky-500 px-4 py-2 font-semibold text-slate-950 outline-none hover:bg-sky-400 focus-visible:ring-2 focus-visible:ring-white"
          >
            Close
          </button>
        </form>
      </dialog>
    </>
  )
}

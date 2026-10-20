import type { ReactNode } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { ChecklistList } from './ChecklistList'
import { useChecklist, useDiagnostics } from './useDiagnostics'

const button =
  'rounded border border-slate-500 px-3 py-1 text-sm font-semibold text-slate-100 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-white outline-none'

function Banner({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="First-run checklist"
      className="max-h-72 overflow-y-auto border-b border-slate-800 bg-slate-900 px-4 py-3"
    >
      {children}
    </section>
  )
}

/** Shown until dismissed, so a new user sees what the Ethernet source needs before it fails. */
export function FirstRunChecklist() {
  const loaded = useSettingsStore((s) => s.loaded)
  const dismissed = useSettingsStore((s) => s.ui.checklistDismissed)
  const updateUi = useSettingsStore((s) => s.updateUi)
  const { info } = useDiagnostics()
  const items = useChecklist(info)
  if (!loaded || dismissed) return null
  const open = items.filter((c) => c.status === 'problem' || c.status === 'warning').length
  return (
    <Banner>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-bold text-slate-50">First run: connecting to the deck</h2>
        <span className="text-xs text-slate-300">
          {open === 0 ? 'Nothing needs attention right now.' : `${open} item(s) need attention.`}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className={button}
            onClick={() => updateUi({ sideTab: 'diagnostics' })}
          >
            Open diagnostics
          </button>
          <button
            type="button"
            className={button}
            onClick={() => updateUi({ checklistDismissed: true })}
          >
            Dismiss
          </button>
        </div>
      </div>
      <ChecklistList items={items} />
    </Banner>
  )
}

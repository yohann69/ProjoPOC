import type { CheckItem, CheckStatus } from './checklist'

const MARKS: Record<CheckStatus, { mark: string; label: string; classes: string }> = {
  ok: { mark: '\u2713', label: 'OK', classes: 'border-emerald-500 text-emerald-200' },
  problem: { mark: '\u2715', label: 'Problem', classes: 'border-red-500 text-red-200' },
  warning: { mark: '!', label: 'Check', classes: 'border-amber-400 text-amber-200' },
  unknown: { mark: '?', label: 'Unknown', classes: 'border-slate-500 text-slate-300' }
}

/** One row per first-run check; the fix is shown whenever the check is not OK. */
export function ChecklistList({ items }: { items: CheckItem[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((c) => {
        const m = MARKS[c.status]
        return (
          <li key={c.id} className="flex gap-3 rounded border border-slate-800 p-2">
            <span
              className={`flex h-fit shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold ${m.classes}`}
            >
              <span aria-hidden="true">{m.mark}</span>
              {m.label}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className="font-semibold text-slate-100">{c.title}</span>
              <span className="text-slate-300">{c.detail}</span>
              {c.status !== 'ok' && <span className="text-xs text-slate-400">{c.fix}</span>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

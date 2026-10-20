import { useViewStore } from '../../store/useViewStore'

/** Switches between the dashboard and the view that lists every value read from Ethernet and USB-C. */
export function DataButton() {
  const open = useViewStore((s) => s.dataOpen)
  const setOpen = useViewStore((s) => s.setDataOpen)
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={() => setOpen(!open)}
      className={`rounded-md border px-3 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${
        open
          ? 'border-sky-400 bg-sky-700 text-white'
          : 'border-slate-600 text-slate-100 hover:bg-slate-800'
      }`}
    >
      {open ? 'Back to dashboard' : 'All data'}
    </button>
  )
}

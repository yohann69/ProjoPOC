import { useLiveStore } from '../../store/useLiveStore'

/** Shown while a recording plays, so replayed data cannot pass for live data. */
export function ReplayBanner() {
  const replaying = useLiveStore((s) => s.source === 'replay')
  const message = useLiveStore((s) => s.sourceMessage)
  if (!replaying) return null
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-1 bg-[repeating-linear-gradient(45deg,#38bdf8,#38bdf8_14px,#18181b_14px,#18181b_28px)] py-1"
    >
      <span className="rounded bg-slate-950 px-4 py-0.5 text-sm font-extrabold tracking-widest text-sky-300">
        REPLAY — RECORDED DATA, NOT LIVE
      </span>
      {message && <span className="rounded bg-slate-950 px-2 text-xs text-sky-200">{message}</span>}
    </div>
  )
}

import { useLiveStore } from '../../store/useLiveStore'

/** Shown whenever the data on screen comes from the simulator, so it cannot pass for real data. */
export function SimulatedBanner() {
  const simulated = useLiveStore((s) => s.source === 'simulator')
  if (!simulated) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 bg-[repeating-linear-gradient(45deg,#fbbf24,#fbbf24_14px,#18181b_14px,#18181b_28px)] py-1"
    >
      <span className="rounded bg-slate-950 px-4 py-0.5 text-sm font-extrabold tracking-widest text-amber-300">
        SIMULATED DATA — NOT FROM REAL HARDWARE
      </span>
    </div>
  )
}

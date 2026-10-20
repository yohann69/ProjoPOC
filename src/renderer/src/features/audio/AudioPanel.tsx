import { useAudioStore } from '../../store/useAudioStore'
import { OriginBadge } from '../../ui/OriginBadge'
import { Panel } from '../../ui/primitives'
import { AudioControls } from './AudioControls'
import { BandBars } from './BandBars'
import { SpectrumCanvas } from './SpectrumCanvas'

const MARK_TEXT = { buildup: 'Buildup started', drop: 'Drop' } as const

/** Live audio analysis; everything here is DERIVED and absent unless an input is running. */
export function AudioPanel() {
  const running = useAudioStore((s) => s.status === 'running')
  const phase = useAudioStore((s) => s.phase)
  const marks = useAudioStore((s) => s.marks)
  return (
    <Panel title="Audio analysis" badges={<OriginBadge origin="DERIVED" />}>
      <AudioControls />
      {running ? (
        <>
          <SpectrumCanvas />
          <BandBars />
          <p className="text-xs text-slate-300">
            State:{' '}
            <span className={phase === 'buildup' ? 'font-semibold text-amber-300' : ''}>
              {phase === 'buildup' ? 'buildup (bass out, highs rising)' : 'steady'}
            </span>
          </p>
          {marks.length > 0 && (
            <ol className="flex flex-col gap-0.5 text-xs text-slate-200">
              {marks.map((m) => (
                <li key={m.id}>
                  {new Date(m.ts).toLocaleTimeString()} {MARK_TEXT[m.kind]}
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </Panel>
  )
}

import { PROLINK_MODES, PROLINK_MODE_LABELS, type ProlinkMode } from '@shared/prolink'
import { useEffect } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { ConnectionTest } from './ConnectionTest'
import { InterfacePicker } from './InterfacePicker'

const PERMISSION_NOTE =
  'Passive mode needs pcap: Npcap on Windows, access to /dev/bpf* on macOS, cap_net_raw on Linux.'

export function NetworkSetup() {
  const prolink = useSettingsStore((s) => s.prolink)
  const update = useSettingsStore((s) => s.updateProlink)
  const load = useSettingsStore((s) => s.load)
  useEffect(() => void load(), [load])

  return (
    <section className="flex flex-col gap-3 rounded border border-white/10 p-3">
      <h2 className="text-sm font-semibold text-white">Network setup</h2>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        Mode
        <select
          value={prolink.mode}
          onChange={(e) => update({ mode: e.target.value as ProlinkMode })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
        >
          {PROLINK_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {PROLINK_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      <InterfacePicker value={prolink.iface} onChange={(iface) => update({ iface })} />
      <ConnectionTest iface={prolink.iface} />
      <p className="text-xs text-slate-500">{PERMISSION_NOTE}</p>
    </section>
  )
}

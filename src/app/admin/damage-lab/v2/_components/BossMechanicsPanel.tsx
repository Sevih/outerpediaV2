'use client'

import type { BossMechanicState, BossOverride } from '@/lib/damage/v2/boss-overrides'

interface BossMechanicsPanelProps {
  /** null = panel hidden (selected target isn't a known boss). */
  override: BossOverride | null
  state: Record<string, BossMechanicState>
  onToggle: (id: string, active: boolean) => void
  onValueChange: (id: string, value: number) => void
}

/**
 * Boss-specific mechanics. Rendered as a `<fieldset>` (compact variant) so
 * it slots inside TargetPanel next to the pool-condition mechanics fieldset
 * without doubling card borders.
 */
export function BossMechanicsPanel({ override, state, onToggle, onValueChange }: BossMechanicsPanelProps) {
  if (!override) return null

  return (
    <fieldset className="space-y-1.5 rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Boss mechanics — <span className="text-zinc-100">{override.bossName}</span>
      </legend>
      <div className="space-y-1">
        {override.mechanics.map(m => {
          const s = state[m.id] ?? { active: false, value: m.defaultValue }
          return (
            <div key={m.id} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs">
              <input
                type="checkbox"
                checked={s.active}
                onChange={e => onToggle(m.id, e.target.checked)}
                className="h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-800"
              />
              <div className="flex-1">
                <div className={s.active ? 'text-zinc-200' : 'text-zinc-500'}>{m.label}</div>
                <div className="mt-0.5 text-[10px] text-zinc-600">{m.description}</div>
              </div>
              <span className="text-[10px] text-zinc-600">×</span>
              <input
                type="number"
                step="0.01"
                value={s.value}
                onChange={e => {
                  const n = parseFloat(e.target.value)
                  if (Number.isFinite(n)) onValueChange(m.id, n)
                }}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                suppressHydrationWarning
                className={`w-16 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs text-zinc-100 focus:border-blue-500 focus:outline-none ${
                  s.active ? '' : 'opacity-50'
                }`}
              />
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

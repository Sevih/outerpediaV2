'use client'

import type { BossMechanicState, BossOverride } from '@/lib/damage/v2/boss-overrides'

interface BossMechanicsPanelProps {
  /** null = panel hidden (selected target isn't a known boss). */
  override: BossOverride | null
  state: Record<string, BossMechanicState>
  onToggle: (id: string, active: boolean) => void
}

/**
 * Boss-specific mechanics. Rendered as a `<fieldset>` (compact variant) so
 * it slots inside TargetPanel next to the pool-condition mechanics fieldset
 * without doubling card borders.
 */
export function BossMechanicsPanel({ override, state, onToggle }: BossMechanicsPanelProps) {
  if (!override) return null

  return (
    <fieldset className="min-w-0 space-y-1.5 rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Boss mechanics
      </legend>
      <div className="space-y-1">
        {override.mechanics.map(m => {
          const s = state[m.id] ?? { active: false }
          // Description from the datamine extractor is a `\n`-joined list of
          // per-buff summaries. Render line-by-line so each buff's effect +
          // condition stays readable.
          const summaryLines = m.description ? m.description.split('\n') : []
          return (
            <label
              key={m.id}
              className="flex min-w-0 cursor-pointer items-start gap-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={s.active}
                onChange={e => onToggle(m.id, e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-800"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={s.active ? 'text-zinc-200' : 'text-zinc-500'}>{m.label}</span>
                  {m.kind === 'enrage' && (
                    <span className="rounded bg-red-900/60 px-1 py-px text-[9px] font-semibold uppercase text-red-200">
                      Enrage
                    </span>
                  )}
                </div>
                {summaryLines.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 text-[10px] text-zinc-500">
                    {summaryLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

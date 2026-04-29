'use client'

import type { CharFlags } from '@/lib/damage/v2/char-overrides'
import { getCharOverride } from '@/lib/damage/v2/char-overrides'
import type { CallerSlot } from '@/lib/damage/v2/buffs'

interface PerCharFlagsProps {
  charId: string
  slot: CallerSlot
  flags: CharFlags
  onChange: (flag: keyof CharFlags, value: boolean) => void
}

const FLAG_LABELS: Partial<Record<keyof CharFlags, string>> = {
  umeActive:    'Ume active (S3 cast on target HP > 90%)',
  sakuraActive: 'Sakura active (S3 cast on target HP < 90%)',
}

/**
 * Renders one toggle per flag the current `(charId, slot)` exposes via
 * `getCharOverride(...).conditionals`. Returns null when the char/slot has
 * no flag-gated override (most chars).
 */
export function PerCharFlags({ charId, slot, flags, onChange }: PerCharFlagsProps) {
  const override = getCharOverride(charId, slot)
  if (!override?.conditionals?.length) return null

  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Per-char flags
      </legend>
      <div className="space-y-1">
        {override.conditionals.map(cond => (
          <label key={cond.flag} className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!flags[cond.flag]}
              onChange={e => onChange(cond.flag, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800"
            />
            <span className="text-zinc-300">{FLAG_LABELS[cond.flag] ?? cond.flag}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

'use client'

import type { CharFlags } from '@/lib/damage/v2/char-overrides'
import { getCharOverride } from '@/lib/damage/v2/char-overrides'
import type { ApplicableBuff, CallerSlot } from '@/lib/damage/v2/buffs'

interface PerCharFlagsProps {
  charId: string
  slot: CallerSlot
  flags: CharFlags
  /**
   * Char-applicable buff list (already filtered upstream to the current
   * caster). Used to data-drive flag surfacing — e.g. when the current
   * char has a buff with `trigger.requires === 'resource'` we expose the
   * `ownerResourceMax` toggle automatically, no hardcoded char list.
   */
  buffs: ApplicableBuff[]
  onChange: (flag: keyof CharFlags, value: boolean) => void
}

const FLAG_LABELS: Partial<Record<keyof CharFlags, string>> = {
  umeActive:        'Ume active (S3 cast on target HP > 90%)',
  sakuraActive:     'Sakura active (S3 cast on target HP < 90%)',
  ownerResourceMax: 'Unique resource maxed (Noa: Kaizer Energy 5/5)',
}

/**
 * Renders one toggle per flag exposed for the current `(charId, slot)`.
 * Two sources feed the flag list:
 *
 *   1. `getCharOverride(charId, slot).conditionals[]` — hardcoded char-
 *      specific quirks (Ame Ume/Sakura). Each conditional declares a
 *      `flag: keyof CharFlags`.
 *   2. Data-driven scan of `buffs` for entries whose `trigger.requires`
 *      maps to a flag (currently `'resource' → ownerResourceMax`). Lets
 *      any char with `BuffConditionType: OWNER_RESOURCE` get a toggle
 *      automatically — no need to touch char-overrides for new chars.
 *
 * Returns null when neither source contributes a flag.
 */
export function PerCharFlags({ charId, slot, flags, buffs, onChange }: PerCharFlagsProps) {
  const override = getCharOverride(charId, slot)
  const flagsToShow: (keyof CharFlags)[] = []

  // (1) Hardcoded conditionals from char-overrides
  for (const cond of override?.conditionals ?? []) {
    if (!flagsToShow.includes(cond.flag)) flagsToShow.push(cond.flag)
  }

  // (2) Data-driven scan: any buff applicable to the current char/slot with
  // a flag-mappable trigger condition surfaces its flag. Buffs are already
  // pre-filtered to the current charId upstream; we just check the slot
  // gate and the requires kind.
  const slotFiltered = buffs.filter(b =>
    b.trigger.callerSlots === 'all' || b.trigger.callerSlots.includes(slot)
  )
  if (slotFiltered.some(b => b.trigger.requires === 'resource')) {
    if (!flagsToShow.includes('ownerResourceMax')) flagsToShow.push('ownerResourceMax')
  }

  if (flagsToShow.length === 0) return null

  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Per-char flags
      </legend>
      <div className="space-y-1">
        {flagsToShow.map(flag => (
          <label key={flag} className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!flags[flag]}
              onChange={e => onChange(flag, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800"
            />
            <span className="text-zinc-300">{FLAG_LABELS[flag] ?? flag}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

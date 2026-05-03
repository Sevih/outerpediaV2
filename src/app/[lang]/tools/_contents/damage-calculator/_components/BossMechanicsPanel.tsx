'use client'

import type { BossMechanicState, BossOverride } from '@/lib/damage/v2/boss-overrides'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { CalcAction } from '../_state/reducer'

interface Props {
  /** null = panel hidden (selected target has no damage-relevant passive). */
  override: BossOverride | null
  state: Record<string, BossMechanicState>
  dispatch: (action: CalcAction) => void
}

/**
 * Per-monster mechanic toggles. Each active toggle pipes the underlying
 * passive's raw buffs through the formula reducer (`recompute()` step 5):
 * conditions like `ATTACKER_ELEMENT_WIN` / `TARGET_ELEMENT=N` evaluate at
 * calc time, so the user only flips on/off — no manual multiplier dial.
 *
 * Mirrors the admin Damage Lab v2 panel — same compact fieldset layout so
 * users moving between the two keep the same muscle memory.
 */
export default function BossMechanicsPanel({ override, state, dispatch }: Props) {
  const { t } = useI18n()
  if (!override) return null

  return (
    <fieldset className="min-w-0 space-y-1.5 rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {t('tools.damage-calculator.target.boss_mechanics')}
      </legend>
      <div className="space-y-1">
        {override.mechanics.map(m => {
          const s = state[m.id] ?? { active: false }
          // Description from the datamine extractor is `\n`-joined per-buff
          // summaries — render line-by-line so each gate stays readable.
          const summaryLines = m.description ? m.description.split('\n') : []
          return (
            <label
              key={m.id}
              className="flex min-w-0 cursor-pointer items-start gap-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={s.active}
                onChange={e => dispatch({ type: 'boss/toggleMechanic', id: m.id, active: e.target.checked })}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-800"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={s.active ? 'text-zinc-200' : 'text-zinc-500'}>{m.label}</span>
                  {m.kind === 'enrage' && (
                    <span className="rounded bg-red-900/60 px-1 py-px text-[9px] font-semibold uppercase text-red-200">
                      {t('tools.damage-calculator.target.boss_enrage_badge')}
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

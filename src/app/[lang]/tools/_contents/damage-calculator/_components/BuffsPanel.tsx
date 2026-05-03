'use client'

import Image from 'next/image'
import { useI18n } from '@/lib/contexts/I18nContext'
import {
  EXTERNAL_BUFFS,
  type ExternalBuffDef,
  type ExternalBuffDirection,
  type ExternalBuffSide,
  type ExternalBuffStat,
} from '@/lib/damage/v2/external-buffs'
import type { TFunction, TranslationKey } from '@/i18n'
import type { CalcAction } from '../_state/reducer'
import type { BuffsState } from '../_state/types'

/**
 * External buffs / debuffs panel — mirrors the admin Damage Lab v2's
 * `BuffsTogglesPanel`. Catalog comes from `EXTERNAL_BUFFS` in
 * `src/lib/damage/v2/external-buffs.ts` (shared with the admin lab so the
 * same canonical defaults apply on both sides — Increased Attack +30%,
 * Increased EFF +100%, Reduced Defense −50%, …).
 *
 * Layout: 4 columns matching the admin shape — Caster buffs / Caster
 * debuffs / Target buffs / Target debuffs. Each row is a checkbox + icon
 * (recoloured via `buff-icon` / `debuff-icon` CSS filters), the stat
 * label in the matching color token, and an editable % input. Activation
 * is the toggle; the value is the magnitude.
 *
 * The off-catalog "Marked" toggle (Outerplane debuff that boosts incoming
 * damage) hangs at the bottom of the Target debuffs column — pure on/off,
 * no editable %.
 */

interface Props {
  state: BuffsState
  dispatch: (action: CalcAction) => void
}

const STAT_ICON: Record<ExternalBuffStat, string> = {
  ATK:      'ATK',
  DEF:      'DEF',
  PEN:      'PIERCE_POWER',
  CHC:      'CRITICAL',
  CHD:      'CRITICAL_DMG',
  EFF:      'CHANCE',
  DR:       'ENEMY_DMG_REDUCE',
  CDMG_RED: 'ENEMY_CRITICAL_DMG_REDUCE',
  DMG:      'DMG_INCREASE',
}

const COLUMNS: { side: ExternalBuffSide; direction: ExternalBuffDirection; labelKey: TranslationKey }[] = [
  { side: 'attacker', direction: 'buff',   labelKey: 'tools.damage-calculator.buffs.col.attacker_buff' },
  { side: 'attacker', direction: 'debuff', labelKey: 'tools.damage-calculator.buffs.col.attacker_debuff' },
  { side: 'target',   direction: 'buff',   labelKey: 'tools.damage-calculator.buffs.col.target_buff' },
  { side: 'target',   direction: 'debuff', labelKey: 'tools.damage-calculator.buffs.col.target_debuff' },
]

export default function BuffsPanel({ state, dispatch }: Props) {
  const { t } = useI18n()

  const anyDirty =
    Object.values(state.toggles).some(s => s.active) ||
    state.marked

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => dispatch({ type: 'buffs/reset' })}
          disabled={!anyDirty}
          className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('tools.damage-calculator.common.reset')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(col => {
          const items = EXTERNAL_BUFFS.filter(b => b.side === col.side && b.direction === col.direction)
          const isTargetDebuff = col.side === 'target' && col.direction === 'debuff'
          if (items.length === 0 && !isTargetDebuff) return null
          return (
            <Column key={`${col.side}-${col.direction}`} title={t(col.labelKey)}>
              {items.map(def => {
                const s = state.toggles[def.id] ?? { active: false, value: def.defaultValue }
                return (
                  <Row
                    key={def.id}
                    def={def}
                    active={s.active}
                    value={s.value}
                    onToggle={active => dispatch({ type: 'buffs/toggle', id: def.id, active })}
                    onValueChange={value => dispatch({ type: 'buffs/setValue', id: def.id, value })}
                  />
                )
              })}
              {/* Marked sits in the Target debuffs column — toggle-only, no value. */}
              {isTargetDebuff && (
                <MarkedRow
                  active={state.marked}
                  onToggle={marked => dispatch({ type: 'buffs/setMarked', marked })}
                  t={t}
                />
              )}
            </Column>
          )
        })}
      </div>
    </div>
  )
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({
  def,
  active,
  value,
  onToggle,
  onValueChange,
}: {
  def: ExternalBuffDef
  active: boolean
  value: number
  onToggle: (v: boolean) => void
  onValueChange: (v: number) => void
}) {
  const iconToken = STAT_ICON[def.stat]
  // Mirror EffectInline styling — `buff-icon` / `debuff-icon` CSS filters
  // recolor the white game icon (sky blue / rose). Direction is conveyed
  // via color so we don't need a `+`/`−` prefix.
  const iconClass = active
    ? def.direction === 'buff' ? 'buff-icon' : 'debuff-icon'
    : 'opacity-30 saturate-0'
  const labelClass = active
    ? def.direction === 'buff' ? 'text-buff' : 'text-debuff'
    : 'text-zinc-600'
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={active}
        onChange={e => onToggle(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-800"
      />
      <Image
        src={`/images/ui/effect/CM_Stat_Icon_${iconToken}.webp`}
        alt={def.stat}
        width={16}
        height={16}
        className={`shrink-0 ${iconClass}`}
        unoptimized
      />
      <span className={`flex-1 truncate font-semibold ${labelClass}`}>{def.stat}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => {
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onValueChange(n)
        }}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        suppressHydrationWarning
        className={`w-12 shrink-0 bg-transparent text-right text-xs font-semibold text-zinc-100 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
          active ? '' : 'opacity-50'
        }`}
      />
      <span className="shrink-0 text-[10px] text-zinc-500">%</span>
    </label>
  )
}

/** Marked — pure on/off toggle, no editable value. */
function MarkedRow({ active, onToggle, t }: { active: boolean; onToggle: (v: boolean) => void; t: TFunction }) {
  const iconClass = active ? 'debuff-icon' : 'opacity-30 saturate-0'
  const labelClass = active ? 'text-debuff' : 'text-zinc-600'
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={active}
        onChange={e => onToggle(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-800"
      />
      <Image
        src="/images/ui/effect/SC_Buff_Effect_Marking.webp"
        alt="Marked"
        width={16}
        height={16}
        className={`shrink-0 ${iconClass}`}
        unoptimized
      />
      <span className={`flex-1 truncate font-semibold ${labelClass}`}>{t('tools.damage-calculator.buffs.marked')}</span>
    </label>
  )
}

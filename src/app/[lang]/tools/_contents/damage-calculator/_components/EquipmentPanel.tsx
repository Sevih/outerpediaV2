'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getRarityBgPath } from '@/lib/format-text'
import { lRec } from '@/lib/i18n/localize'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { Lang } from '@/lib/i18n/config'
import type { TFunction } from '@/i18n'
import type {
  DamageCalcEquipmentFile,
  DamageCalcEquipmentEE,
  DamageCalcEffectGroup,
  DamageCalcCharSummary,
} from '@/lib/data/damage-calc'
import type { EquipmentLoadout } from '../_state/types'
import type { CalcAction, EquipSlot } from '../_state/reducer'
import EquipmentPickerModal from './EquipmentPickerModal'
import { eeMainStatLabel, formatBuffTag, formatBuffValue } from '../_lib/equipment-display'

/**
 * Six equipment slots for the attacker — surfaces only the passive-bearing
 * items (weapons / accessories / passive sets / talismans / EE). Raw stat
 * gear is intentionally not modeled here; the user types final stats into
 * the stat grid (which already includes equipment stat contributions).
 *
 * Slot layout:
 *   1 weapon  | 2 accessory
 *   3 set #1  | 4 set #2     (same set in both = 4-pc tier auto-active)
 *   5 talisman | 6 EE         (special: enable + variant + lv 0-10)
 *
 * Per-class filtering happens in the picker — items with a class
 * restriction that doesn't match the attacker are hidden.
 */

interface Props {
  equipment: EquipmentLoadout
  catalog: DamageCalcEquipmentFile
  charId: string | null
  charSummary: DamageCalcCharSummary | null
  /** Active skill slot for the cast — drives EE row active eval against
   *  each buff's `CallerSkillType`. Includes burst variants (B1/B2/B3). */
  activeSlot: 'S1' | 'S2' | 'S3' | 'B1' | 'B2' | 'B3'
  /** Current cast's target element — drives `targetElement` gating on
   *  EE main-stat rows. Null when no target is picked. */
  currentTargetElement: string | null
  portalElement: HTMLElement | null
  lang: Lang
  dispatch: (action: CalcAction) => void
}

// Per-kind icon roots — equipment items, set/passive icons, and EE
// thumbnails all live in different folders.
const EQUIP_ICON_BASE   = '/images/equipment'
const EFFECT_ICON_BASE  = '/images/ui/effect'
const EE_ICON_BASE      = '/images/characters/ee'

export default function EquipmentPanel({ equipment, catalog, charId, charSummary, activeSlot, currentTargetElement, portalElement, lang, dispatch }: Props) {
  const { t } = useI18n()
  const [openSlot, setOpenSlot] = useState<EquipSlot | null>(null)
  const disabled = !charId
  const tier2 = t('tools.damage-calculator.equipment.tier_2pc')
  const tier4 = t('tools.damage-calculator.equipment.tier_4pc')

  const weapon    = lookup(catalog.weapons,     equipment.weaponSlug)
  const accessory = lookup(catalog.accessories, equipment.accessorySlug)
  const set1      = lookup(catalog.sets,        equipment.setSlots[0])
  const set2      = lookup(catalog.sets,        equipment.setSlots[1])
  const talisman  = lookup(catalog.talismans,   equipment.talismanSlug)

  // EE candidates: own EE + (CF chars only) the base char's EE.
  const eeSelf = charId ? catalog.ees[charId] ?? null : null
  const eeBase = charSummary?.baseCharId ? catalog.ees[charSummary.baseCharId] ?? null : null
  const eePicked = equipment.ee.variant === 'base' && eeBase ? eeBase : eeSelf

  const isFourPc = set1 != null && set2 != null && set1.id === set2.id
  const charClass = charSummary?.class ?? null

  const closeModal = () => setOpenSlot(null)
  const slotProps = (slot: EquipSlot, id: string | null, paired?: string | null) => ({
    open: openSlot === slot,
    onClose: closeModal,
    selectedId: id,
    pairedId: paired ?? null,
    portalElement,
    lang,
    onPick: (s: string | null) => dispatch({ type: 'attacker/setEquipSlot', slot, slug: s }),
  })

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t('tools.damage-calculator.equipment.title')}</span>
        {(weapon || accessory || set1 || set2 || talisman || equipment.ee.enabled) && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'attacker/clearEquipment' })}
            className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {t('tools.damage-calculator.common.clear_all')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <SlotButton
          label={t('page.character.gear.weapon')}
          name={weapon ? lRec(weapon.name, lang) : null}
          iconName={weapon?.iconName}
          iconBase={EQUIP_ICON_BASE}
          effectName={weapon?.effect ? lRec(weapon.effect.name, lang) : null}
          disabled={disabled}
          empty={t('tools.damage-calculator.equipment.empty')}
          onClick={() => setOpenSlot('weapon')}
        />
        <SlotButton
          label={t('tools.damage-calculator.equipment.accessory')}
          name={accessory ? lRec(accessory.name, lang) : null}
          iconName={accessory?.iconName}
          iconBase={EQUIP_ICON_BASE}
          effectName={accessory?.effect ? lRec(accessory.effect.name, lang) : null}
          disabled={disabled}
          empty={t('tools.damage-calculator.equipment.empty')}
          onClick={() => setOpenSlot('accessory')}
        />
        <SlotButton
          label={t('tower.set', { n: 1 })}
          name={set1 ? lRec(set1.name, lang) : null}
          iconName={set1?.iconName}
          iconBase={EFFECT_ICON_BASE}
          effectName={set1 ? (isFourPc ? tier4 : tier2) : null}
          disabled={disabled}
          tier={isFourPc ? tier4 : set1 ? tier2 : undefined}
          empty={t('tools.damage-calculator.equipment.empty')}
          onClick={() => setOpenSlot('set1')}
        />
        <SlotButton
          label={t('tower.set', { n: 2 })}
          name={set2 ? lRec(set2.name, lang) : null}
          iconName={set2?.iconName}
          iconBase={EFFECT_ICON_BASE}
          effectName={set2 ? (isFourPc ? tier4 : tier2) : null}
          disabled={disabled}
          tier={isFourPc ? tier4 : set2 ? tier2 : undefined}
          empty={t('tools.damage-calculator.equipment.empty')}
          onClick={() => setOpenSlot('set2')}
        />
        <SlotButton
          label={t('page.character.gear.talisman')}
          name={talisman ? lRec(talisman.name, lang) : null}
          iconName={talisman?.iconName}
          iconBase={EQUIP_ICON_BASE}
          effectName={talisman?.effect ? lRec(talisman.effect.name, lang) : null}
          disabled={disabled}
          empty={t('tools.damage-calculator.equipment.empty')}
          onClick={() => setOpenSlot('talisman')}
        />
        <EESlotInline
          ee={eePicked}
          eeSelf={eeSelf}
          eeBase={eeBase}
          state={equipment.ee}
          disabled={disabled}
          activeSlot={activeSlot}
          currentTargetElement={currentTargetElement}
          lang={lang}
          t={t}
          dispatch={dispatch}
        />
      </div>

      {/* Pickers — one per slot type, only the active one renders the portal. */}
      <EquipmentPickerModal
        kind="weapon"
        items={catalog.weapons}
        charClass={charClass}
        title={t('tools.damage-calculator.equipment.pick_weapon')}
        {...slotProps('weapon', equipment.weaponSlug)}
      />
      <EquipmentPickerModal
        kind="accessory"
        items={catalog.accessories}
        charClass={charClass}
        title={t('tools.damage-calculator.equipment.pick_accessory')}
        {...slotProps('accessory', equipment.accessorySlug)}
      />
      <EquipmentPickerModal
        kind="set"
        items={catalog.sets}
        title={t('tools.damage-calculator.equipment.pick_set', { slot: t('tower.set', { n: 1 }) })}
        {...slotProps('set1', equipment.setSlots[0], equipment.setSlots[1])}
      />
      <EquipmentPickerModal
        kind="set"
        items={catalog.sets}
        title={t('tools.damage-calculator.equipment.pick_set', { slot: t('tower.set', { n: 2 }) })}
        {...slotProps('set2', equipment.setSlots[1], equipment.setSlots[0])}
      />
      <EquipmentPickerModal
        kind="talisman"
        items={catalog.talismans}
        charClass={charClass}
        title={t('tools.damage-calculator.equipment.pick_talisman')}
        {...slotProps('talisman', equipment.talismanSlug)}
      />
    </div>
  )
}

function lookup<T extends { id: string }>(arr: T[], id: string | null): T | null {
  if (!id) return null
  return arr.find(x => x.id === id) ?? null
}

// ── Generic slot button ────────────────────────────────────────────────────

function SlotButton({
  label,
  name,
  iconName,
  iconBase,
  effectName,
  disabled,
  tier,
  empty,
  onClick,
}: {
  label: string
  name: string | null
  iconName?: string
  iconBase: string
  effectName: string | null
  disabled: boolean
  /** Optional tier badge ("2-pc" / "4-pc") for set slots. */
  tier?: string
  /** Localized "empty" placeholder shown when no item is picked. */
  empty: string
  onClick: () => void
}) {
  const filled = name != null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-start gap-2 rounded border p-1.5 text-left transition-colors',
        filled ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400' : 'border-dashed border-zinc-700 bg-zinc-900/40 hover:border-zinc-500',
        disabled ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      <ItemThumb iconName={iconName} basePath={iconBase} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
          {tier && <span className="rounded bg-amber-500/20 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-amber-300">{tier}</span>}
        </div>
        <span className={`block truncate text-[11px] ${filled ? 'font-semibold text-zinc-100' : 'text-zinc-500'}`}>
          {filled ? name : empty}
        </span>
        {filled && effectName && (
          <span className="block truncate text-[10px] text-amber-300">{effectName}</span>
        )}
      </div>
    </button>
  )
}

function ItemThumb({ iconName, basePath }: { iconName?: string; basePath: string }) {
  const bg = getRarityBgPath('legendary')
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded">
      <Image src={bg} alt="" fill sizes="36px" className="object-cover" />
      {iconName ? (
        <Image
          src={`${basePath}/${iconName}.webp`}
          alt=""
          fill
          sizes="36px"
          className="object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-600">+</div>
      )}
    </div>
  )
}

// ── EE slot — inline because there's at most 2 candidates per char ─────────

function EESlotInline({
  ee,
  eeSelf,
  eeBase,
  state,
  disabled,
  activeSlot,
  currentTargetElement,
  lang,
  t,
  dispatch,
}: {
  ee: DamageCalcEquipmentEE | null
  eeSelf: DamageCalcEquipmentEE | null
  eeBase: DamageCalcEquipmentEE | null
  state: EquipmentLoadout['ee']
  disabled: boolean
  activeSlot: 'S1' | 'S2' | 'S3' | 'B1' | 'B2' | 'B3'
  currentTargetElement: string | null
  lang: Lang
  t: TFunction
  dispatch: (action: CalcAction) => void
}) {
  const hasCfChoice = eeSelf != null && eeBase != null
  const hasAnyEE = eeSelf != null || eeBase != null

  return (
    <div
      className={[
        'col-span-2 rounded border p-1.5',
        state.enabled && hasAnyEE ? 'border-amber-500/40 bg-amber-500/5' : 'border-dashed border-zinc-700 bg-zinc-900/40',
        disabled || !hasAnyEE ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-300">
          <input
            type="checkbox"
            checked={state.enabled}
            disabled={disabled || !hasAnyEE}
            onChange={e => dispatch({ type: 'attacker/setEEEnabled', enabled: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900"
          />
          {t('tools.damage-calculator.equipment.ee')}
        </label>
        {hasCfChoice && (
          <div className="ml-1 inline-flex overflow-hidden rounded border border-zinc-700 text-[10px]">
            <button
              type="button"
              disabled={disabled || !state.enabled}
              onClick={() => dispatch({ type: 'attacker/setEEVariant', variant: 'self' })}
              className={`px-1.5 py-0.5 ${state.variant === 'self' ? 'bg-amber-500/30 text-amber-200' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              {t('tools.damage-calculator.equipment.cf')}
            </button>
            <button
              type="button"
              disabled={disabled || !state.enabled}
              onClick={() => dispatch({ type: 'attacker/setEEVariant', variant: 'base' })}
              className={`border-l border-zinc-700 px-1.5 py-0.5 ${state.variant === 'base' ? 'bg-amber-500/30 text-amber-200' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              {t('tools.damage-calculator.equipment.base')}
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
          <span>{t('tools.damage-calculator.target.lv_prefix')}</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={state.level}
            disabled={disabled || !state.enabled}
            onChange={e => dispatch({ type: 'attacker/setEELevel', level: parseInt(e.target.value, 10) })}
            className="w-20 accent-amber-500"
          />
          <span className="w-5 text-right font-semibold text-amber-200 tabular-nums">{state.level}</span>
        </div>
      </div>

      {ee && state.enabled && (
        <div className="mt-1.5 flex items-start gap-2">
          {/* EE thumbnail lives under /images/characters/ee — file is named
              by charId, not by the bake's iconName (which references the
              datamine-style TI_Equipment_EX_* sprite that isn't shipped). */}
          <Image
            src={`${EE_ICON_BASE}/${ee.charId}.webp`}
            alt=""
            width={28}
            height={28}
            className="shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1 space-y-1 text-[11px] leading-snug">
            <div className="font-semibold text-amber-200">{lRec(ee.name, lang)}</div>
            <EEEffectRow label={t('tools.damage-calculator.equipment.passive_main')}  effect={ee.mainStat}    lang={lang} level={state.level} activeSlot={activeSlot} currentTargetElement={currentTargetElement} isMainStat />
            <EEEffectRow label={t('tools.damage-calculator.equipment.passive_lv0')}   effect={ee.passiveLv0}  lang={lang} level={state.level} activeSlot={activeSlot} currentTargetElement={currentTargetElement} />
            <EEEffectRow label={t('tools.damage-calculator.equipment.passive_lv10')}  effect={ee.passiveLv10} lang={lang} level={state.level} activeSlot={activeSlot} currentTargetElement={currentTargetElement} dimUntilMax />
          </div>
        </div>
      )}

      {!hasAnyEE && (
        <p className="mt-1 text-[10px] text-zinc-600">{t('tools.damage-calculator.equipment.ee_no_data')}</p>
      )}
    </div>
  )
}

/** Map our active-slot identifier to the templet's `SKT_*` token used by
 *  the buff catalog's `CallerSkillType` CSV. */
const SLOT_TO_SKT: Record<'S1' | 'S2' | 'S3' | 'B1' | 'B2' | 'B3', string> = {
  S1: 'SKT_FIRST',  S2: 'SKT_SECOND', S3: 'SKT_ULTIMATE',
  B1: 'SKT_BURST_1', B2: 'SKT_BURST_2', B3: 'SKT_BURST_3',
}

/**
 * Decide whether an EE effect row is currently contributing to the calc.
 * Hard gates (level / target element / caller skill) flip to inactive when
 * unmet; soft conditions (`OWNER_HAS_BUFF`, `CASTER_CRITICAL`, etc.) are
 * runtime-only and treated as `'conditional'` — neither hard active nor
 * silenced, surfaced with a neutral badge so the user knows to verify
 * manually.
 */
type EERowState = 'active' | 'inactive' | 'conditional'

function evaluateEERowState(
  effect: DamageCalcEffectGroup,
  ctx: {
    eeLevel: number
    isLv10Only: boolean
    activeSlot: 'S1' | 'S2' | 'S3' | 'B1' | 'B2' | 'B3'
    currentTargetElement: string | null
  },
): EERowState {
  // Lv10-only passive needs the EE at max enchant.
  if (ctx.isLv10Only && ctx.eeLevel < 10) return 'inactive'
  // Main-stat row's effect-level `targetElement` (e.g. "vs Earth DMG↑%")
  // — must match the cast's target element.
  if (effect.targetElement && ctx.currentTargetElement !== effect.targetElement) return 'inactive'
  // Walk each composing buff: callerSkillType narrows the casts that fire
  // it; runtime conditions (target/owner has buff, kill streak, etc.) are
  // conditional — flag the row neutrally so the user verifies in-game.
  let conditional = false
  const sktForSlot = SLOT_TO_SKT[ctx.activeSlot]
  for (const buff of effect.buffs) {
    const callerCsv = buff.callerSkillType
    if (callerCsv && callerCsv !== 'SKT_ALL') {
      const slots = callerCsv.split(',').map(s => s.trim()).filter(Boolean)
      if (!slots.includes(sktForSlot)) return 'inactive'
    }
    const cond = buff.buffConditionType
    // NONE / undefined → unconditional; element-relation gates are partly
    // resolvable without combat state but kept conditional here since we
    // don't have ctx.elem in scope at the EE row.
    if (cond && cond !== 'NONE') conditional = true
  }
  return conditional ? 'conditional' : 'active'
}

/** EE effect row — main stat uses element-derived label, others use the passive name. */
function EEEffectRow({
  label,
  effect,
  lang,
  level,
  activeSlot,
  currentTargetElement,
  dimUntilMax = false,
  isMainStat = false,
}: {
  label: string
  effect: DamageCalcEffectGroup | null
  lang: Lang
  /** Current EE enchant level (0-10). Drives the per-level value display. */
  level: number
  activeSlot: 'S1' | 'S2' | 'S3' | 'B1' | 'B2' | 'B3'
  currentTargetElement: string | null
  /** Greys the row when level < 10 (used for Lv10-only passives). */
  dimUntilMax?: boolean
  /** True for the EE main-stat row — synthesizes a "vs Element STAT" label. */
  isMainStat?: boolean
}) {
  if (!effect) return null
  const { t } = useI18n()
  const rowState = evaluateEERowState(effect, {
    eeLevel: level,
    isLv10Only: dimUntilMax,
    activeSlot,
    currentTargetElement,
  })
  const display = isMainStat
    ? eeMainStatLabel(effect)
    : (effect.name ? lRec(effect.name, lang) : '')
  const opacityClass = rowState === 'inactive' ? 'opacity-40' : ''
  return (
    <div className={`flex flex-wrap items-baseline gap-1 ${opacityClass}`}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
      {rowState === 'active' && (
        <span className="rounded bg-emerald-500/20 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-emerald-300">
          {t('tools.damage-calculator.equipment.ee_active')}
        </span>
      )}
      {rowState === 'inactive' && (
        <span className="rounded bg-zinc-700/40 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-zinc-500">
          {t('tools.damage-calculator.equipment.ee_inactive')}
        </span>
      )}
      {rowState === 'conditional' && (
        <span
          className="rounded bg-amber-500/20 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-300"
          title={t('tools.damage-calculator.equipment.ee_conditional_hint')}
        >
          {t('tools.damage-calculator.equipment.ee_conditional')}
        </span>
      )}
      <span className="text-zinc-300">{display}</span>
      <div className="flex flex-wrap gap-1 text-[10px]">
        {effect.buffs.map((b, i) => (
          <span key={i} className="rounded bg-zinc-800/80 px-1 py-px text-zinc-200 tabular-nums">
            {/* Main-stat tag is folded into the `display` label above —
                only show standalone scaling for the lv0/lv10 passives. */}
            {!isMainStat && <>{formatBuffTag(b)} </>}
            {formatBuffValue(b, level)}
          </span>
        ))}
      </div>
    </div>
  )
}

'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getRarityBgPath } from '@/lib/format-text'
import { lRec } from '@/lib/i18n/localize'
import type { Lang } from '@/lib/i18n/config'
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
  portalElement: HTMLElement | null
  lang: Lang
  dispatch: (action: CalcAction) => void
}

// Per-kind icon roots — equipment items, set/passive icons, and EE
// thumbnails all live in different folders.
const EQUIP_ICON_BASE   = '/images/equipment'
const EFFECT_ICON_BASE  = '/images/ui/effect'
const EE_ICON_BASE      = '/images/characters/ee'

export default function EquipmentPanel({ equipment, catalog, charId, charSummary, portalElement, lang, dispatch }: Props) {
  const [openSlot, setOpenSlot] = useState<EquipSlot | null>(null)
  const disabled = !charId

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
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Equipment passives</span>
        {(weapon || accessory || set1 || set2 || talisman || equipment.ee.enabled) && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'attacker/clearEquipment' })}
            className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <SlotButton
          label="Weapon"
          name={weapon ? lRec(weapon.name, lang) : null}
          iconName={weapon?.iconName}
          iconBase={EQUIP_ICON_BASE}
          effectName={weapon?.effect ? lRec(weapon.effect.name, lang) : null}
          disabled={disabled}
          onClick={() => setOpenSlot('weapon')}
        />
        <SlotButton
          label="Accessory"
          name={accessory ? lRec(accessory.name, lang) : null}
          iconName={accessory?.iconName}
          iconBase={EQUIP_ICON_BASE}
          effectName={accessory?.effect ? lRec(accessory.effect.name, lang) : null}
          disabled={disabled}
          onClick={() => setOpenSlot('accessory')}
        />
        <SlotButton
          label="Set 1"
          name={set1 ? lRec(set1.name, lang) : null}
          iconName={set1?.iconName}
          iconBase={EFFECT_ICON_BASE}
          effectName={set1 ? `${isFourPc ? '4-pc' : '2-pc'}` : null}
          disabled={disabled}
          tier={isFourPc ? '4-pc' : set1 ? '2-pc' : undefined}
          onClick={() => setOpenSlot('set1')}
        />
        <SlotButton
          label="Set 2"
          name={set2 ? lRec(set2.name, lang) : null}
          iconName={set2?.iconName}
          iconBase={EFFECT_ICON_BASE}
          effectName={set2 ? `${isFourPc ? '4-pc' : '2-pc'}` : null}
          disabled={disabled}
          tier={isFourPc ? '4-pc' : set2 ? '2-pc' : undefined}
          onClick={() => setOpenSlot('set2')}
        />
        <SlotButton
          label="Talisman"
          name={talisman ? lRec(talisman.name, lang) : null}
          iconName={talisman?.iconName}
          iconBase={EQUIP_ICON_BASE}
          effectName={talisman?.effect ? lRec(talisman.effect.name, lang) : null}
          disabled={disabled}
          onClick={() => setOpenSlot('talisman')}
        />
        <EESlotInline
          ee={eePicked}
          eeSelf={eeSelf}
          eeBase={eeBase}
          state={equipment.ee}
          disabled={disabled}
          lang={lang}
          dispatch={dispatch}
        />
      </div>

      {/* Pickers — one per slot type, only the active one renders the portal. */}
      <EquipmentPickerModal
        kind="weapon"
        items={catalog.weapons}
        charClass={charClass}
        title="Pick a weapon"
        {...slotProps('weapon', equipment.weaponSlug)}
      />
      <EquipmentPickerModal
        kind="accessory"
        items={catalog.accessories}
        charClass={charClass}
        title="Pick an accessory"
        {...slotProps('accessory', equipment.accessorySlug)}
      />
      <EquipmentPickerModal
        kind="set"
        items={catalog.sets}
        title="Pick a set (slot 1)"
        {...slotProps('set1', equipment.setSlots[0], equipment.setSlots[1])}
      />
      <EquipmentPickerModal
        kind="set"
        items={catalog.sets}
        title="Pick a set (slot 2)"
        {...slotProps('set2', equipment.setSlots[1], equipment.setSlots[0])}
      />
      <EquipmentPickerModal
        kind="talisman"
        items={catalog.talismans}
        charClass={charClass}
        title="Pick a talisman"
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
          {filled ? name : 'Empty — click to pick'}
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
  lang,
  dispatch,
}: {
  ee: DamageCalcEquipmentEE | null
  eeSelf: DamageCalcEquipmentEE | null
  eeBase: DamageCalcEquipmentEE | null
  state: EquipmentLoadout['ee']
  disabled: boolean
  lang: Lang
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
          EE
        </label>
        {hasCfChoice && (
          <div className="ml-1 inline-flex overflow-hidden rounded border border-zinc-700 text-[10px]">
            <button
              type="button"
              disabled={disabled || !state.enabled}
              onClick={() => dispatch({ type: 'attacker/setEEVariant', variant: 'self' })}
              className={`px-1.5 py-0.5 ${state.variant === 'self' ? 'bg-amber-500/30 text-amber-200' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              CF
            </button>
            <button
              type="button"
              disabled={disabled || !state.enabled}
              onClick={() => dispatch({ type: 'attacker/setEEVariant', variant: 'base' })}
              className={`border-l border-zinc-700 px-1.5 py-0.5 ${state.variant === 'base' ? 'bg-amber-500/30 text-amber-200' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              Base
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
          <span>Lv</span>
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
            <EEEffectRow label="Main"  effect={ee.mainStat}    lang={lang} level={state.level} isMainStat />
            <EEEffectRow label="Lv0"   effect={ee.passiveLv0}  lang={lang} level={state.level} />
            <EEEffectRow label="Lv10"  effect={ee.passiveLv10} lang={lang} level={state.level} dimUntilMax />
          </div>
        </div>
      )}

      {!hasAnyEE && (
        <p className="mt-1 text-[10px] text-zinc-600">No EE registered for this character</p>
      )}
    </div>
  )
}

/** EE effect row — main stat uses element-derived label, others use the passive name. */
function EEEffectRow({
  label,
  effect,
  lang,
  level,
  dimUntilMax = false,
  isMainStat = false,
}: {
  label: string
  effect: DamageCalcEffectGroup | null
  lang: Lang
  /** Current EE enchant level (0-10). Drives the per-level value display. */
  level: number
  /** Greys the row when level < 10 (used for Lv10-only passives). */
  dimUntilMax?: boolean
  /** True for the EE main-stat row — synthesizes a "vs Element STAT" label. */
  isMainStat?: boolean
}) {
  if (!effect) return null
  const dim = dimUntilMax && level < 10
  const display = isMainStat
    ? eeMainStatLabel(effect)
    : (effect.name ? lRec(effect.name, lang) : '')
  return (
    <div className={`flex flex-wrap items-baseline gap-1 ${dim ? 'opacity-40' : ''}`}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
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

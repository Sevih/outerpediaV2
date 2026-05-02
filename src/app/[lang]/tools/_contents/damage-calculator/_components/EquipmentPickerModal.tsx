'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { getRarityBgPath } from '@/lib/format-text'
import { lRec } from '@/lib/i18n/localize'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { Lang } from '@/lib/i18n/config'
import type { TFunction } from '@/i18n'
import type {
  DamageCalcEquipmentItem,
  DamageCalcEquipmentSet,
  DamageCalcEffectGroup,
} from '@/lib/data/damage-calc'
import { formatClassLimit } from '../_lib/equipment-display'

/**
 * Generic picker for the 5 non-EE equipment slots (weapon, accessory, set1,
 * set2, talisman). Renders the candidate items as a searchable grid;
 * filters by the attacker's class so weapons restricted to other classes
 * don't pollute the list.
 *
 * Per the user spec: cards display only the item name + the passive's
 * effect name. Buff scaling values stay accessible via the structured
 * data for the recompute pipeline but are intentionally not shown in
 * the picker (less visual noise, easier to scan).
 *
 * Localization goes through `lRec()` — no inline lang switching.
 */

type ItemKind = 'weapon' | 'accessory' | 'talisman'
type SetKind = 'set'

interface BaseProps {
  open: boolean
  onClose: () => void
  onPick: (id: string | null) => void
  selectedId: string | null
  portalElement: HTMLElement | null
  lang: Lang
  /** Modal title — supplied by the slot caller. */
  title: string
  /** Sister-slot id (set1 ↔ set2) used for the 4-pc highlight. */
  pairedId?: string | null
}

interface ItemPickerProps extends BaseProps {
  kind: ItemKind
  items: DamageCalcEquipmentItem[]
  /**
   * Char's class (`CCT_ATTACKER` etc.) — items with a different `classLimit`
   * are hidden. Pass null to surface all items (no char picked yet).
   */
  charClass?: string | null
}

interface SetPickerProps extends BaseProps {
  kind: SetKind
  items: DamageCalcEquipmentSet[]
}

type Props = ItemPickerProps | SetPickerProps

// Equipment item icons → /images/equipment.
// Set + passive-effect icons → /images/ui/effect.
const EQUIP_ICON_BASE  = '/images/equipment'
const EFFECT_ICON_BASE = '/images/ui/effect'

export default function EquipmentPickerModal(props: Props) {
  const { open, onClose, onPick, selectedId, portalElement, lang, title, kind } = props
  const { t } = useI18n()

  // Esc-to-close + reset search every time the modal opens.
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!open) return
    setSearch('')
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (kind === 'set') {
      const list = (props as SetPickerProps).items
      return q ? list.filter(it => matchSearch(it.name, q, lang)) : list
    }
    const itemProps = props as ItemPickerProps
    // Class restriction filter — show items with no limit, or where the
    // limit matches the attacker's class. Without a picked char (charClass
    // null) we surface everything so the user can still browse.
    // The bake stores `classLimit` as raw `CCT_*` tokens, but `charClass`
    // comes from the curated manifest as the display name (`"Defender"`,
    // `"Striker"`, …) — normalize via `formatClassLimit` before comparing.
    const cls = itemProps.charClass ?? null
    let list = itemProps.items
    if (cls) list = list.filter(it => !it.classLimit || formatClassLimit(it.classLimit) === cls)
    return q ? list.filter(it => matchSearch(it.name, q, lang)) : list
  }, [search, props, kind, lang])

  if (!open || !portalElement) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 p-4"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-gray-800 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-700 p-4">
          <h3 className="text-lg font-bold text-gray-100">{title}</h3>
          <button
            type="button"
            onClick={() => { onPick(null); onClose() }}
            disabled={!selectedId}
            className="ml-auto rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('tools.damage-calculator.common.clear_slot')}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-gray-400 hover:text-gray-100"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-700 p-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
          {filtered.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-gray-500">{t('tools.damage-calculator.common.no_matches')}</p>
          )}
          {kind === 'set'
            ? (filtered as DamageCalcEquipmentSet[]).map(set => (
                <SetCard
                  key={set.id}
                  set={set}
                  lang={lang}
                  t={t}
                  selected={selectedId === set.id}
                  paired4pc={selectedId !== set.id && (props as BaseProps).pairedId === set.id}
                  onPick={() => { onPick(set.id); onClose() }}
                />
              ))
            : (filtered as DamageCalcEquipmentItem[]).map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  lang={lang}
                  t={t}
                  selected={selectedId === item.id}
                  onPick={() => { onPick(item.id); onClose() }}
                />
              ))}
        </div>
      </div>
    </div>,
    portalElement,
  )
}

function matchSearch(name: { en?: string }, q: string, lang: Lang): boolean {
  if ((name.en ?? '').toLowerCase().includes(q)) return true
  return lRec(name, lang).toLowerCase().includes(q)
}

// ── Cards ──────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  lang,
  t,
  selected,
  onPick,
}: {
  item: DamageCalcEquipmentItem
  lang: Lang
  t: TFunction
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        'flex items-start gap-2 rounded border p-2 text-left transition-colors',
        selected ? 'border-purple-500 bg-purple-500/15' : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800',
      ].join(' ')}
    >
      <ItemIcon iconName={item.iconName} alt={lRec(item.name, lang)} basePath={EQUIP_ICON_BASE} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-100">{lRec(item.name, lang)}</span>
          {item.classLimit && (
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-gray-400">
              {formatClassLimit(item.classLimit)}
            </span>
          )}
        </div>
        <EffectName effect={item.effect} lang={lang} t={t} />
      </div>
    </button>
  )
}

function SetCard({
  set,
  lang,
  t,
  selected,
  paired4pc,
  onPick,
}: {
  set: DamageCalcEquipmentSet
  lang: Lang
  t: TFunction
  selected: boolean
  paired4pc: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        'flex items-start gap-2 rounded border p-2 text-left transition-colors',
        selected ? 'border-purple-500 bg-purple-500/15' : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800',
        paired4pc ? 'ring-1 ring-amber-400/60' : '',
      ].filter(Boolean).join(' ')}
      title={paired4pc ? t('tools.damage-calculator.equipment.4pc_hint') : undefined}
    >
      {/* Set icons live under /images/ui/effect, not /images/equipment. */}
      <ItemIcon iconName={set.iconName} alt={lRec(set.name, lang)} basePath={EFFECT_ICON_BASE} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <span className="block truncate text-sm font-semibold text-gray-100">{lRec(set.name, lang)}</span>
        {set.bonus2 && (
          <div className="text-[11px] text-gray-300">
            <span className="font-semibold text-emerald-300">{t('tools.damage-calculator.equipment.tier_2pc')}</span>
          </div>
        )}
        {set.bonus4 && (
          <div className="text-[11px] text-gray-300">
            <span className="font-semibold text-amber-300">{t('tools.damage-calculator.equipment.tier_4pc')}</span>
          </div>
        )}
      </div>
    </button>
  )
}

/** Just the passive label — the structured buff data feeds recompute, not the picker UI. */
function EffectName({ effect, lang, t }: { effect: DamageCalcEffectGroup | null; lang: Lang; t: TFunction }) {
  if (!effect) return <span className="text-[11px] italic text-gray-500">{t('tools.damage-calculator.equipment.no_passive_data')}</span>
  if (!effect.name) return null
  return <div className="truncate text-[11px] font-medium text-amber-300">{lRec(effect.name, lang)}</div>
}

/** Square equipment thumbnail with rarity background. `basePath` differs per kind. */
function ItemIcon({
  iconName,
  alt,
  basePath,
}: {
  iconName?: string
  alt: string
  basePath: string
}) {
  // All baked items are IG_UNIQUE → legendary background.
  const bg = getRarityBgPath('legendary')
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
      <Image src={bg} alt="" fill sizes="48px" className="object-cover" />
      {iconName && (
        <Image
          src={`${basePath}/${iconName}.webp`}
          alt={alt}
          fill
          sizes="48px"
          className="object-contain"
        />
      )}
    </div>
  )
}

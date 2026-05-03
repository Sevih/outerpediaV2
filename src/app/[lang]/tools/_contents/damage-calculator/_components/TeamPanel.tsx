'use client'

import Image from 'next/image'
import { useState } from 'react'
import CharacterPortrait from '@/app/components/character/CharacterPortrait'
import { l } from '@/lib/i18n/localize'
import { STAR_ICONS, starRowForLevel } from '@/lib/stars'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { Lang } from '@/lib/i18n/config'
import type { DamageCalcCharSummary, DamageCalcTalismanMainStat, DamageCalcTranscendCharEntry, DamageCalcTranscendFile } from '@/lib/data/damage-calc'
import type { TFunction } from '@/i18n'
import type { CalcAction } from '../_state/reducer'
import { TALISMAN_MAIN_STATS, type TalismanLoadout, type TalismanMainStat, type TeamMember, type TeamState } from '../_state/types'
import CharPickerModal from './CharPickerModal'
import { ClassIcon, ElementIcon } from './StatBadges'
import TranscendActiveInfo from './TranscendActiveInfo'
import { transcendLabel, transStarToLevelId } from '../_lib/transcend'

/** Hardcoded ally signature gear — small set today, easier inline than baked. */
const EXQUISITE_DEATH_ICON = '/images/equipment/TI_Equipment_Weapon_06_Defender.webp'
const ABSOLUTE_MUSIC_ICON = '/images/equipment/TI_Equipment_Accessary_06_Ranger.webp'

const TALISMAN_RARITIES = [4, 5, 6] as const

/**
 * Ally team — three optional support slots whose talisman + class-specific
 * signature gear contributes to the damage dealer's output.
 *
 * UI is a 3-col row of slot cards (one per ally). Each card surfaces:
 *   - char portrait + class/element badges (clickable → CharPickerModal)
 *   - talisman slot (clickable → EquipmentPickerModal filtered to talismans)
 *   - class-conditional block:
 *       Defender → "Exquisite Death" toggle + tier 0..4 + flat DEF input
 *       Ranger   → "Absolute Music" toggle + tier 0..4
 *       (other classes have nothing extra today)
 *
 * Talisman picker reuses the shared `EquipmentPickerModal` — same catalog,
 * same chrome — but with `charClass={null}` so allies of any class can be
 * paired with any talisman (the damage dealer's class is the constraint
 * for *their* talisman; the ally pickers are unconstrained).
 */

interface Props {
  state: TeamState
  manifest: DamageCalcCharSummary[]
  transcend: DamageCalcTranscendFile
  /** Talisman main-stat catalog — drives per-rarity level gating + the
   *  resolved-value badge in the picker. */
  talismanMainStats: DamageCalcTalismanMainStat[]
  lang: Lang
  dispatch: (action: CalcAction) => void
}

export default function TeamPanel({ state, manifest, transcend, talismanMainStats, lang, dispatch }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      {state.members.map((member, slot) => (
        <Slot
          key={slot}
          slot={slot}
          member={member}
          manifest={manifest}
          transcend={transcend}
          talismanMainStats={talismanMainStats}
          lang={lang}
          dispatch={dispatch}
        />
      ))}
    </div>
  )
}

function Slot({
  slot,
  member,
  manifest,
  transcend,
  talismanMainStats,
  lang,
  dispatch,
}: {
  slot: number
  member: TeamMember
  manifest: DamageCalcCharSummary[]
  transcend: DamageCalcTranscendFile
  talismanMainStats: DamageCalcTalismanMainStat[]
  lang: Lang
  dispatch: (action: CalcAction) => void
}) {
  const { t } = useI18n()
  const [charPickerOpen, setCharPickerOpen] = useState(false)

  const summary = member.charId ? manifest.find(c => c.id === member.charId) ?? null : null
  const transcendEntry = member.charId ? transcend.byChar[member.charId] : undefined

  // Class drives the conditional block. The bake stores the class as the
  // display label ("Defender", "Ranger", …) — match exactly.
  const isDefender = summary?.class === 'Defender'
  const isRanger = summary?.class === 'Ranger'

  /** Pick a char + auto-set its transcend tier to the chain's max. */
  function handlePickChar(charId: string) {
    const entry = transcend.byChar[charId]
    const defaultTransStar = entry && entry.tiers.length > 0
      ? entry.tiers[entry.tiers.length - 1].transStar
      : (entry?.basicStar ?? 0)
    dispatch({ type: 'team/setChar', slot, charId, defaultTransStar })
  }

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
      {/* Char picker — full width */}
      <CharHeader
        summary={summary}
        slot={slot}
        lang={lang}
        onClick={() => setCharPickerOpen(true)}
        onClear={() => dispatch({ type: 'team/clearMember', slot })}
      />
      {/* Compact transcend slider stacked below the picker. Renders only when
          the char has a transcend chain — most chars do; NPC-style entries
          don't, in which case we just hide the row. */}
      {transcendEntry && transcendEntry.tiers.length > 0 && (
        <CompactTranscendSlider
          entry={transcendEntry}
          transStar={member.transStar}
          onChange={transStar => dispatch({ type: 'team/setTransStar', slot, transStar })}
        />
      )}

      {/* Talisman main-stat selector — what the item is doesn't matter, only
          its rarity + main stat + level feed the formula. */}
      <TalismanInput
        loadout={member.talisman}
        catalog={talismanMainStats}
        onChange={next => dispatch({ type: 'team/patchMember', slot, patch: { talisman: next } })}
        t={t}
      />

      {/* Conditional class-specific block */}
      {isDefender && (
        <SignatureRow
          enabled={member.exquisiteDeath.enabled}
          tier={member.exquisiteDeath.tier}
          icon={EXQUISITE_DEATH_ICON}
          label={t('tools.damage-calculator.team.exquisite_death')}
          onToggle={enabled => dispatch({ type: 'team/patchMember', slot, patch: { exquisiteDeath: { enabled, tier: member.exquisiteDeath.tier } } })}
          onTier={tier => dispatch({ type: 'team/patchMember', slot, patch: { exquisiteDeath: { enabled: member.exquisiteDeath.enabled, tier } } })}
        >
          {/* Defender DEF — feeds the Exquisite Death scaling. */}
          <DefenderDefField
            value={member.defenderDef}
            onChange={v => dispatch({ type: 'team/patchMember', slot, patch: { defenderDef: v } })}
            t={t}
          />
        </SignatureRow>
      )}

      {isRanger && (
        <SignatureRow
          enabled={member.absoluteMusic.enabled}
          tier={member.absoluteMusic.tier}
          icon={ABSOLUTE_MUSIC_ICON}
          label={t('tools.damage-calculator.team.absolute_music')}
          onToggle={enabled => dispatch({ type: 'team/patchMember', slot, patch: { absoluteMusic: { enabled, tier: member.absoluteMusic.tier } } })}
          onTier={tier => dispatch({ type: 'team/patchMember', slot, patch: { absoluteMusic: { enabled: member.absoluteMusic.enabled, tier } } })}
        />
      )}

      {/* Char picker — modal portal. `handlePickChar` sets transStar to the
          char's max tier so the slot opens at the user's typical loadout. */}
      {charPickerOpen && (
        <CharPickerModal
          chars={manifest}
          selectedId={member.charId}
          lang={lang}
          onPick={handlePickChar}
          onClose={() => setCharPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Compact transcend slider ─────────────────────────────────────────────────

/**
 * Compact −/bar/+ slider with the full transcend star row + tier label —
 * mirrors the damage dealer's `TranscendControl` slider chrome (yellow
 * track, 6-star row colored per tier, `'5+'` style label) but drops the
 * bonuses block. Sits below the char picker in the team slot.
 */
function CompactTranscendSlider({
  entry,
  transStar,
  onChange,
}: {
  entry: DamageCalcTranscendCharEntry
  transStar: number
  onChange: (next: number) => void
}) {
  const minTier = entry.basicStar
  const maxTier = entry.tiers[entry.tiers.length - 1].transStar
  const range = maxTier - minTier
  const progressPct = range > 0 ? ((transStar - minTier) / range) * 100 : 100
  const setTier = (next: number) => onChange(Math.max(minTier, Math.min(maxTier, next)))
  const levelId = transStarToLevelId(transStar, entry.basicStar)
  const stars = starRowForLevel(levelId)
  const label = transcendLabel(transStar, entry.basicStar)
  return (
    <div className="space-y-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTier(transStar - 1)}
          disabled={transStar <= minTier}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-700 text-xs text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          &ndash;
        </button>
        <div className="relative h-1.5 grow overflow-hidden rounded-full bg-zinc-700">
          <div
            className="absolute left-0 top-0 h-full bg-yellow-500 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
          <input
            type="range"
            min={minTier}
            max={maxTier}
            step={1}
            value={transStar}
            onChange={e => setTier(parseInt(e.target.value, 10))}
            className="absolute left-0 top-0 h-1.5 w-full cursor-pointer opacity-0"
          />
        </div>
        <button
          type="button"
          onClick={() => setTier(transStar + 1)}
          disabled={transStar >= maxTier}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-700 text-xs text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          +
        </button>
        {/* Stars + tier label — same right-side cluster as the damage dealer slider. */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex gap-px">
            {stars.map((color, i) => (
              <Image
                key={i}
                src={STAR_ICONS[color]}
                alt=""
                width={10}
                height={10}
                className="object-contain"
              />
            ))}
          </div>
          <span className="w-7 text-right text-[11px] font-semibold text-yellow-300 tabular-nums">{label}</span>
        </div>
      </div>
      {/* Active info — same shared component as the damage dealer panel,
          rendered in compact variant so it fits the team slot. */}
      <TranscendActiveInfo entry={entry} transStar={transStar} variant="compact" />
    </div>
  )
}

// ── Char header ──────────────────────────────────────────────────────────────

function CharHeader({
  summary,
  slot,
  lang,
  onClick,
  onClear,
}: {
  summary: DamageCalcCharSummary | null
  slot: number
  lang: Lang
  onClick: () => void
  onClear: () => void
}) {
  const { t } = useI18n()
  if (!summary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded border border-dashed border-zinc-700 bg-zinc-950 p-2 text-left text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
      >
        <div className="h-10 w-10 shrink-0 rounded bg-zinc-800" />
        <span>{t('tools.damage-calculator.team.empty', { n: slot + 1 })}</span>
      </button>
    )
  }
  const displayName = l(summary, 'name', lang)
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        title={t('tools.damage-calculator.common.change')}
        className="flex min-w-0 flex-1 items-center gap-2 rounded p-1 text-left transition-colors hover:bg-zinc-900"
      >
        <CharacterPortrait
          id={summary.id}
          name={displayName}
          size="sm"
          showIcons={false}
          showStars={false}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-zinc-100">{displayName}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            <ElementIcon element={summary.element} size={10} />
            <ClassIcon classLabel={summary.class} size={10} />
            <span className="truncate">{summary.class}</span>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onClear}
        title={t('tools.damage-calculator.common.clear_slot')}
        className="shrink-0 rounded p-1 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
      >
        ×
      </button>
    </div>
  )
}

// ── Talisman main-stat selector ──────────────────────────────────────────────

/**
 * Render-friendly stat label for the resolved-value badge — `'ATK%'` →
 * `'ATK'`, `'DMG UP%'` → `'DMG↑'` (matches the dealer panel's stat icons),
 * etc. Keeps the suffix `%` off ATK/DEF/HP since the badge already prefixes
 * the value with `+X%`.
 */
function talismanDisplayLabel(stat: TalismanMainStat | ''): string {
  switch (stat) {
    case 'ATK%':     return 'ATK'
    case 'DEF%':     return 'DEF'
    case 'HP%':      return 'HP'
    case 'DMG UP%':  return 'DMG↑'
    case 'DMG RED%': return 'DMG↓'
    default:         return stat
  }
}

/**
 * Inline selector — no item picker. The damage formula only cares about the
 * talisman's main stat (and its rarity, which scales the magnitude), not
 * the specific item, so we expose just two controls:
 *   - Rarity pills (4★ / 5★ / 6★)
 *   - Main stat dropdown (— none — / ATK% / DEF% / …)
 *
 * `stat === ''` means "no talisman equipped".
 */
function TalismanInput({
  loadout,
  catalog,
  onChange,
  t,
}: {
  loadout: TalismanLoadout
  catalog: DamageCalcTalismanMainStat[]
  onChange: (next: TalismanLoadout) => void
  t: TFunction
}) {
  const disabled = loadout.stat === ''
  // Per-rarity max enchant level — 4★/5★ ship a single Level=1 row in
  // the buff catalog (no upgrade), 6★ ships levels 1-11 (in-game +0..+10).
  const maxLevelForRarity = (rarity: 4 | 5 | 6): number => (rarity === 6 ? 10 : 0)
  const maxLevel = maxLevelForRarity(loadout.rarity)
  const isLevelLocked = maxLevel === 0

  // Resolve the current value from the catalog so the picker shows what
  // the talisman actually contributes (e.g. `+15% ATK`).
  const entry = loadout.stat ? catalog.find(c => c.stat === loadout.stat) : undefined
  const rarityKey = String(loadout.rarity) as '4' | '5' | '6'
  const valuesForRarity = entry?.byRarity[rarityKey] ?? []
  const clampedLevel = Math.min(loadout.level, valuesForRarity.length - 1)
  const resolvedValue = clampedLevel >= 0 ? valuesForRarity[clampedLevel] : null

  /** Switch rarity — clamps level to the new rarity's max so 4★/5★ never
   *  carry stale enchant indices that 6★ might have set previously. */
  function handleRarityChange(rarity: 4 | 5 | 6) {
    const newMax = maxLevelForRarity(rarity)
    onChange({ ...loadout, rarity, level: Math.min(loadout.level, newMax) })
  }

  return (
    <div className="space-y-1 rounded border border-zinc-800 bg-zinc-950 p-1.5">
      {/* Legend — names the section so the rarity / stat / level inputs read in context. */}
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {t('page.character.gear.talisman')}
      </div>
      {/* Single row: rarity pills + main stat dropdown + level number input. */}
      <div className="flex items-center gap-1">
        <div className="flex shrink-0 gap-0.5">
          {TALISMAN_RARITIES.map(r => {
            const active = loadout.rarity === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => handleRarityChange(r)}
                title={`${r}★`}
                className={`flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                  active ? 'bg-yellow-500/30 text-yellow-200' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                {r}★
              </button>
            )
          })}
        </div>
        <select
          value={loadout.stat}
          onChange={e => onChange({ ...loadout, stat: e.target.value as TalismanMainStat | '' })}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
        >
          <option value="">{t('tools.damage-calculator.equipment.empty')}</option>
          {TALISMAN_MAIN_STATS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className={`flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wider ${disabled || isLevelLocked ? 'text-zinc-700' : 'text-zinc-500'}`}>
          {t('tools.damage-calculator.target.lv_prefix')}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={maxLevel}
            step={1}
            value={loadout.level}
            disabled={disabled || isLevelLocked}
            onChange={e => {
              const n = parseInt(e.target.value, 10)
              if (Number.isFinite(n)) onChange({ ...loadout, level: Math.max(0, Math.min(maxLevel, n)) })
            }}
            className="w-9 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs font-semibold text-zinc-100 tabular-nums focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
      </div>
      {/* Resolved value badge — surfaces the actual stat boost the picker
          will apply to the dealer (e.g. `+15% ATK`). Hidden when no stat
          is picked or the catalog has no matching entry. */}
      {!disabled && resolvedValue != null && (
        <div className="flex items-center justify-end text-[10px]">
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300 tabular-nums">
            +{resolvedValue}% {talismanDisplayLabel(loadout.stat)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Class-conditional signature gear row ─────────────────────────────────────

function SignatureRow({
  enabled,
  tier,
  icon,
  label,
  onToggle,
  onTier,
  children,
}: {
  enabled: boolean
  tier: number
  icon: string
  label: string
  onToggle: (v: boolean) => void
  onTier: (v: number) => void
  children?: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 rounded border p-2 transition-colors ${enabled ? 'border-amber-500/40 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950'}`}>
      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          className="h-3.5 w-3.5 shrink-0 rounded border-zinc-700 bg-zinc-800"
        />
        <Image
          src={icon}
          alt={label}
          width={20}
          height={20}
          className={`shrink-0 ${enabled ? '' : 'opacity-40 saturate-0'}`}
        />
        <span className={`flex-1 truncate text-[11px] font-semibold ${enabled ? 'text-amber-300' : 'text-zinc-500'}`}>{label}</span>
        <TierInput value={tier} disabled={!enabled} onChange={onTier} />
      </label>
      {enabled && children}
    </div>
  )
}

function TierInput({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">T</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={4}
        step={1}
        value={value}
        disabled={disabled}
        onChange={e => {
          const n = parseInt(e.target.value, 10)
          if (Number.isFinite(n)) onChange(Math.max(0, Math.min(4, n)))
        }}
        className="w-8 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs font-semibold text-zinc-100 tabular-nums focus:border-blue-500 focus:outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  )
}

function DefenderDefField({
  value,
  onChange,
  t,
}: {
  value: number
  onChange: (v: number) => void
  t: TFunction
}) {
  return (
    <label className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
      <Image
        src="/images/ui/effect/CM_Stat_Icon_DEF.webp"
        alt="DEF"
        width={14}
        height={14}
        className="shrink-0 opacity-80"
      />
      <span className="w-10 shrink-0 text-[10px] text-zinc-400">{t('tools.damage-calculator.stat.DEF')}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={e => {
          const n = parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0)
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-xs font-semibold text-zinc-100 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  )
}

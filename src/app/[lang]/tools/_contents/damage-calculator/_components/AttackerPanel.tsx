'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import CharacterPortrait from '@/app/components/character/CharacterPortrait'
import { formatEffectText } from '@/lib/format-text'
import { l } from '@/lib/i18n/localize'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { Lang } from '@/lib/i18n/config'
import type { TFunction, TranslationKey } from '@/i18n'
import type {
  DamageCalcCharBuffs,
  DamageCalcCharSummary,
  DamageCalcTranscendCharEntry,
  DamageCalcTranscendFile,
  DamageCalcEquipmentFile,
} from '@/lib/data/damage-calc'
import type { CalcAction } from '../_state/reducer'
import type { AttackerState, ConditionalModifiers, SkillSlot, StatKey } from '../_state/types'
import { STAT_KEYS } from '../_state/types'
import { fetchCharDetail } from '../_lib/fetch-data'
import CharPickerModal from './CharPickerModal'
import TranscendControl from './TranscendControl'
import EquipmentPanel from './EquipmentPanel'
import { ClassIcon, ElementIcon } from './StatBadges'

/**
 * Attacker panel — char picker + stats input + skill controls + transcend.
 *
 * Stats are prefilled from the char's `lv60_ev3` baseline (the typical 6★
 * max-evolution snapshot the in-game character screen displays). The user
 * tweaks individual fields freely — no auto-recompute when transcend tier
 * changes. The tier picker only gates Burst level (T3 → Burst 2, T6 →
 * Burst 3); stat math stays in the user's hands so the calc matches what
 * they actually see in their loadout.
 */

interface Props {
  state: AttackerState
  dispatch: (action: CalcAction) => void
  manifest: DamageCalcCharSummary[]
  transcend: DamageCalcTranscendFile
  equipment: DamageCalcEquipmentFile
  /** Lifted from `CalculatorClient` — also consumed by `ResultPanel` for the
   *  buff catalog that feeds `recompute()`, so loading it once at the parent
   *  avoids duplicate fetches. Null while loading or when no char is picked. */
  charBuffs: DamageCalcCharBuffs | null
  /** Per-stat team contribution (transcend ally bonuses + ally talismans)
   *  surfaced as `(+X)` next to each stat field. Display only — the calc
   *  applies the same deltas at recompute time. Empty record means no
   *  ally is contributing (or no slots are filled). */
  teamDeltaDisplay: Partial<Record<StatKey, number>>
  /** Current cast's target element (`Earth/Water/Fire/Light/Dark`) — drives
   *  EE active/inactive evaluation for `targetElement`-gated rows. Null
   *  when no target is picked. */
  currentTargetElement: string | null
  /** #portal-root resolved client-side; passed down to picker modals. */
  portalElement: HTMLElement | null
  lang: Lang
}

export default function AttackerPanel({ state, dispatch, manifest, transcend, equipment, charBuffs, teamDeltaDisplay, currentTargetElement, portalElement, lang }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedSummary = state.charId ? manifest.find(c => c.id === state.charId) ?? null : null

  // Lazy-load char detail when a char is picked. Race-safe: capture the
  // requested charId locally so the .then() never re-reads the stale prop
  // (and so TypeScript narrowing carries through the async boundary).
  useEffect(() => {
    const requested = state.charId
    if (!requested || state.detail) return
    let cancelled = false
    fetchCharDetail(requested)
      .then(detail => {
        if (cancelled) return
        // Default transStar to the char's MAX reachable tier so the prefilled
        // stats match the in-game character sheet (which assumes max transcend).
        // Falls back to basicStar when no transcend chain exists for the char.
        const transEntry = transcend.byChar[requested]
        const defaultTransStar = transEntry && transEntry.tiers.length > 0
          ? transEntry.tiers[transEntry.tiers.length - 1].transStar
          : (transEntry?.basicStar ?? 0)
        dispatch({ type: 'attacker/detailLoaded', charId: requested, detail, defaultTransStar })
      })
      .catch(err => {
        if (cancelled) return
        // Surface fetch failures — silent failure was masking the prefill bug.
        console.error(`[damage-calc] failed to load char detail for ${requested}:`, err)
        dispatch({ type: 'attacker/detailFailed', charId: requested })
      })
    return () => { cancelled = true }
  }, [state.charId, state.detail, dispatch, transcend])

  const transcendEntry = state.charId ? transcend.byChar[state.charId] : undefined

  return (
    <div className="space-y-3">
      {/* Char header */}
      <CharHeader
        summary={selectedSummary}
        loading={state.loading}
        lang={lang}
        onClick={() => setPickerOpen(true)}
      />

      {/* Stats grid */}
      <StatsGrid
        stats={state.stats}
        dispatch={dispatch}
        disabled={!state.charId}
        scalings={state.detail?.scalings ?? null}
        teamDeltaDisplay={teamDeltaDisplay}
      />

      {/* Skill controls */}
      <SkillControls
        slot={state.skillSlot}
        level={state.skillLevel}
        burstLevel={state.burstLevel}
        crit={state.crit}
        detail={state.detail}
        transcendEntry={transcendEntry ?? null}
        transStar={state.transStar}
        lang={lang}
        dispatch={dispatch}
      />

      {/* Conditional damage modifiers — only renders inputs whose matching
          pool_cond buff exists for the active skill on the picked char. */}
      <ConditionalInputs
        slot={state.skillSlot}
        conditional={state.conditional}
        charBuffs={charBuffs}
        dispatch={dispatch}
      />

      {/* Transcend tier */}
      {transcendEntry && (
        <TranscendControl
          entry={transcendEntry}
          transStar={state.transStar}
          dispatch={dispatch}
        />
      )}

      {/* Equipment passives — 5 slots + EE inline. Per-attacker state.
          `activeSlot` is S1/S2/S3 OR B(N) when burst is active — drives
          the EE row active/inactive eval (CallerSkillType matching). */}
      <EquipmentPanel
        equipment={state.equipment}
        catalog={equipment}
        charId={state.charId}
        charSummary={selectedSummary}
        activeSlot={state.skillSlot === 'S3' && state.burstLevel > 0 ? `B${state.burstLevel}` as 'B1' | 'B2' | 'B3' : state.skillSlot}
        currentTargetElement={currentTargetElement}
        portalElement={portalElement}
        lang={lang}
        dispatch={dispatch}
      />

      {pickerOpen && (
        <CharPickerModal
          chars={manifest}
          selectedId={state.charId}
          lang={lang}
          onPick={charId => dispatch({ type: 'attacker/pickChar', charId })}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CharHeader({
  summary,
  loading,
  lang,
  onClick,
}: {
  summary: DamageCalcCharSummary | null
  loading: boolean
  lang: Lang
  onClick: () => void
}) {
  const { t } = useI18n()
  if (!summary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded border border-dashed border-zinc-700 bg-zinc-950 p-3 text-left text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
      >
        <div className="h-12 w-12 rounded bg-zinc-800" />
        <span>{t('tools.damage-calculator.attacker.pick')}</span>
      </button>
    )
  }

  const displayName = l(summary, 'name', lang)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded border border-zinc-700 bg-zinc-950 p-2 text-left transition-colors hover:border-zinc-500"
    >
      <div className="relative shrink-0">
        <CharacterPortrait
          id={summary.id}
          name={displayName}
          size="md"
          showIcons
          showStars
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-zinc-100">{displayName}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
          <ElementIcon element={summary.element} size={12} />
          <span>{summary.element}</span>
          <span className="text-zinc-700">·</span>
          <ClassIcon classLabel={summary.class} size={12} />
          <span>{summary.class}</span>
        </div>
      </div>
      <span className="text-xs text-zinc-500">{t('tools.damage-calculator.common.change')}</span>
    </button>
  )
}

const STAT_ICONS: Record<StatKey, string> = {
  ATK: 'CM_Stat_Icon_ATK',
  DEF: 'CM_Stat_Icon_DEF',
  HP: 'CM_Stat_Icon_HP',
  SPD: 'CM_Stat_Icon_SPEED',
  CHC: 'CM_Stat_Icon_CRITICAL',
  CHD: 'CM_Stat_Icon_CRITICAL_DMG',
  EFF: 'CM_Stat_Icon_CHANCE',
  RES: 'CM_Stat_Icon_RESIST',
  PEN: 'CM_Stat_Icon_PIERCE_POWER',
  DMG_INC: 'CM_Stat_Icon_DMG_INCREASE',
}

const STAT_LABELS: Record<StatKey, string> = {
  ATK: 'ATK', DEF: 'DEF', HP: 'HP', SPD: 'SPD',
  CHC: 'CHC', CHD: 'CHD', EFF: 'EFF', RES: 'RES',
  PEN: 'PEN', DMG_INC: 'DMG↑',
}

/** Stats with `%` suffix in the input row. EFF/RES are intentionally
 *  excluded — they're flat values (matching the in-game character sheet
 *  + monster stat block), even though they index into percent-rate buffs
 *  internally via `floor(base × value/1000)`. */
const PERCENT_STATS = new Set<StatKey>(['CHC', 'CHD', 'PEN', 'DMG_INC'])

function StatsGrid({
  stats,
  dispatch,
  disabled,
  scalings,
  teamDeltaDisplay,
}: {
  stats: AttackerState['stats']
  dispatch: (a: CalcAction) => void
  disabled: boolean
  scalings: AttackerState['detail'] extends infer D ? (D extends { scalings: infer S } ? S : null) : null
  teamDeltaDisplay: Partial<Record<StatKey, number>>
}) {
  const { t } = useI18n()
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t('tools.damage-calculator.stat.label')}</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'attacker/resetStats' })}
          disabled={disabled}
          className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('tools.damage-calculator.common.reset')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {STAT_KEYS.map(key => {
          const role: ScalingRole = !scalings
            ? 'none'
            : scalings.main === key
              ? 'main'
              : scalings.secondaries.includes(key)
                ? 'secondary'
                : 'none'
          return (
            <StatField
              key={key}
              statKey={key}
              value={stats[key]}
              disabled={disabled}
              role={role}
              teamDelta={teamDeltaDisplay[key] ?? 0}
              t={t}
              onChange={v => dispatch({ type: 'attacker/setStat', key, value: v })}
            />
          )
        })}
      </div>
    </div>
  )
}

type ScalingRole = 'none' | 'main' | 'secondary'

/** Per-role styling — main pops in amber, secondary in a softer blue. */
const ROLE_CONTAINER: Record<ScalingRole, string> = {
  none:      'border-zinc-800 bg-zinc-950',
  main:      'border-amber-400 bg-amber-500/15 ring-2 ring-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
  secondary: 'border-sky-400 bg-sky-500/12 ring-1 ring-sky-500/40',
}
const ROLE_LABEL: Record<ScalingRole, string> = {
  none:      'text-zinc-400',
  main:      'text-amber-200 font-bold uppercase',
  secondary: 'text-sky-200 font-bold uppercase',
}
const ROLE_ICON_OPACITY: Record<ScalingRole, string> = {
  none:      'opacity-80',
  main:      'opacity-100 drop-shadow-[0_0_4px_rgba(245,158,11,0.6)]',
  secondary: 'opacity-100 drop-shadow-[0_0_3px_rgba(56,189,248,0.5)]',
}

function StatField({
  statKey,
  value,
  disabled,
  role,
  teamDelta,
  t,
  onChange,
}: {
  statKey: StatKey
  value: number
  disabled: boolean
  role: ScalingRole
  /** Team-contribution delta surfaced as `(+X)` next to the stat value.
   *  Zero = nothing to show. The dealer's input still holds the BASE value
   *  (1:1 with the in-game character sheet); the calc applies the delta. */
  teamDelta: number
  t: TFunction
  onChange: (v: number) => void
}) {
  const isPct = PERCENT_STATS.has(statKey)
  const titleHover =
    role === 'main' ? t('tools.damage-calculator.attacker.scaling_main')
    : role === 'secondary' ? t('tools.damage-calculator.attacker.scaling_secondary')
    : undefined

  return (
    <label
      className={`flex items-center gap-1.5 rounded border px-2 py-1 transition-colors ${ROLE_CONTAINER[role]}`}
      title={titleHover}
    >
      <Image
        src={`/images/ui/effect/${STAT_ICONS[statKey]}.webp`}
        alt={statKey}
        width={16}
        height={16}
        className={`shrink-0 ${ROLE_ICON_OPACITY[role]}`}
      />
      <span className={`w-10 shrink-0 text-[11px] ${ROLE_LABEL[role]}`}>{STAT_LABELS[statKey]}</span>
      <input
        type="number"
        inputMode="decimal"
        // Controlled by the parent — reflects external changes (char pick,
        // reset) immediately. Live commit on every keystroke; the dispatch
        // is cheap and avoids draft/prop desync that would mask the
        // post-pick prefill.
        value={value}
        disabled={disabled}
        onChange={e => {
          const n = parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        // Hide the native spinner arrows — they're cramped in this layout
        // and add noise. Numeric keyboard on mobile via `inputMode`.
        className="min-w-0 flex-1 bg-transparent text-right text-xs font-semibold text-zinc-100 tabular-nums focus:outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
      />
      {isPct && <span className="shrink-0 text-[10px] text-zinc-500">%</span>}
      {teamDelta !== 0 && (
        <span
          className="shrink-0 text-[10px] font-semibold text-emerald-400 tabular-nums"
          title={t('tools.damage-calculator.attacker.team_contribution_hint')}
        >
          (+{teamDelta}{isPct ? '%' : ''})
        </span>
      )}
    </label>
  )
}

const SLOTS: SkillSlot[] = ['S1', 'S2', 'S3']

function SkillControls({
  slot,
  level,
  burstLevel,
  crit,
  detail,
  transcendEntry,
  transStar,
  lang,
  dispatch,
}: {
  slot: SkillSlot
  level: 1 | 2 | 3 | 4 | 5
  burstLevel: 0 | 1 | 2 | 3
  crit: boolean
  detail: AttackerState['detail']
  /** Transcend entry — gates which Burst Lv pills are unlocked. */
  transcendEntry: DamageCalcTranscendCharEntry | null
  transStar: number
  lang: Lang
  dispatch: (a: CalcAction) => void
}) {
  const { t } = useI18n()
  // When burstLevel > 0 AND the active slot is S3, the burst variant
  // replaces S3's DF + name + description for the readout. Falls back to
  // the S3 base when the char has no matching B(N) entry (defensive: won't
  // happen in practice since the picker is gated on data presence).
  const baseSkill = detail?.skills[slotToKey(slot)] ?? null
  const burstKey = burstLevel === 0 ? null : (`B${burstLevel}` as 'B1' | 'B2' | 'B3')
  const burstSkill = burstKey && slot === 'S3' ? detail?.skills[burstKey] ?? null : null
  const skillData = burstSkill ?? baseSkill
  const dfAtLevel = skillData?.damageFactors[level - 1] ?? null
  const skillName = skillData ? l(skillData, 'name', lang) : null
  const desc = baseSkill ? getSkillDescription(baseSkill, level, lang) : ''
  // Burst-specific blurb (different from `desc` which is the S3 base text).
  // Shown under the burst picker so the user sees the cast's extra effect
  // (e.g. "Reduces Dark Devil Dance Cooldown by 2 turns" for B3).
  const burstDesc = burstSkill ? getSkillDescription(burstSkill, 1, lang) : ''

  // Burst Lv 1 / 2 / 3 unlock state — burst2/3 are tier-gated, B1 is
  // available whenever the char actually has a B1 entry baked.
  const burstUnlocks = transcendEntry
    ? resolveBurstUnlocks(transcendEntry, transStar)
    : { b1: false, b2: false, b3: false }
  const charHasBursts = !!(detail?.skills.B1 || detail?.skills.B2 || detail?.skills.B3)

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
      {/* Slot icons — same image source as the character page's SkillCard. */}
      <div className="flex items-center justify-center gap-2">
        {SLOTS.map(s => {
          const sk = detail?.skills[slotToKey(s)]
          const hasFactors = sk?.damageFactors.some(f => f != null) ?? false
          const active = slot === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => dispatch({ type: 'attacker/setSkillSlot', slot: s })}
              disabled={!detail || !hasFactors}
              title={sk ? l(sk, 'name', lang) : s}
              className={[
                'relative flex h-12 w-12 items-center justify-center rounded-lg border transition-all',
                active ? 'border-blue-400 bg-blue-500/15 ring-2 ring-blue-500/40' : 'border-zinc-700 bg-zinc-900',
                hasFactors && !active ? 'hover:border-zinc-500 hover:bg-zinc-800' : '',
                !hasFactors ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].filter(Boolean).join(' ')}
            >
              {sk ? (
                <Image
                  src={skillIconUrl(sk.iconName)}
                  alt={l(sk, 'name', lang)}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              ) : (
                <span className="text-xs font-semibold text-zinc-500">{s}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Burst Lv picker — only relevant when S3 is active and the char has
          burst variants. Each pill is gated by the dealer's transcend tier. */}
      {slot === 'S3' && charHasBursts && (
        <div className="flex items-center justify-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            {t('tools.damage-calculator.attacker.burst_label')}
          </span>
          <BurstPill
            level={0}
            active={burstLevel === 0}
            unlocked
            label={t('tools.damage-calculator.attacker.burst_off')}
            onClick={() => dispatch({ type: 'attacker/setBurstLevel', level: 0 })}
          />
          <BurstPill
            level={1}
            active={burstLevel === 1}
            unlocked={burstUnlocks.b1 && !!detail?.skills.B1}
            onClick={() => dispatch({ type: 'attacker/setBurstLevel', level: 1 })}
          />
          <BurstPill
            level={2}
            active={burstLevel === 2}
            unlocked={burstUnlocks.b2 && !!detail?.skills.B2}
            onClick={() => dispatch({ type: 'attacker/setBurstLevel', level: 2 })}
          />
          <BurstPill
            level={3}
            active={burstLevel === 3}
            unlocked={burstUnlocks.b3 && !!detail?.skills.B3}
            onClick={() => dispatch({ type: 'attacker/setBurstLevel', level: 3 })}
          />
        </div>
      )}

      {/* Burst description — shown under the picker when the burst is
          active and the bake provides text for it. Sits BEFORE the skill
          name + DF readout so the burst's effect is the visible focus. */}
      {slot === 'S3' && burstSkill && burstDesc && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-1.5 text-[11px] leading-relaxed text-amber-200">
          <span className="mr-1 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            Burst Lv {burstLevel}
          </span>
          {formatEffectText(burstDesc)}
        </div>
      )}

      {/* Skill name + level slider + crit + DF readout */}
      {skillName && (
        <div className="text-center text-sm font-semibold text-zinc-100">{skillName}</div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t('tools.damage-calculator.target.lv_prefix')}</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={level}
          onChange={e => dispatch({ type: 'attacker/setSkillLevel', level: parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5 })}
          disabled={!detail}
          className="flex-1 accent-blue-500"
        />
        <span className="w-8 text-right text-xs font-semibold text-zinc-100">{level}</span>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          {t('tools.damage-calculator.attacker.df')}: <span className="text-zinc-200 tabular-nums">{dfAtLevel != null ? `${(dfAtLevel / 10).toFixed(1)}%` : '—'}</span>
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-zinc-300">
          <input
            type="checkbox"
            checked={crit}
            onChange={e => dispatch({ type: 'attacker/setCrit', crit: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900"
          />
          <span>{t('tools.damage-calculator.attacker.crit')}</span>
        </label>
      </div>

      {skillData?.additionalAttackRatio != null && (
        <div className="text-[10px] text-zinc-500">
          {t('tools.damage-calculator.attacker.additional_attack')}: <span className="text-zinc-300">+{(skillData.additionalAttackRatio * 100).toFixed(0)}%</span>
        </div>
      )}

      {/* Level-aware description — mirrors the character-page SkillCard. */}
      {desc && (
        <div className="rounded bg-zinc-900 p-2 text-[11px] leading-relaxed text-zinc-200">
          {formatEffectText(desc)}
        </div>
      )}
    </div>
  )
}

function slotToKey(slot: SkillSlot): 'S1' | 'S2' | 'S3' {
  return slot
}

/**
 * Resolve which Burst Lv pills are unlocked for the given transcend tier.
 * Walks every tier ≤ current and OR's the `burst2` / `burst3` flags. B1
 * has no flag — assumed available whenever the char carries a B1 entry
 * (the in-game progression always opens B1 first; tiers without an
 * explicit flag still surface it).
 */
function resolveBurstUnlocks(
  entry: DamageCalcTranscendCharEntry,
  transStar: number,
): { b1: boolean; b2: boolean; b3: boolean } {
  let b2 = false
  let b3 = false
  for (const tier of entry.tiers) {
    if (tier.transStar > transStar) continue
    if (tier.burst2) b2 = true
    if (tier.burst3) b3 = true
  }
  // `b1` is permissive: Burst Lv 1 doesn't have a templet flag — letting
  // the user pick it whenever the char has a baked B1 entry (gating happens
  // at the call site via `!!detail?.skills.B1`).
  return { b1: true, b2, b3 }
}

/** Burst Lv pill — small toggleable badge in the burst picker row. */
function BurstPill({
  level,
  active,
  unlocked,
  label,
  onClick,
}: {
  level: 0 | 1 | 2 | 3
  active: boolean
  unlocked: boolean
  /** Override label — defaults to the level number. Used for the "Off" pill. */
  label?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onClick}
      className={[
        'h-6 min-w-6 rounded px-1.5 text-[10px] font-bold transition-colors',
        active
          ? 'bg-amber-500/30 text-amber-200'
          : 'text-zinc-500',
        !active && unlocked ? 'hover:bg-zinc-900 hover:text-zinc-200' : '',
        !unlocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
      ].filter(Boolean).join(' ')}
    >
      {label ?? level}
    </button>
  )
}

/**
 * Resolve the skill icon path. Mirrors `SkillCard` — core-fusion passive
 * icons live in a different folder (`Skill_CorePassive_*`), everything else
 * in the standard skills directory.
 */
function skillIconUrl(iconName: string): string {
  const folder = iconName.startsWith('Skill_CorePassive') ? 'core-fusion-skill' : 'skills'
  return `/images/characters/${folder}/${iconName}.webp`
}

/**
 * Read the localized description for a given level. Mirrors `SkillCard`'s
 * `getDescription`: English keys are bare ('1', '2', …), other langs use
 * the `_lang` suffix; falls back to English when the locale variant is
 * missing.
 */
function getSkillDescription(
  skill: { descLevels?: Record<string, string> },
  level: 1 | 2 | 3 | 4 | 5,
  lang: Lang,
): string {
  const map = skill.descLevels
  if (!map) return ''
  const key = String(level)
  if (lang === 'en') return map[key] ?? ''
  return map[`${key}_${lang}`] ?? map[key] ?? ''
}

// ── Conditional damage modifiers ─────────────────────────────────────────────

/**
 * Per-conditional-modifier metadata: the matching `pool_cond` key(s) on the
 * buff side, the i18n label key, and whether the input is a percentage
 * (caster/target lost HP) or a count (debuffs, buffs, stacks).
 *
 * Every entry must point at a real `pool_cond` — the picker hides the
 * input when no buff with a matching `poolCond` covers the active skill.
 */
const CONDITIONAL_FIELDS: Array<{
  key: keyof ConditionalModifiers
  poolConds: string[]
  labelKey: TranslationKey
  unit: 'count' | 'pct'
}> = [
  { key: 'targetDebuffs',     poolConds: ['target_debuff'],                    labelKey: 'tools.damage-calculator.attacker.cond.target_debuffs',      unit: 'count' },
  { key: 'enemyTeamDeaths',   poolConds: ['enemy_team_decrease'],              labelKey: 'tools.damage-calculator.attacker.cond.enemy_team_deaths',   unit: 'count' },
  { key: 'targetBuffs',       poolConds: ['target_buff'],                      labelKey: 'tools.damage-calculator.attacker.cond.target_buffs',        unit: 'count' },
  { key: 'teamBuffs',         poolConds: ['team_buff'],                        labelKey: 'tools.damage-calculator.attacker.cond.team_buffs',          unit: 'count' },
  { key: 'casterLostHpPct',   poolConds: ['owner_lost_hp', 'caster_lost_hp'],  labelKey: 'tools.damage-calculator.attacker.cond.caster_lost_hp',      unit: 'pct' },
  { key: 'targetLostHpPct',   poolConds: ['target_lost_hp'],                   labelKey: 'tools.damage-calculator.attacker.cond.target_lost_hp',      unit: 'pct' },
  { key: 'killStacks',        poolConds: ['kill_count_stack'],                 labelKey: 'tools.damage-calculator.attacker.cond.kill_stacks',         unit: 'count' },
]

/**
 * Returns true when the buff trigger's `callerSlots` covers the active slot.
 * The bake stores `callerSlots` either as an array of slot tokens
 * (`['S1', 'S3']`) or the literal string `'all'` — handle both.
 */
function callerSlotsMatch(callerSlots: unknown, slot: SkillSlot): boolean {
  if (callerSlots === 'all') return true
  if (Array.isArray(callerSlots)) return callerSlots.includes(slot)
  return false
}

function ConditionalInputs({
  slot,
  conditional,
  charBuffs,
  dispatch,
}: {
  slot: SkillSlot
  conditional: ConditionalModifiers
  charBuffs: DamageCalcCharBuffs | null
  dispatch: (a: CalcAction) => void
}) {
  const { t } = useI18n()

  // Set of `poolCond` keys that have a matching buff for the active slot.
  // Recomputed when buffs or slot change; cheap (handful of buffs per char).
  const activeConds = useMemo(() => {
    const out = new Set<string>()
    for (const b of charBuffs?.buffs ?? []) {
      const cond = b.effect && 'poolCond' in b.effect ? b.effect.poolCond : undefined
      if (!cond) continue
      if (!callerSlotsMatch(b.trigger?.callerSlots, slot)) continue
      out.add(cond)
    }
    return out
  }, [charBuffs, slot])

  const visibleFields = CONDITIONAL_FIELDS.filter(f => f.poolConds.some(c => activeConds.has(c)))
  if (visibleFields.length === 0) return null

  const anyDirty = visibleFields.some(f => conditional[f.key] !== 0)

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {t('tools.damage-calculator.attacker.cond.label')}
        </span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'attacker/resetConditional' })}
          disabled={!anyDirty}
          className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('tools.damage-calculator.common.reset')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {visibleFields.map(f => (
          <ConditionalField
            key={f.key}
            label={t(f.labelKey)}
            unit={f.unit}
            value={conditional[f.key]}
            onChange={v => dispatch({ type: 'attacker/setConditional', key: f.key, value: v })}
          />
        ))}
      </div>
    </div>
  )
}

function ConditionalField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: 'count' | 'pct'
  value: number
  onChange: (v: number) => void
}) {
  const max = unit === 'pct' ? 100 : 99
  return (
    <label className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400" title={label}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={e => {
          const n = parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0)
        }}
        className="w-12 shrink-0 bg-transparent text-right text-xs font-semibold text-zinc-100 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
      />
      {unit === 'pct' && <span className="shrink-0 text-[10px] text-zinc-500">%</span>}
    </label>
  )
}

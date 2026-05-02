'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import CharacterPortrait from '@/app/components/character/CharacterPortrait'
import { formatEffectText } from '@/lib/format-text'
import { l } from '@/lib/i18n/localize'
import type { Lang } from '@/lib/i18n/config'
import type {
  DamageCalcCharSummary,
  DamageCalcTranscendFile,
} from '@/lib/data/damage-calc'
import type { CalcAction } from '../_state/reducer'
import type { AttackerState, SkillSlot, StatKey } from '../_state/types'
import { STAT_KEYS } from '../_state/types'
import { fetchCharDetail } from '../_lib/fetch-data'
import CharPickerModal from './CharPickerModal'
import TranscendControl from './TranscendControl'

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
  lang: Lang
}

export default function AttackerPanel({ state, dispatch, manifest, transcend, lang }: Props) {
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
      />

      {/* Skill controls */}
      <SkillControls
        slot={state.skillSlot}
        level={state.skillLevel}
        crit={state.crit}
        detail={state.detail}
        lang={lang}
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
  if (!summary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded border border-dashed border-zinc-700 bg-zinc-950 p-3 text-left text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
      >
        <div className="h-12 w-12 rounded bg-zinc-800" />
        <span>Pick an attacker…</span>
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
        <div className="text-[10px] uppercase tracking-wide text-zinc-500">
          {summary.element} · {summary.class}
        </div>
      </div>
      <span className="text-xs text-zinc-500">change</span>
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

/** Stats with `%` suffix in the input row. */
const PERCENT_STATS = new Set<StatKey>(['CHC', 'CHD', 'EFF', 'RES', 'PEN', 'DMG_INC'])

function StatsGrid({
  stats,
  dispatch,
  disabled,
  scalings,
}: {
  stats: AttackerState['stats']
  dispatch: (a: CalcAction) => void
  disabled: boolean
  scalings: AttackerState['detail'] extends infer D ? (D extends { scalings: infer S } ? S : null) : null
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Stats</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'attacker/resetStats' })}
          disabled={disabled}
          className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          reset
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
  onChange,
}: {
  statKey: StatKey
  value: number
  disabled: boolean
  role: ScalingRole
  onChange: (v: number) => void
}) {
  const isPct = PERCENT_STATS.has(statKey)

  return (
    <label
      className={`flex items-center gap-1.5 rounded border px-2 py-1 transition-colors ${ROLE_CONTAINER[role]}`}
      title={role === 'main' ? 'Main scaling stat' : role === 'secondary' ? 'Secondary scaling stat' : undefined}
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
    </label>
  )
}

const SLOTS: SkillSlot[] = ['S1', 'S2', 'S3']

function SkillControls({
  slot,
  level,
  crit,
  detail,
  lang,
  dispatch,
}: {
  slot: SkillSlot
  level: 1 | 2 | 3 | 4 | 5
  crit: boolean
  detail: AttackerState['detail']
  lang: Lang
  dispatch: (a: CalcAction) => void
}) {
  const skillData = detail?.skills[slotToKey(slot)] ?? null
  const dfAtLevel = skillData?.damageFactors[level - 1] ?? null
  const skillName = skillData ? l(skillData, 'name', lang) : null
  const desc = skillData ? getSkillDescription(skillData, level, lang) : ''

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

      {/* Skill name + level slider + crit + DF readout */}
      {skillName && (
        <div className="text-center text-sm font-semibold text-zinc-100">{skillName}</div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Lv</span>
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
          DF: <span className="text-zinc-200 tabular-nums">{dfAtLevel != null ? `${(dfAtLevel / 10).toFixed(1)}%` : '—'}</span>
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-zinc-300">
          <input
            type="checkbox"
            checked={crit}
            onChange={e => dispatch({ type: 'attacker/setCrit', crit: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900"
          />
          <span>Crit</span>
        </label>
      </div>

      {skillData?.additionalAttackRatio != null && (
        <div className="text-[10px] text-zinc-500">
          Additional attack: <span className="text-zinc-300">+{(skillData.additionalAttackRatio * 100).toFixed(0)}%</span>
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


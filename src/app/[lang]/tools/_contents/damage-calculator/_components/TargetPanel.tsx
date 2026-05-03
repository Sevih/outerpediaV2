'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import MonsterPortrait from '@/app/components/character/MonsterPortrait'
import { lRec } from '@/lib/i18n/localize'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { Lang } from '@/lib/i18n/config'
import type {
  DamageCalcMonstersFile,
  DamageCalcModeEntry,
  DamageCalcStageEntry,
  DamageCalcMonsterEntry,
  DamageCalcMonsterStats,
  DamageCalcAwakeningBuffs,
} from '@/lib/data/damage-calc'
import type { BossMechanicState, BossOverride } from '@/lib/damage/v2/boss-overrides'
import type { TFunction, TranslationKey } from '@/i18n'
import type { CalcAction } from '../_state/reducer'
import type { ManualTargetState, SettingsState, TargetState } from '../_state/types'
import {
  MODE_GROUPS,
  classifyMode,
  parseDungeonStage,
} from '../_lib/mode-taxonomy'
import { applyPveDebuffs, computePveBossDebuffs, type PveBossDebuffs } from '../_lib/quirks'
import BossMechanicsPanel from './BossMechanicsPanel'
import { ClassIcon, ElementIcon } from './StatBadges'

const MANUAL_ELEMENTS = ['Fire', 'Water', 'Earth', 'Light', 'Dark'] as const

/**
 * Target panel — Category → Mode → [Season] → [Episode/Dungeon] → Stage →
 * Monster cascade. Mirrors the admin Damage Lab v2 picker so users keep
 * the same muscle memory.
 *
 * The bake (`monsters.json`) ships the same hierarchical shape as the
 * admin's `/api/admin/damage-lab/v2/stages` endpoint — Mode → Stage →
 * Wave → Monster — so the picker logic transfers near-verbatim.
 *
 * Selection identity uses two ids:
 *   - `stageId`   = `DungeonTemplet.ID` (composite of mode + difficulty)
 *   - `monsterId` = `MonsterTemplet.ID`
 * The pair is stable across releases.
 */

interface Props {
  catalog: DamageCalcMonstersFile
  state: TargetState
  /** Awakening catalog — drives PVE quirk debuffs on boss EFF/RES. */
  awakening: DamageCalcAwakeningBuffs
  /** Account settings — `quirks.pve` gates the Counteract Strong Enemies debuffs. */
  settings: SettingsState
  /** Boss-mechanics override for the picked monster (null = no passive). */
  bossOverride: BossOverride | null
  /** Per-mechanic toggle states, keyed by passive `skillId`. */
  bossMechanics: Record<string, BossMechanicState>
  lang: Lang
  dispatch: (action: CalcAction) => void
}

export default function TargetPanel({ catalog, state, awakening, settings, bossOverride, bossMechanics, lang, dispatch }: Props) {
  const { t } = useI18n()
  const modes = catalog.modes

  // ── Cascade state ────────────────────────────────────────────────────
  // `categoryName` holds a `TranslationKey` (or '' for "no selection") —
  // mode-taxonomy emits keys, the picker resolves them via `t()` at render.
  const [categoryName, setCategoryName] = useState<TranslationKey | ''>('')
  const [modeKey, setModeKey] = useState<string>('')
  const [storySeason, setStorySeason] = useState<number | null>(null)
  const [dungeonName, setDungeonName] = useState<string>('')

  // ── Selection ────────────────────────────────────────────────────────
  // `modeKey` is composite (`{rawMode}|{label.en}`) because multiple buckets
  // can share a label — Guild Raid splits MAIN_BOSS/SUB_BOSS, both labelled
  // "Guild Raid" — and we need each to be addressable independently.
  const selectedMode: DamageCalcModeEntry | null = useMemo(
    () => modes.find(m => makeModeKey(m) === modeKey) ?? null,
    [modes, modeKey],
  )
  const selectedStage: DamageCalcStageEntry | null = useMemo(
    () => state.stageId && selectedMode
      ? selectedMode.stages.find(s => s.id === state.stageId) ?? null
      : null,
    [state.stageId, selectedMode],
  )
  const selectedMonster: DamageCalcMonsterEntry | null = useMemo(() => {
    if (!selectedStage || !state.monsterId) return null
    for (const w of selectedStage.waves) {
      const hit = w.monsters.find(m => m.monsterId === state.monsterId)
      if (hit) return hit
    }
    return null
  }, [selectedStage, state.monsterId])

  // ── Hydrate cascade from persisted selection ─────────────────────────
  useEffect(() => {
    if (!state.stageId) return
    let foundMode: DamageCalcModeEntry | null = null
    let foundStage: DamageCalcStageEntry | null = null
    for (const m of modes) {
      const s = m.stages.find(x => x.id === state.stageId)
      if (s) { foundMode = m; foundStage = s; break }
    }
    if (!foundMode || !foundStage) return
    const c = classifyMode(foundMode.mode, foundMode.label.en)
    if (c && c.categoryKey !== categoryName) setCategoryName(c.categoryKey)
    const k = makeModeKey(foundMode)
    if (k !== modeKey) setModeKey(k)
    if (foundStage.season != null && foundStage.season !== storySeason) setStorySeason(foundStage.season)
    const dn = parseDungeonStage(foundStage).dungeonName
    if (dn !== dungeonName) setDungeonName(dn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stageId, modes])

  // ── Categories — ordered by MODE_GROUPS, with empty buckets dropped. ─
  // `categoryKey` / `subKey` carry translation keys so the picker can
  // resolve them via `t()` at render time (see `mode-taxonomy.ts`).
  const groupedModes = useMemo(() => {
    const groups = new Map<TranslationKey, { categoryKey: TranslationKey; entries: { subKey: TranslationKey; mode: DamageCalcModeEntry }[] }>()
    for (const m of modes) {
      const c = classifyMode(m.mode, m.label.en)
      if (!c) continue
      const g = groups.get(c.categoryKey) ?? { categoryKey: c.categoryKey, entries: [] }
      g.entries.push({ subKey: c.subKey, mode: m })
      groups.set(c.categoryKey, g)
    }
    return MODE_GROUPS
      .map(g => groups.get(g.categoryKey))
      .filter(Boolean) as Array<{ categoryKey: TranslationKey; entries: { subKey: TranslationKey; mode: DamageCalcModeEntry }[] }>
  }, [modes])

  const selectedCategoryEntries = useMemo(
    () => groupedModes.find(g => g.categoryKey === categoryName)?.entries ?? [],
    [groupedModes, categoryName],
  )

  // ── Story season layer ──────────────────────────────────────────────
  const isStoryMode = useMemo(
    () => selectedMode?.stages.some(s => s.season != null) ?? false,
    [selectedMode],
  )
  const seasonsForMode = useMemo(() => {
    if (!isStoryMode || !selectedMode) return [] as number[]
    const set = new Set<number>()
    for (const s of selectedMode.stages) if (s.season != null) set.add(s.season)
    return Array.from(set).sort((a, b) => a - b)
  }, [isStoryMode, selectedMode])

  // ── Dungeon (= chapter / episode / sub-area) layer ───────────────────
  const dungeonsForMode = useMemo(() => {
    if (!selectedMode) return [] as Array<{ name: string; season: number | null; episodeNum: number | null; stages: DamageCalcStageEntry[] }>
    const groups = new Map<string, { name: string; season: number | null; episodeNum: number | null; stages: DamageCalcStageEntry[] }>()
    for (const s of selectedMode.stages) {
      const { dungeonName: dn } = parseDungeonStage(s)
      const g = groups.get(dn) ?? { name: dn, season: s.season ?? null, episodeNum: s.episodeNum ?? null, stages: [] }
      g.stages.push(s)
      groups.set(dn, g)
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.episodeNum != null && b.episodeNum != null) return a.episodeNum - b.episodeNum
      return a.name.localeCompare(b.name)
    })
  }, [selectedMode])

  const filteredDungeons = useMemo(() => {
    if (!isStoryMode) return dungeonsForMode
    if (storySeason == null) return [] as typeof dungeonsForMode
    return dungeonsForMode.filter(d => d.season === storySeason)
  }, [dungeonsForMode, isStoryMode, storySeason])

  const selectedDungeonStages = useMemo(
    () => dungeonsForMode.find(d => d.name === dungeonName)?.stages ?? [],
    [dungeonsForMode, dungeonName],
  )

  // Final stages list. When the mode resolves to a single dungeon (most
  // tower modes), skip the Dungeon select and drop straight to Stage.
  const stagesForStageSelect = useMemo(() => {
    if (!selectedMode) return [] as DamageCalcStageEntry[]
    const raw = filteredDungeons.length === 1 ? filteredDungeons[0].stages : selectedDungeonStages
    if (!isStoryMode) return raw
    return [...raw].sort((a, b) => (a.stageNum ?? 0) - (b.stageNum ?? 0))
  }, [selectedMode, filteredDungeons, selectedDungeonStages, isStoryMode])

  // ── Auto-pick when the Stage dropdown has a single entry ─────────────
  // Saves a click on solo-stage modes (e.g. some Special Request entries
  // that ship with one stage per category, or Story episodes filtered to
  // a single boss). Only fires when nothing's already selected so the
  // hydration effect can't fight it.
  useEffect(() => {
    if (state.stageId) return
    if (stagesForStageSelect.length !== 1) return
    dispatch({ type: 'target/pickMonster', stageId: stagesForStageSelect[0].id, monsterId: null })
    // `dispatch` is stable from useReducer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagesForStageSelect, state.stageId])

  // ── Auto-pick when a stage exposes a single distinct monster ─────────
  useEffect(() => {
    if (!selectedStage || state.monsterId) return
    const seen = new Set<string>()
    let pick: DamageCalcMonsterEntry | null = null
    for (const w of selectedStage.waves) {
      for (const m of w.monsters) {
        if (seen.has(m.monsterId)) continue
        seen.add(m.monsterId)
        if (seen.size > 1) return
        pick = m
      }
    }
    if (pick) dispatch({ type: 'target/pickMonster', stageId: selectedStage.id, monsterId: pick.monsterId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, state.monsterId])

  // ── Handlers ─────────────────────────────────────────────────────────
  function handleSelectCategory(category: string) {
    // The select's `value` round-trips through the DOM as a plain string;
    // narrow it back to a `TranslationKey` by looking up against the typed
    // `MODE_GROUPS`. Unknown values (shouldn't happen in practice) clear.
    const matched = MODE_GROUPS.find(g => g.categoryKey === category)?.categoryKey
    setCategoryName(matched ?? '')
    setStorySeason(null)
    setDungeonName('')
    setModeKey('')
    dispatch({ type: 'target/pickMonster', stageId: null, monsterId: null })
    if (!matched) return
    const group = groupedModes.find(g => g.categoryKey === matched)
    if (group && group.entries.length === 1) setModeKey(makeModeKey(group.entries[0].mode))
  }

  function handleSelectMode(label: string) {
    setStorySeason(null)
    setDungeonName('')
    setModeKey(label)
    dispatch({ type: 'target/pickMonster', stageId: null, monsterId: null })
  }

  function handleSelectSeason(value: string) {
    const s = value === '' ? null : parseInt(value, 10)
    setStorySeason(Number.isFinite(s as number) ? (s as number) : null)
    setDungeonName('')
    if (state.stageId) dispatch({ type: 'target/pickMonster', stageId: null, monsterId: null })
  }

  function handleSelectDungeon(name: string) {
    setDungeonName(name)
    if (state.stageId) dispatch({ type: 'target/pickMonster', stageId: null, monsterId: null })
  }

  function handleSelectStage(id: string) {
    dispatch({ type: 'target/pickMonster', stageId: id || null, monsterId: null })
  }

  function handleSelectMonster(stageId: string, monsterId: string) {
    dispatch({ type: 'target/pickMonster', stageId, monsterId })
  }

  // ── Render ───────────────────────────────────────────────────────────
  const stageDisabled = !modeKey
                     || (isStoryMode && storySeason == null)
                     || (filteredDungeons.length > 1 && !dungeonName)
                     || stagesForStageSelect.length === 0
  const lvPrefix = t('tools.damage-calculator.target.lv_prefix')

  // ── Manual mode plumbing ─────────────────────────────────────────────
  // PVE debuffs in manual mode key off the user-set boss flag — same gate
  // as the cascade (boss-only awakening triggers).
  const manualPveDebuffs = computePveBossDebuffs(awakening, settings, state.manual.isBoss)
  const manualSeed = useMemo<ManualTargetState | null>(() => {
    if (!selectedMonster || !selectedStage) return null
    return {
      isBoss: selectedMonster.isBoss,
      element: selectedMonster.element,
      stats: { ...selectedMonster.stats },
    }
  }, [selectedMonster, selectedStage])

  if (state.mode === 'manual') {
    return (
      <div className="space-y-3">
        <ModeTabs mode={state.mode} t={t} dispatch={dispatch} />
        <ManualForm
          manual={state.manual}
          dispatch={dispatch}
          t={t}
          seedFromCascade={manualSeed}
          pveDebuffs={manualPveDebuffs}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ModeTabs mode={state.mode} t={t} dispatch={dispatch} />
      <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
        <Field label={t('tools.damage-calculator.target.category')}>
          <select
            value={categoryName}
            onChange={e => handleSelectCategory(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="">{t('tools.damage-calculator.common.select')}</option>
            {groupedModes.map(g => (
              <option key={g.categoryKey} value={g.categoryKey}>{t(g.categoryKey)}</option>
            ))}
          </select>
        </Field>

        {categoryName && selectedCategoryEntries.length > 1 && (
          <Field label={t('tools.damage-calculator.target.mode')}>
            <select
              value={modeKey}
              onChange={e => handleSelectMode(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="">{t('tools.damage-calculator.common.select')}</option>
              {selectedCategoryEntries.map(e => {
                const k = makeModeKey(e.mode)
                return (
                  <option key={k} value={k}>
                    {t(e.subKey)} ({e.mode.stages.length})
                  </option>
                )
              })}
            </select>
          </Field>
        )}

        {selectedMode && isStoryMode && seasonsForMode.length > 1 && (
          <Field label={t('tools.damage-calculator.target.season')}>
            <select
              value={storySeason ?? ''}
              onChange={e => handleSelectSeason(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="">{t('tools.damage-calculator.common.select')}</option>
              {seasonsForMode.map(s => (
                <option key={s} value={s}>{t('tools.damage-calculator.target.season_label', { n: s })}</option>
              ))}
            </select>
          </Field>
        )}

        {selectedMode && filteredDungeons.length > 1 && (!isStoryMode || storySeason != null) && (
          <Field label={`${isStoryMode ? t('tools.damage-calculator.target.episode') : t('tools.damage-calculator.target.dungeon')} (${filteredDungeons.length})`}>
            <select
              value={dungeonName}
              onChange={e => handleSelectDungeon(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="">{t('tools.damage-calculator.common.select')}</option>
              {filteredDungeons.map(d => (
                <option key={d.name} value={d.name}>{d.name} ({d.stages.length})</option>
              ))}
            </select>
          </Field>
        )}

        <Field label={`${t('tools.damage-calculator.target.stage')}${stagesForStageSelect.length > 0 ? ` (${stagesForStageSelect.length})` : ''}`}>
          <select
            value={state.stageId ?? ''}
            onChange={e => handleSelectStage(e.target.value)}
            disabled={stageDisabled}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <option value="">{t('tools.damage-calculator.common.select')}</option>
            {stagesForStageSelect.map(s => {
              const { stagePart } = parseDungeonStage(s)
              const baseName = lRec(s.name, lang)
              // Story: append the storyline title in parens (carries info
              // beyond the `1-12` shorthand). Otherwise just the stage part.
              const suffix = isStoryMode && baseName && baseName !== stagePart ? ` (${baseName})` : ''
              return (
                <option key={s.id} value={s.id}>
                  {s.recommendLevel > 0 ? `[${lvPrefix}${s.recommendLevel}] ` : ''}{stagePart}{suffix}
                </option>
              )
            })}
          </select>
        </Field>
      </div>

      {/* Wave / Monster picker — one section per wave (Fight 1 / 2 / …). */}
      {selectedStage && selectedStage.waves.length > 0 && (
        <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
          {selectedStage.waves.map((w, i) => (
            <div key={w.position}>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {t('tools.damage-calculator.target.fight', { n: i + 1 })} ({w.monsters.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {w.monsters.map(m => {
                  const isSel = state.monsterId === m.monsterId
                  return (
                    <button
                      key={`${m.monsterId}@${m.level}@${w.position}`}
                      type="button"
                      onClick={() => handleSelectMonster(selectedStage.id, m.monsterId)}
                      title={`${m.isBoss ? '★ ' : ''}${lvPrefix}${m.level} · ${lRec(m.name, lang)} (${m.element}/${m.class})`}
                      className={`rounded-lg outline-none transition ${isSel ? '' : 'opacity-60 hover:opacity-100'}`}
                    >
                      <MonsterPortrait
                        faceIconId={m.faceIconId}
                        name={lRec(m.name, lang)}
                        element={m.element}
                        classType={m.class}
                        type={m.type}
                        basicStar={m.basicStar}
                        level={m.level}
                        isBoss={m.isBoss}
                        size="md"
                        showIcons
                        showStars
                        showLevel
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected monster card — shows the full stat block for damage formula context. */}
      {selectedMonster && selectedStage && (
        <MonsterCard
          entry={selectedMonster}
          stage={selectedStage}
          mode={selectedMode!}
          lang={lang}
          t={t}
          pveDebuffs={computePveBossDebuffs(awakening, settings, selectedMonster.isBoss)}
        />
      )}

      {/* Boss mechanics — toggle each passive on/off. Hidden when the picked
          monster has no damage-relevant passive (override === null). */}
      <BossMechanicsPanel
        override={bossOverride}
        state={bossMechanics}
        dispatch={dispatch}
      />
    </div>
  )
}

// ── Selected monster card + stat readouts ──────────────────────────────────

function MonsterCard({
  entry,
  stage,
  mode,
  lang,
  t,
  pveDebuffs,
}: {
  entry: DamageCalcMonsterEntry
  stage: DamageCalcStageEntry
  mode: DamageCalcModeEntry
  lang: Lang
  t: TFunction
  /** Caster-side PVE EFF/RES debuffs to apply for display. {0,0} = no adjustment. */
  pveDebuffs: PveBossDebuffs
}) {
  // Apply PVE debuffs to the displayed stat block. Only `eff`/`res` change;
  // other fields pass through unchanged.
  const stats = applyPveDebuffs(entry.stats, pveDebuffs)
  const pveActive = pveDebuffs.effPermille !== 0 || pveDebuffs.resPermille !== 0
  return (
    <div className="space-y-2 rounded border border-emerald-500/40 bg-emerald-500/5 p-2">
      <div className="flex items-start gap-2">
        <MonsterPortrait
          faceIconId={entry.faceIconId}
          name={lRec(entry.name, lang)}
          element={entry.element}
          classType={entry.class}
          type={entry.type}
          basicStar={entry.basicStar}
          level={entry.level}
          isBoss={entry.isBoss}
          size="md"
          showIcons
          showStars
          showLevel
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-100">{lRec(entry.name, lang)}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
            <ElementIcon element={entry.element} size={12} />
            <span>{entry.element}</span>
            <span className="text-zinc-700">·</span>
            <ClassIcon classLabel={entry.class} size={12} />
            <span>{entry.class}</span>
            {entry.isBoss && (
              <span className="ml-1 rounded bg-amber-500/20 px-1 py-px text-[8px] font-bold text-amber-300">
                {t('tools.damage-calculator.target.boss_badge')}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-zinc-400">
            {lRec(mode.label, lang)} · {lRec(stage.name, lang)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-xs">
        <StatReadout label={t('tools.damage-calculator.stat.HP')}      value={stats.hp.toLocaleString()} />
        <StatReadout label={t('tools.damage-calculator.stat.ATK')}     value={stats.atk.toLocaleString()} />
        <StatReadout label={t('tools.damage-calculator.stat.DEF')}     value={stats.def.toLocaleString()} />
        <StatReadout label={t('tools.damage-calculator.stat.SPD')}     value={stats.spd.toLocaleString()} />
        <StatReadout label={t('tools.damage-calculator.stat.CHC')}     value={`${stats.chc.toFixed(1)}%`} />
        <StatReadout label={t('tools.damage-calculator.stat.CHD')}     value={`${stats.chd.toFixed(1)}%`} />
        <StatReadout label={t('tools.damage-calculator.stat.PEN')}     value={`${stats.pen.toFixed(1)}%`} />
        <StatReadout label={t('tools.damage-calculator.stat.DR')}      value={`${stats.dmgRed.toFixed(1)}%`} />
        <StatReadout label={t('tools.damage-calculator.stat.DMG_INC')} value={`${stats.dmgInc.toFixed(1)}%`} />
        <StatReadout
          label={t('tools.damage-calculator.stat.EFF')}
          value={stats.eff.toLocaleString()}
          adjusted={pveActive && entry.stats.eff !== stats.eff ? entry.stats.eff.toLocaleString() : null}
        />
        <StatReadout
          label={t('tools.damage-calculator.stat.RES')}
          value={stats.res.toLocaleString()}
          adjusted={pveActive && entry.stats.res !== stats.res ? entry.stats.res.toLocaleString() : null}
        />
      </div>

      {pveActive && (
        <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
          <span className="rounded bg-amber-500/30 px-1 py-px font-bold uppercase tracking-wide">PVE</span>
          <span>
            {t('tools.damage-calculator.target.pve_label')} — {t('tools.damage-calculator.stat.EFF')} {fmtPermille(pveDebuffs.effPermille)} · {t('tools.damage-calculator.stat.RES')} {fmtPermille(pveDebuffs.resPermille)}
          </span>
        </div>
      )}
    </div>
  )
}

function StatReadout({
  label,
  value,
  adjusted = null,
}: {
  label: string
  value: string
  /** When set, displays as `<adjusted struck-through> → value` to flag a runtime modifier (PVE). */
  adjusted?: string | null
}) {
  return (
    <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="font-semibold tabular-nums">
        {adjusted && (
          <span className="mr-1 text-[10px] text-zinc-500 line-through">{adjusted}</span>
        )}
        <span className={adjusted ? 'text-amber-300' : 'text-zinc-100'}>{value}</span>
      </span>
    </div>
  )
}

/** Format a signed per-mille value as `±N.N%` (e.g. -200 → "−20.0%"). */
function fmtPermille(p: number): string {
  if (p === 0) return '0%'
  const pct = p / 10
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
}

/**
 * Composite identifier for a mode bucket. The bake can produce two
 * buckets sharing a label.en (Guild Raid main vs sub boss) — keying on
 * label alone collapses them. Pairing rawMode + label gives every bucket
 * a unique handle without leaking the raw token into the visible UI.
 */
function makeModeKey(m: DamageCalcModeEntry): string {
  return `${m.mode}|${m.label.en}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

// ── Mode tabs ──────────────────────────────────────────────────────────────

function ModeTabs({
  mode,
  t,
  dispatch,
}: {
  mode: 'cascade' | 'manual'
  t: TFunction
  dispatch: (a: CalcAction) => void
}) {
  const tabs: Array<{ value: 'cascade' | 'manual'; label: string }> = [
    { value: 'cascade', label: t('tools.damage-calculator.target.tab.cascade') },
    { value: 'manual',  label: t('tools.damage-calculator.target.tab.manual') },
  ]
  return (
    <div className="flex gap-1 rounded border border-zinc-800 bg-zinc-950 p-1">
      {tabs.map(({ value, label }) => {
        const active = mode === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => dispatch({ type: 'target/setMode', mode: value })}
            className={`flex-1 rounded px-2 py-1 text-xs font-semibold uppercase tracking-wider transition ${
              active
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Manual form ────────────────────────────────────────────────────────────

/** Stat icon basenames — same convention as the AttackerPanel `STAT_ICONS`. */
const MANUAL_STAT_ICONS: Record<keyof DamageCalcMonsterStats, string> = {
  hp:     'CM_Stat_Icon_HP',
  atk:    'CM_Stat_Icon_ATK',
  def:    'CM_Stat_Icon_DEF',
  spd:    'CM_Stat_Icon_SPEED',
  chc:    'CM_Stat_Icon_CRITICAL',
  chd:    'CM_Stat_Icon_CRITICAL_DMG',
  pen:    'CM_Stat_Icon_PIERCE_POWER',
  dmgInc: 'CM_Stat_Icon_DMG_INCREASE',
  dmgRed: 'CM_Stat_Icon_ENEMY_DMG_REDUCE',
  eff:    'CM_Stat_Icon_CHANCE',
  res:    'CM_Stat_Icon_RESIST',
}

/** Stats displayed with a `%` suffix in the input row. EFF/RES are flat. */
const MANUAL_PCT_STATS = new Set<keyof DamageCalcMonsterStats>(['chc', 'chd', 'pen', 'dmgInc', 'dmgRed'])

const MANUAL_STAT_ORDER: Array<keyof DamageCalcMonsterStats> = [
  'atk', 'def', 'hp', 'spd', 'chc', 'chd', 'eff', 'res', 'pen', 'dmgInc', 'dmgRed',
]

function ManualForm({
  manual,
  dispatch,
  t,
  seedFromCascade,
  pveDebuffs,
}: {
  manual: ManualTargetState
  dispatch: (a: CalcAction) => void
  t: TFunction
  /** When non-null, surfaces a "Copy from selected" shortcut. */
  seedFromCascade: ManualTargetState | null
  /** Active PVE caster debuffs — drives the EFF/RES adjusted-value badge + banner. */
  pveDebuffs: PveBossDebuffs
}) {
  const setField = (key: 'isBoss' | 'element', value: boolean | string) =>
    dispatch({ type: 'target/setManualField', key, value })
  const setStat = (key: keyof DamageCalcMonsterStats, value: number) =>
    dispatch({ type: 'target/setManualStat', key, value })

  const adjusted = applyPveDebuffs(manual.stats, pveDebuffs)
  const pveActive = pveDebuffs.effPermille !== 0 || pveDebuffs.resPermille !== 0

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2">
      {/* Element + Boss row + actions */}
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('tools.damage-calculator.target.manual.element')}>
          <select
            value={manual.element}
            onChange={e => setField('element', e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            {MANUAL_ELEMENTS.map(el => (
              <option key={el} value={el}>{el}</option>
            ))}
          </select>
        </Field>
        <label className="flex h-7.5 cursor-pointer items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100">
          <input
            type="checkbox"
            checked={manual.isBoss}
            onChange={e => setField('isBoss', e.target.checked)}
            className="h-3.5 w-3.5 accent-emerald-500"
          />
          <span className="text-xs">{t('tools.damage-calculator.target.boss_badge')}</span>
        </label>
        <div className="ml-auto flex items-center gap-2">
          {seedFromCascade && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'target/seedManual', manual: seedFromCascade })}
              className="text-[10px] text-emerald-300 transition-colors hover:text-emerald-200"
            >
              {t('tools.damage-calculator.target.manual.copy_from_selected')}
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: 'target/resetManual' })}
            className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {t('tools.damage-calculator.common.reset')}
          </button>
        </div>
      </div>

      {/* Stat grid — same StatField shape as the Damage Dealer panel. */}
      <div className="grid grid-cols-2 gap-1.5">
        {MANUAL_STAT_ORDER.map(key => {
          const adj =
            key === 'eff' && pveActive && manual.stats.eff !== adjusted.eff ? adjusted.eff
            : key === 'res' && pveActive && manual.stats.res !== adjusted.res ? adjusted.res
            : null
          return (
            <ManualStatField
              key={key}
              statKey={key}
              value={manual.stats[key]}
              adjusted={adj}
              onChange={v => setStat(key, v)}
            />
          )
        })}
      </div>

      {pveActive && (
        <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
          <span className="rounded bg-amber-500/30 px-1 py-px font-bold uppercase tracking-wide">PVE</span>
          <span>
            {t('tools.damage-calculator.target.pve_label')} — {t('tools.damage-calculator.stat.EFF')} {fmtPermille(pveDebuffs.effPermille)} · {t('tools.damage-calculator.stat.RES')} {fmtPermille(pveDebuffs.resPermille)}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Single editable stat row — icon + label + number input + optional `%`
 * suffix. Mirrors the AttackerPanel `StatField` (same icon set, same
 * appearance:textfield + native-spinner-stripping). When PVE debuffs adjust
 * the value (EFF/RES on bosses), the original is shown struck-through to
 * the right of the input.
 */
function ManualStatField({
  statKey,
  value,
  adjusted,
  onChange,
}: {
  statKey: keyof DamageCalcMonsterStats
  value: number
  /** PVE-adjusted value when present — rendered as a strikethrough hint after the input. */
  adjusted: number | null
  onChange: (v: number) => void
}) {
  const isPct = MANUAL_PCT_STATS.has(statKey)
  return (
    <label className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 transition-colors">
      <NextImageStatIcon name={MANUAL_STAT_ICONS[statKey]} alt={statKey} />
      <span className="w-10 shrink-0 text-[11px] text-zinc-400">{MANUAL_STAT_LABELS[statKey]}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={isPct ? 0.1 : 1}
        value={value}
        onChange={e => {
          const n = parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-xs font-semibold text-zinc-100 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
      />
      {isPct && <span className="shrink-0 text-[10px] text-zinc-500">%</span>}
      {adjusted != null && (
        <span className="shrink-0 text-[10px] text-amber-300" title="PVE-adjusted">→ {adjusted.toLocaleString()}</span>
      )}
    </label>
  )
}

const MANUAL_STAT_LABELS: Record<keyof DamageCalcMonsterStats, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD',
  chc: 'CHC', chd: 'CHD', pen: 'PEN',
  dmgInc: 'DMG↑', dmgRed: 'DR',
  eff: 'EFF', res: 'RES',
}

function NextImageStatIcon({ name, alt }: { name: string; alt: string }) {
  // Re-using the AttackerPanel icon convention: 16×16 webp under /images/ui/effect.
  return (
    <Image
      src={`/images/ui/effect/${name}.webp`}
      alt={alt}
      width={16}
      height={16}
      className="shrink-0 opacity-80"
    />
  )
}

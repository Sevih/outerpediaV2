'use client'

import { useEffect, useMemo, useState } from 'react'
import MonsterPortrait from '@/app/components/character/MonsterPortrait'
import type { ModeEntry, StageEntry } from '../_api/monsters'
import type { MonsterOption } from '../_state/types'
import { MODE_GROUPS, classifyMode, parseDungeonStage } from '../_state/mode-taxonomy'

interface MonsterPickerProps {
  modeEntries: ModeEntry[]
  /** User-facing mode label (matches `ModeEntry.label`). */
  selectedMode: string
  selectedStageId: string | null
  selectedMonsterId: string | null
  onSelectMode: (label: string) => void
  onSelectStage: (stageId: string) => void
  onSelectMonster: (monster: MonsterOption) => void
}

/**
 * 6-level cascade picker — Category → Mode → [Season] → Dungeon → Stage →
 * Monster. Mirrors the v1 page picker so users keep their muscle memory.
 *
 * Category / season / dungeon are derived from the mode + stageId selections
 * but kept in local state so partial selections (e.g. user picks Story but
 * hasn't chosen Normal/Hard yet) don't collapse back to the empty cascade.
 */
export function MonsterPicker({
  modeEntries,
  selectedMode, selectedStageId, selectedMonsterId,
  onSelectMode, onSelectStage, onSelectMonster,
}: MonsterPickerProps) {
  // ── Categories ───────────────────────────────────────────────────────
  const groupedModes = useMemo(() => {
    const groups = new Map<string, { category: string; entries: { sub: string; mode: ModeEntry }[] }>()
    for (const m of modeEntries) {
      const c = classifyMode(m)
      if (!c) continue
      const g = groups.get(c.category) ?? { category: c.category, entries: [] }
      g.entries.push({ sub: c.sub, mode: m })
      groups.set(c.category, g)
    }
    return MODE_GROUPS
      .map(g => groups.get(g.category))
      .filter(Boolean) as Array<{ category: string; entries: { sub: string; mode: ModeEntry }[] }>
  }, [modeEntries])

  const selectedModeEntry = useMemo(
    () => modeEntries.find(m => m.label === selectedMode) ?? null,
    [modeEntries, selectedMode],
  )

  const [categoryName, setCategoryName] = useState('')
  // Sync category from selectedMode (handles initial hydration + loadFromObs).
  // Only fires when selectedMode is set, so picking a category without a
  // sub-mode yet doesn't get clobbered.
  useEffect(() => {
    if (!selectedMode) return
    const m = modeEntries.find(mm => mm.label === selectedMode)
    if (!m) return
    const c = classifyMode(m)
    if (c && c.category !== categoryName) setCategoryName(c.category)
  }, [selectedMode, modeEntries, categoryName])

  const selectedCategoryEntries = useMemo(
    () => groupedModes.find(g => g.category === categoryName)?.entries ?? [],
    [groupedModes, categoryName],
  )

  // ── Story season ─────────────────────────────────────────────────────
  const isStoryMode = useMemo(
    () => selectedModeEntry?.stages.some(s => s.season != null) ?? false,
    [selectedModeEntry],
  )
  const seasonsForMode = useMemo(() => {
    if (!isStoryMode || !selectedModeEntry) return [] as number[]
    const set = new Set<number>()
    for (const s of selectedModeEntry.stages) if (s.season != null) set.add(s.season)
    return Array.from(set).sort((a, b) => a - b)
  }, [isStoryMode, selectedModeEntry])
  const [storySeason, setStorySeason] = useState<number | null>(null)
  useEffect(() => {
    if (!selectedModeEntry || !selectedStageId) return
    const stage = selectedModeEntry.stages.find(s => s.id === selectedStageId)
    if (!stage || stage.season == null) return
    if (stage.season !== storySeason) setStorySeason(stage.season)
  }, [selectedModeEntry, selectedStageId, storySeason])

  // ── Dungeons ─────────────────────────────────────────────────────────
  const dungeonsForMode = useMemo(() => {
    if (!selectedModeEntry) {
      return [] as Array<{ name: string; season: number | null; episodeNum: number | null; stages: StageEntry[] }>
    }
    const groups = new Map<string, { name: string; season: number | null; episodeNum: number | null; stages: StageEntry[] }>()
    for (const s of selectedModeEntry.stages) {
      const { dungeonName } = parseDungeonStage(s)
      const g = groups.get(dungeonName) ?? { name: dungeonName, season: s.season ?? null, episodeNum: s.episodeNum ?? null, stages: [] }
      g.stages.push(s)
      groups.set(dungeonName, g)
    }
    return Array.from(groups.values()).sort((a, b) => {
      // Story: by episode number; everything else: alphabetic.
      if (a.episodeNum != null && b.episodeNum != null) return a.episodeNum - b.episodeNum
      return a.name.localeCompare(b.name)
    })
  }, [selectedModeEntry])

  const filteredDungeons = useMemo(() => {
    if (!isStoryMode) return dungeonsForMode
    if (storySeason == null) return [] as typeof dungeonsForMode
    return dungeonsForMode.filter(d => d.season === storySeason)
  }, [dungeonsForMode, isStoryMode, storySeason])

  const [dungeonName, setDungeonName] = useState('')
  useEffect(() => {
    if (!selectedModeEntry || !selectedStageId) return
    const stage = selectedModeEntry.stages.find(s => s.id === selectedStageId)
    if (!stage) return
    const next = parseDungeonStage(stage).dungeonName
    if (next !== dungeonName) setDungeonName(next)
  }, [selectedModeEntry, selectedStageId, dungeonName])

  const selectedDungeonStages = useMemo(
    () => dungeonsForMode.find(d => d.name === dungeonName)?.stages ?? [],
    [dungeonsForMode, dungeonName],
  )

  const selectedStage = useMemo(
    () => selectedModeEntry?.stages.find(s => s.id === selectedStageId) ?? null,
    [selectedModeEntry, selectedStageId],
  )

  // Final stages list to render in the Stage select. When the current mode
  // resolves to a single dungeon, skip the Dungeon select and dump its stages
  // directly. Story stages are sorted by stageNum so 9-10/9-11/9-12 line up
  // even when the API's recommendLevel sort would shuffle ties.
  const stagesForStageSelect = useMemo(() => {
    if (!selectedModeEntry) return [] as StageEntry[]
    const raw = filteredDungeons.length === 1 ? filteredDungeons[0].stages : selectedDungeonStages
    if (!isStoryMode) return raw
    return [...raw].sort((a, b) => (a.stageNum ?? 0) - (b.stageNum ?? 0))
  }, [selectedModeEntry, filteredDungeons, selectedDungeonStages, isStoryMode])

  // ── Handlers ─────────────────────────────────────────────────────────
  function handleSelectCategory(category: string) {
    setCategoryName(category)
    setStorySeason(null)
    setDungeonName('')
    // Always emit a mode change — clears stage + monster downstream.
    onSelectMode('')
    if (!category) return
    // If only one sub-mode in the category, pre-select it (saves a click).
    const group = groupedModes.find(g => g.category === category)
    if (group && group.entries.length === 1) onSelectMode(group.entries[0].mode.label)
  }

  function handleSelectMode(label: string) {
    setStorySeason(null)
    setDungeonName('')
    onSelectMode(label)
  }

  function handleSelectSeason(value: string) {
    const s = value === '' ? null : parseInt(value, 10)
    setStorySeason(Number.isFinite(s as number) ? (s as number) : null)
    setDungeonName('')
    // Clear stage + monster (no dedicated season action; setStage('') is the
    // canonical clear). Mode stays.
    if (selectedStageId) onSelectStage('')
  }

  function handleSelectDungeon(name: string) {
    setDungeonName(name)
    if (selectedStageId) onSelectStage('')
  }

  // ── Render ───────────────────────────────────────────────────────────
  const stageDisabled = !selectedMode
                     || (isStoryMode && storySeason == null)
                     || (filteredDungeons.length > 1 && !dungeonName)
                     || stagesForStageSelect.length === 0

  return (
    <div className="space-y-2">
      <Field label="Category">
        <select
          value={categoryName}
          onChange={e => handleSelectCategory(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
        >
          <option value="">— select —</option>
          {groupedModes.map(g => (
            <option key={g.category} value={g.category}>{g.category}</option>
          ))}
        </select>
      </Field>

      {categoryName && selectedCategoryEntries.length > 1 && (
        <Field label="Mode">
          <select
            value={selectedMode}
            onChange={e => handleSelectMode(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="">— select —</option>
            {selectedCategoryEntries.map(e => (
              <option key={e.mode.label} value={e.mode.label}>
                {e.sub} ({e.mode.stages.length})
              </option>
            ))}
          </select>
        </Field>
      )}

      {selectedModeEntry && isStoryMode && seasonsForMode.length > 1 && (
        <Field label="Season">
          <select
            value={storySeason ?? ''}
            onChange={e => handleSelectSeason(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="">— select —</option>
            {seasonsForMode.map(s => (
              <option key={s} value={s}>Season {s}</option>
            ))}
          </select>
        </Field>
      )}

      {selectedModeEntry && filteredDungeons.length > 1 && (!isStoryMode || storySeason != null) && (
        <Field label={`${isStoryMode ? 'Episode' : 'Dungeon'} (${filteredDungeons.length})`}>
          <select
            value={dungeonName}
            onChange={e => handleSelectDungeon(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="">— select —</option>
            {filteredDungeons.map(d => (
              <option key={d.name} value={d.name}>{d.name} ({d.stages.length})</option>
            ))}
          </select>
        </Field>
      )}

      <Field label={`Stage${stagesForStageSelect.length > 0 ? ` (${stagesForStageSelect.length})` : ''}`}>
        <select
          value={selectedStageId ?? ''}
          onChange={e => onSelectStage(e.target.value)}
          disabled={stageDisabled}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          <option value="">— select —</option>
          {stagesForStageSelect.map(s => {
            const { stagePart } = parseDungeonStage(s)
            // Append the stage's storyline title in parens for story
            // (where it carries info: "9-1 (The Rage of the Demibeasts)").
            const suffix = isStoryMode && s.name && s.name !== stagePart ? ` (${s.name})` : ''
            return (
              <option key={s.id} value={s.id}>
                {s.recommendLevel > 0 ? `[Lv${s.recommendLevel}] ` : ''}{stagePart}{suffix}
              </option>
            )
          })}
        </select>
      </Field>

      {selectedStage && selectedStage.waves.length > 0 && (
        <div className="space-y-2">
          {selectedStage.waves.map((w, i) => (
            <div key={w.position}>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Fight {i + 1} ({w.monsters.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {w.monsters.map(m => {
                  const isSelected = selectedMonsterId === m.monsterId
                  return (
                    <button
                      key={`${m.monsterId}@${m.level}@${w.position}`}
                      type="button"
                      onClick={() => onSelectMonster({
                        id: m.monsterId,
                        name: m.name,
                        element: m.element,
                        isBoss: m.isBoss,
                      })}
                      title={`${m.isBoss ? '★ ' : ''}Lv${m.level} · ${m.name} (${m.element}/${m.class})`}
                      className={`relative rounded-lg outline-none transition ${isSelected ? '' : 'opacity-60 hover:opacity-100'}`}
                    >
                      <MonsterPortrait
                        faceIconId={m.faceIconId}
                        name={m.name}
                        element={m.element}
                        classType={m.class}
                        type={m.type}
                        basicStar={m.basicStar}
                        level={m.level}
                        isBoss={m.isBoss}
                        size="md"
                        showIcons
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
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

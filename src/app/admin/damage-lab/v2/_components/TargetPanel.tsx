'use client'

import { useState } from 'react'
import MonsterPortrait from '@/app/components/character/MonsterPortrait'
import type { PoolCondition } from '@/lib/damage/v2/buffs'
import type { BossMechanicState, BossOverride } from '@/lib/damage/v2/boss-overrides'
import type { ModeEntry } from '../_api/monsters'
import type { MonsterOption, PoolCondState, TargetState } from '../_state/types'
import { MonsterPicker } from './MonsterPicker'
import { BossMechanicsPanel } from './BossMechanicsPanel'
import { ElementIcon } from './CharPicker'

/** Extra metadata the page passes to surface the portrait + level + boss star. */
export interface TargetMonsterMeta {
  faceIconId: string
  type: string
  monsterClass: string
  basicStar: number
  level: number
}

interface TargetPanelProps {
  state: TargetState
  /** Full mode tree from `/api/admin/damage-lab/v2/stages` — picker handles cascade. */
  modeEntries: ModeEntry[]
  /** Optional richer info for the selected monster, used to render the portrait. */
  selectedMonsterMeta: TargetMonsterMeta | null
  /** Pool conditions — target-side fields displayed here. */
  poolConds: PoolCondState
  /** Set of pool conditions consumed by the current char's buffs. */
  applicablePoolConds: Set<PoolCondition>
  /** Boss-specific mechanic override (Amadeus, …). null = no boss-specific UI. */
  bossOverride: BossOverride | null
  /** Per-mechanic state (active flag + tuning value). */
  bossMechanicsState: Record<string, BossMechanicState>
  onChange: (patch: Partial<TargetState>) => void
  onSelectMode: (mode: string) => void
  onSelectStage: (stageId: string) => void
  onSelectMonster: (monster: MonsterOption) => void
  onAutoFill?: () => void
  onPoolCondChange: (patch: Partial<PoolCondState>) => void
  onBossMechanicToggle: (id: string, active: boolean) => void
}

export function TargetPanel({
  state, modeEntries, selectedMonsterMeta, poolConds, applicablePoolConds,
  bossOverride, bossMechanicsState,
  onChange, onSelectMode, onSelectStage, onSelectMonster, onAutoFill, onPoolCondChange,
  onBossMechanicToggle,
}: TargetPanelProps) {
  const [showConstants, setShowConstants] = useState(false)

  const editStat = (
    field: 'def' | 'dmgRed' | 'cdmgRed' | 'hp',
    value: number,
  ) => {
    onChange({
      [field]: value,
      statsAuto: { ...state.statsAuto, [field]: false },
    } as Partial<TargetState>)
  }

  return (
    <Section title="Target">
      <div className="space-y-3">
        <MonsterPicker
          modeEntries={modeEntries}
          selectedMode={state.mode}
          selectedStageId={state.stageId}
          selectedMonsterId={state.monsterId}
          onSelectMode={onSelectMode}
          onSelectStage={onSelectStage}
          onSelectMonster={onSelectMonster}
        />

        {state.monsterName && (
          <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 p-2 text-xs">
            {selectedMonsterMeta ? (
              <MonsterPortrait
                faceIconId={selectedMonsterMeta.faceIconId}
                name={state.monsterName}
                element={state.element}
                classType={selectedMonsterMeta.monsterClass}
                type={selectedMonsterMeta.type}
                basicStar={selectedMonsterMeta.basicStar}
                level={selectedMonsterMeta.level}
                isBoss={state.isBoss}
                size="md"
                showStars
                showLevel
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">
                portrait
              </div>
            )}
            <div className="flex-1">
              <div className="font-semibold text-zinc-100">{state.monsterName}</div>
              <div className="mt-1 flex items-center gap-1 text-zinc-400">
                {state.element && <ElementIcon element={state.element} size={14} />}
                <span>{state.element || 'unknown element'}</span>
                <span className="text-zinc-700">·</span>
                <span>{state.isBoss ? 'Boss' : 'Non-boss'}</span>
              </div>
              {onAutoFill && (
                <button
                  type="button"
                  onClick={onAutoFill}
                  className="mt-1 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-blue-600/30"
                >
                  Re-auto stats
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <StatField
            label="DEF"
            value={state.def}
            auto={state.statsAuto.def}
            onChange={v => editStat('def', v)}
          />
          <StatField
            label="DR %"
            value={state.dmgRed}
            auto={state.statsAuto.dmgRed}
            onChange={v => editStat('dmgRed', v)}
          />
          <StatField
            label="CDR %"
            value={state.cdmgRed}
            auto={state.statsAuto.cdmgRed}
            onChange={v => editStat('cdmgRed', v)}
          />
          {state.isBoss && (
            <StatField
              label="HP"
              value={state.hp ?? 0}
              auto={state.statsAuto.hp}
              onChange={v => editStat('hp', v)}
            />
          )}
        </div>

        <TargetMechanics
          state={poolConds}
          applicablePoolConds={applicablePoolConds}
          onChange={onPoolCondChange}
        />

        <BossMechanicsPanel
          override={bossOverride}
          state={bossMechanicsState}
          onToggle={onBossMechanicToggle}
        />

        <div className="border-t border-zinc-800 pt-2">
          <button
            type="button"
            onClick={() => setShowConstants(v => !v)}
            className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            {showConstants ? '▾' : '▸'} Constants
          </button>
          {showConstants && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="C">
                <NumberInput value={state.C} onChange={v => onChange({ C: v })} />
              </Field>
              <Field label="ratioDivisor">
                <NumberInput value={state.ratioDivisor} onChange={v => onChange({ ratioDivisor: v })} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

/**
 * Target-side pool-condition inputs — only fields whose `PoolCondition` is
 * actually consumed by the current char's buffs are rendered. Empty fieldset
 * is hidden entirely.
 */
function TargetMechanics({ state, applicablePoolConds, onChange }: {
  state: PoolCondState
  applicablePoolConds: Set<PoolCondition>
  onChange: (patch: Partial<PoolCondState>) => void
}) {
  const showHp     = applicablePoolConds.has('target_lost_hp')
  const showBuff   = applicablePoolConds.has('target_buff')
  const showDebuff = applicablePoolConds.has('target_debuff')
  const showBreak  = applicablePoolConds.has('target_break')

  if (!showHp && !showBuff && !showDebuff && !showBreak) return null

  return (
    <fieldset className="space-y-1.5 rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Target mechanics
      </legend>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {showHp && (
          <NumField label="Target HP rate (0..1)" value={state.targetHpRate} step={0.05} min={0} max={1}
                    onChange={v => onChange({ targetHpRate: v })} />
        )}
        {showBuff && (
          <NumField label="Target buffs" value={state.targetBuffCount} min={0}
                    onChange={v => onChange({ targetBuffCount: v })} />
        )}
        {showDebuff && (
          <NumField label="Target debuffs" value={state.targetDebuffCount} min={0}
                    onChange={v => onChange({ targetDebuffCount: v })} />
        )}
        {showBreak && (
          <BoolField label="Target broken (Rage)" checked={state.targetBroken}
                     onChange={v => onChange({ targetBroken: v })} />
        )}
      </div>
    </fieldset>
  )
}

function NumField({ label, value, onChange, min, max, step }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="flex-1 truncate text-zinc-400">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => {
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        suppressHydrationWarning
        className="w-14 shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-zinc-100 focus:border-blue-500 focus:outline-none"
      />
    </label>
  )
}

function BoolField({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800"
      />
      <span className="text-zinc-300">{label}</span>
    </label>
  )
}

// ── Local primitives ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      {children}
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

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => {
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) onChange(n)
      }}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      suppressHydrationWarning
      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
    />
  )
}

function StatField({ label, value, auto, onChange }: {
  label: string
  value: number
  auto: boolean
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
        {!auto && (
          <span className="rounded bg-amber-900/30 px-1 py-0.5 text-[8px] text-amber-400">manual</span>
        )}
      </span>
      <NumberInput value={value} onChange={onChange} />
    </label>
  )
}

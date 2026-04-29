'use client'

import Image from 'next/image'
import CharacterPortrait from '@/app/components/character/CharacterPortrait'
import type { CallerSlot, PoolCondition } from '@/lib/damage/v2/buffs'
import type { CharFlags } from '@/lib/damage/v2/char-overrides'
import type { ClassType, ElementType } from '@/types/enums'
import type { AttackerState, CharSummary, PoolCondState } from '../_state/types'
import { CharPicker, ElementIcon, ClassIcon } from './CharPicker'
import { PerCharFlags } from './PerCharFlags'

// Class label normalization for `CharacterPortrait` — the in-game lab data uses
// 'Attacker' / 'Priest' but the portrait layer expects the icon-file token.
const CLASS_TOKEN: Record<string, ClassType> = {
  Attacker: 'Striker', Striker: 'Striker',
  Mage: 'Mage', Ranger: 'Ranger', Defender: 'Defender',
  Priest: 'Healer', Healer: 'Healer',
}

interface AttackerPanelProps {
  state: AttackerState
  charCatalog: CharSummary[]
  /** Pool conditions — caster-side fields are displayed here. */
  poolConds: PoolCondState
  /** Set of pool conditions that the current char's buffs actually consume. */
  applicablePoolConds: Set<PoolCondition>
  onChange: (patch: Partial<AttackerState>) => void
  onSetChar: (charId: string) => void
  onSetSlot: (slot: CallerSlot) => void
  onSetFlag: (flag: keyof CharFlags, value: boolean) => void
  /** Edit a stat field with manual flag — sets `statsAuto[field] = false`. */
  onEditStat: (field: 'atk' | 'chd' | 'pen' | 'dmgInc', value: number) => void
  onPoolCondChange: (patch: Partial<PoolCondState>) => void
}

// Slot → skill-icon-file token (matches /images/characters/skills/Skill_{TOKEN}_{id}.webp).
const SLOT_ICON_TOKEN: Record<CallerSlot, string> = {
  S1: 'First',
  S2: 'Second',
  S3: 'Ultimate',
}
const SLOTS: CallerSlot[] = ['S1', 'S2', 'S3']

export function AttackerPanel({
  state, charCatalog, poolConds, applicablePoolConds,
  onChange, onSetChar, onSetSlot, onSetFlag, onEditStat, onPoolCondChange,
}: AttackerPanelProps) {
  const selectedChar = charCatalog.find(c => c.id === state.charId)

  return (
    <Section title="Attacker">
      <div className="space-y-3">
        <CharPicker
          catalog={charCatalog}
          selectedId={state.charId}
          onSelect={onSetChar}
        />

        {selectedChar && (
          <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 p-2 text-xs">
            <CharacterPortrait
              id={selectedChar.id}
              name={selectedChar.name}
              element={selectedChar.element as ElementType}
              classType={CLASS_TOKEN[selectedChar.class]}
              size="md"
            />
            <div className="flex-1">
              <div className="font-semibold text-zinc-100">{selectedChar.name}</div>
              <div className="mt-1 flex items-center gap-2 text-zinc-400">
                <ElementIcon element={selectedChar.element} size={14} />
                <span>{selectedChar.element}</span>
                <span className="text-zinc-700">·</span>
                <ClassIcon classLabel={selectedChar.class} size={14} />
                <span>{selectedChar.class}</span>
                <span className="text-zinc-700">·</span>
                <span>{selectedChar.subclass}</span>
              </div>
              <div className="text-[10px] text-zinc-600">id {selectedChar.id}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Field label="Slot">
            <div className="flex gap-1">
              {SLOTS.map(s => {
                const active = state.slot === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSetSlot(s)}
                    title={s}
                    className={`relative h-10 w-10 overflow-hidden rounded border transition-all ${
                      active
                        ? 'border-blue-500 ring-1 ring-blue-500'
                        : 'border-zinc-700 opacity-50 hover:opacity-100'
                    }`}
                  >
                    {selectedChar ? (
                      <Image
                        src={`/images/characters/skills/Skill_${SLOT_ICON_TOKEN[s]}_${selectedChar.id}.webp`}
                        alt={s}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-500">{s}</span>
                    )}
                    <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] font-bold text-zinc-200">
                      {s}
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Skill level">
            <NumberInput
              value={state.skillLevel}
              onChange={v => onChange({ skillLevel: v })}
              min={1} max={15}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatField label="ATK"    value={state.atk}    auto={state.statsAuto.atk}    onChange={v => onEditStat('atk', v)} />
          <StatField label="CHD %"  value={state.chd}    auto={state.statsAuto.chd}    onChange={v => onEditStat('chd', v)} />
          <StatField label="PEN %"  value={state.pen}    auto={state.statsAuto.pen}    onChange={v => onEditStat('pen', v)} />
          <StatField label="DMG↑ %" value={state.dmgInc} auto={state.statsAuto.dmgInc} onChange={v => onEditStat('dmgInc', v)} />
        </div>

        <div className="space-y-1">
          <Toggle
            label="Crit"
            checked={state.crit}
            onChange={v => onChange({ crit: v })}
          />
          <Toggle
            label="Apply awakening quirks"
            checked={state.applyQuirks}
            onChange={v => onChange({ applyQuirks: v })}
          />
          <Toggle
            label="Additional attack (skill sub-hit)"
            checked={state.additionalAttackEnabled}
            onChange={v => onChange({ additionalAttackEnabled: v })}
          />
        </div>

        {state.charId && (
          <PerCharFlags
            charId={state.charId}
            slot={state.slot}
            flags={state.charFlags}
            onChange={onSetFlag}
          />
        )}

        <CasterMechanics
          state={poolConds}
          applicablePoolConds={applicablePoolConds}
          onChange={onPoolCondChange}
        />
      </div>
    </Section>
  )
}

/**
 * Caster-side pool-condition inputs — drives the BT_DMG_* multipliers tied to
 * the attacker (own HP / buffs / kills / team / enemies dead).
 *
 * Each row is rendered ONLY when the current char has at least one buff that
 * consumes the matching `PoolCondition`. A char without any caster-side
 * pool_cond buffs gets the entire fieldset hidden.
 */
function CasterMechanics({ state, applicablePoolConds, onChange }: {
  state: PoolCondState
  applicablePoolConds: Set<PoolCondition>
  onChange: (patch: Partial<PoolCondState>) => void
}) {
  // owner_lost_hp and caster_lost_hp share the same input (HP rate); show one
  // row when EITHER cond is required.
  const showOwnHpRate = applicablePoolConds.has('owner_lost_hp') || applicablePoolConds.has('caster_lost_hp')
  const showOwnBuff   = applicablePoolConds.has('owner_buff')
  const showOwnDebuff = applicablePoolConds.has('owner_debuff')
  const showTeamBuff  = applicablePoolConds.has('team_buff')
  const showTeamDec   = applicablePoolConds.has('team_decrease')
  const showEnemyDec  = applicablePoolConds.has('enemy_team_decrease')
  const showKillStack = applicablePoolConds.has('kill_count_stack')

  const anyVisible = showOwnHpRate || showOwnBuff || showOwnDebuff || showTeamBuff
                  || showTeamDec || showEnemyDec || showKillStack
  if (!anyVisible) return null

  return (
    <fieldset className="space-y-1.5 rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Caster mechanics
      </legend>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {showOwnHpRate && (
          <NumField label="Own HP rate (0..1)" value={state.ownerHpRate} step={0.05} min={0} max={1}
                    onChange={v => onChange({ ownerHpRate: v, casterHpRate: v })} />
        )}
        {showOwnBuff && (
          <NumField label="Own buffs" value={state.ownerBuffCount} min={0}
                    onChange={v => onChange({ ownerBuffCount: v })} />
        )}
        {showOwnDebuff && (
          <NumField label="Own debuffs" value={state.ownerDebuffCount} min={0}
                    onChange={v => onChange({ ownerDebuffCount: v })} />
        )}
        {showTeamBuff && (
          <NumField label="Team buffs total" value={state.teamBuffCount} min={0}
                    onChange={v => onChange({ teamBuffCount: v })} />
        )}
        {showTeamDec && (
          <NumField label="Allies dead" value={state.teamDecreaseCount} min={0} max={4}
                    onChange={v => onChange({ teamDecreaseCount: v })} />
        )}
        {showEnemyDec && (
          // In-game wording: "inversely proportional to target count".
          // Binary computes (4 − aliveEnemies), so displaying alive-target count
          // (1..4) is more intuitive; stored value is 4 − displayed.
          <NumField label="Enemy targets" highlight value={4 - state.enemyTeamDecreaseCount} min={1} max={4}
                    onChange={v => onChange({ enemyTeamDecreaseCount: 4 - v })} />
        )}
        {showKillStack && (
          <NumField label="Kill count stack" value={state.killCountStack} min={0}
                    onChange={v => onChange({ killCountStack: v })} />
        )}
      </div>
    </fieldset>
  )
}

function NumField({ label, value, onChange, min, max, step, highlight }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  highlight?: boolean
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className={`flex-1 truncate ${highlight ? 'font-semibold text-amber-400' : 'text-zinc-400'}`}>
        {label}
      </span>
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

// ── Local primitives ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
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

function NumberInput({ value, onChange, min, max }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
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

function Toggle({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs">
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

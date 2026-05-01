'use client'

import Image from 'next/image'
import CharacterPortrait from '@/app/components/character/CharacterPortrait'
import type { ApplicableBuff, CallerSlot, PoolCondition } from '@/lib/damage/v2/buffs'
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
  /** Buffs applicable to the current caster — fed to PerCharFlags so the flag list is data-driven. */
  charBuffs: ApplicableBuff[]
  /**
   * `ST_*` keys the current char's scalings actually read (excluding
   * `ST_ATK`). Drives which secondary-stat inputs the panel surfaces —
   * Demiurge Drakhan exposes HP, Demiurge Stella exposes HP, Regina
   * exposes CRITICAL_RATE, etc.
   */
  casterScalingStats: Set<string>
  /**
   * Primary scaling stat for the current `(charId, slot)`. Defaults to
   * `ST_ATK`; switches to the swap target (`ST_HP` / `ST_DEF`) when the
   * char carries an unconditional `scaling_swap`. Used to badge the
   * matching input as "primary" in the UI.
   */
  primaryScalingStat: string
  /**
   * Conditional sub-attack ratio for the current `(charId, slot)`, or
   * `null` when the slot has no sub-hit defined. When null, the
   * "Additional attack" toggle is hidden — there's nothing to model.
   */
  additionalAttackRatio: number | null
  onChange: (patch: Partial<AttackerState>) => void
  onSetChar: (charId: string) => void
  onSetSlot: (slot: CallerSlot) => void
  onSetFlag: (flag: keyof CharFlags, value: boolean) => void
  /** Edit a stat field with manual flag — sets `statsAuto[field] = false`. */
  onEditStat: (field: 'atk' | 'chd' | 'pen' | 'dmgInc', value: number) => void
  onPoolCondChange: (patch: Partial<PoolCondState>) => void
  onSetExtraStat: (stat: string, value: number) => void
}

const SLOTS: CallerSlot[] = ['S1', 'S2', 'S3']

/**
 * Secondary scaling stat → display label, in render order. The lab only
 * surfaces an input when the current char's buffs reference the stat
 * (`casterScalingStats`). ST_ATK is excluded because it has its own
 * dedicated input.
 */
const EXTRA_STAT_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['ST_HP', 'HP'],
  ['ST_DEF', 'DEF'],
  ['ST_SPEED', 'SPD'],
  ['ST_CRITICAL_RATE', 'CHC %'],
  ['ST_BUFF_CHANCE', 'EFF %'],
]

export function AttackerPanel({
  state, charCatalog, poolConds, applicablePoolConds, charBuffs,
  casterScalingStats, primaryScalingStat, additionalAttackRatio,
  onChange, onSetChar, onSetSlot, onSetFlag, onEditStat, onPoolCondChange, onSetExtraStat,
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

        <UsedSkillCadre
          slot={state.slot}
          skillLevel={state.skillLevel}
          crit={state.crit}
          additionalAttackEnabled={state.additionalAttackEnabled}
          additionalAttackRatio={additionalAttackRatio}
          skillIcons={selectedChar?.skillIcons}
          onSetSlot={onSetSlot}
          onChange={onChange}
        />

        <PrimaryStatCadre
          state={state}
          casterScalingStats={casterScalingStats}
          primaryScalingStat={primaryScalingStat}
          onEditStat={onEditStat}
          onSetExtraStat={onSetExtraStat}
        />

        <SecondaryStatCadre
          state={state}
          onEditStat={onEditStat}
        />

        <ExternalFactorCadre
          guildLevel={state.guildLevel}
          codexLevel={state.codexLevel}
          assumeMaxTranscend={state.assumeMaxTranscend}
          applyQuirks={state.applyQuirks}
          eeEnabled={state.eeEnabled}
          eeLevel={state.eeLevel}
          eeVariant={state.eeVariant}
          eeBuffs={charBuffs}
          selectedChar={charCatalog.find(c => c.id === state.charId)}
          currentSlot={state.slot}
          onChange={onChange}
        />

        {state.charId && (
          <PerCharFlags
            charId={state.charId}
            slot={state.slot}
            flags={state.charFlags}
            buffs={charBuffs}
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

// ── Sub-fieldsets (4 cadres) ─────────────────────────────────────────────

import { GUILD_HP_BY_LEVEL } from '@/lib/damage/v2/recompute'

/**
 * Skill picker + level + crit + additional attack toggle. Groups everything
 * that selects "which version of which skill" the operator wants to model.
 */
const SKILL_LEVELS = [1, 2, 3, 4, 5] as const

function UsedSkillCadre({
  slot, skillLevel, crit, additionalAttackEnabled, additionalAttackRatio, skillIcons,
  onSetSlot, onChange,
}: {
  slot: CallerSlot
  skillLevel: number
  crit: boolean
  additionalAttackEnabled: boolean
  additionalAttackRatio: number | null
  skillIcons: CharSummary['skillIcons'] | undefined
  onSetSlot: (s: CallerSlot) => void
  onChange: (patch: Partial<AttackerState>) => void
}) {
  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Used skill
      </legend>
      <div className="space-y-2">
        {/* Slot icons — large, click-to-select. */}
        <div className="flex justify-center gap-2">
          {SLOTS.map(s => {
            const active = slot === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSetSlot(s)}
                title={s}
                className={`relative h-12 w-12 overflow-hidden rounded border transition-all ${
                  active
                    ? 'border-blue-500 ring-2 ring-blue-500/50'
                    : 'border-zinc-700 opacity-50 hover:opacity-100'
                }`}
              >
                {skillIcons?.[s] ? (
                  <Image
                    src={`/images/characters/skills/${skillIcons[s]}.webp`}
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

        {/* Skill level — 5 buttons, typical char-skill range. */}
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Skill level</div>
          <div className="flex gap-1">
            {SKILL_LEVELS.map(lv => {
              const active = skillLevel === lv
              return (
                <button
                  key={lv}
                  type="button"
                  onClick={() => onChange({ skillLevel: lv })}
                  className={`flex-1 rounded border px-1 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-600/30 text-blue-100'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  +{lv}
                </button>
              )
            })}
          </div>
        </div>

        {/* Crit — pill toggle, stands out vs the small checkbox. */}
        <button
          type="button"
          onClick={() => onChange({ crit: !crit })}
          className={`w-full rounded border px-2 py-1.5 text-xs font-semibold transition-colors ${
            crit
              ? 'border-amber-500 bg-amber-600/25 text-amber-100'
              : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
          }`}
        >
          {crit ? '◉ Crit ON' : '○ Crit OFF'}
        </button>

        {/* Additional attack — only when the slot actually carries a sub-hit. */}
        {additionalAttackRatio != null && (
          <Toggle
            label={`Sub-attack (×${additionalAttackRatio.toFixed(2)} of main DF)`}
            checked={additionalAttackEnabled}
            onChange={v => onChange({ additionalAttackEnabled: v })}
          />
        )}
      </div>
    </fieldset>
  )
}

/**
 * Primary scaling stat input(s). Always shows ATK when the char actually
 * uses ATK (no swap, or swap chars with secondary ATK references).
 * Hides ATK when the char has a `scaling_swap` to a non-ATK stat AND
 * doesn't reference ATK anywhere in its scalings (e.g. Demiurge Drakhan).
 * Other ST_* inputs (HP / DEF / SPD / CHC / EFF) appear when the char's
 * buffs read them. The actual primary gets a "primary" badge.
 */
function PrimaryStatCadre({
  state, casterScalingStats, primaryScalingStat, onEditStat, onSetExtraStat,
}: {
  state: AttackerState
  casterScalingStats: Set<string>
  primaryScalingStat: string
  onEditStat: (field: 'atk' | 'chd' | 'pen' | 'dmgInc', value: number) => void
  onSetExtraStat: (stat: string, value: number) => void
}) {
  // Hide ATK when primary swapped away AND ATK isn't referenced elsewhere.
  const showAtk = primaryScalingStat === 'ST_ATK' || casterScalingStats.has('ST_ATK')
  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Primary stat
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {showAtk && (
          <StatField
            label="ATK"
            primary={primaryScalingStat === 'ST_ATK'}
            value={state.atk}
            auto={state.statsAuto.atk}
            onChange={v => onEditStat('atk', v)}
          />
        )}
        {EXTRA_STAT_LABELS.map(([stat, label]) => casterScalingStats.has(stat) && (
          <StatField
            key={stat}
            label={label}
            primary={primaryScalingStat === stat}
            value={state.extraStats[stat] ?? 0}
            auto={false}
            onChange={v => onSetExtraStat(stat, v)}
          />
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Secondary stats — modifiers feeding the rate / damage chain (PEN reduces
 * mit, CHD scales crit, DMG↑ adds to pool). Distinct from the primary
 * scaling input(s) because they don't multiply the skill's DF; they
 * adjust how the resulting hit interacts with the target.
 */
function SecondaryStatCadre({
  state, onEditStat,
}: {
  state: AttackerState
  onEditStat: (field: 'atk' | 'chd' | 'pen' | 'dmgInc', value: number) => void
}) {
  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Secondary stat
      </legend>
      <div className="grid grid-cols-3 gap-2">
        <StatField label="PEN %"  value={state.pen}    auto={state.statsAuto.pen}    onChange={v => onEditStat('pen', v)} />
        <StatField label="CHD %"  value={state.chd}    auto={state.statsAuto.chd}    onChange={v => onEditStat('chd', v)} />
        <StatField label="DMG↑ %" value={state.dmgInc} auto={state.statsAuto.dmgInc} onChange={v => onEditStat('dmgInc', v)} />
      </div>
    </fieldset>
  )
}

/**
 * Friendly EE buff label for the cadre rows. Pulls the effect target +
 * trigger condition into a one-liner ("Damage vs Light", "PEN vs boss").
 */
function eeBuffLabel(b: ApplicableBuff): string {
  const targetLabels: Record<string, string> = {
    pool: 'Damage', pen: 'PEN', chd: 'CHD', crit_rate: 'CHC',
    atk_pct: 'ATK', atk_flat: 'ATK',
    monster_eff: 'EFF (vs target)', monster_res: 'RES (vs target)',
    scaling_swap: 'Scaling swap', scaling_add_flat: 'Scaling add',
    scaling_add_pct: 'Scaling add', scaling_target_stat: 'Target-stat scaling',
    pool_cond: 'Conditional damage',
  }
  const req = b.trigger.requires
  const reqLabel: Record<string, string> = {
    always: '', boss: ' vs boss', crit: ' on crit',
    adv: ' vs disadv elem', disadv: ' vs adv elem', neutral: ' vs neutral elem',
    resource: ' at full resource', caster_def_up: ' under DEF up',
    target_element_earth: ' vs Earth', target_element_water: ' vs Water',
    target_element_fire:  ' vs Fire',  target_element_light: ' vs Light',
    target_element_dark:  ' vs Dark',
  }
  return (targetLabels[b.effect.target] ?? b.effect.target) + (reqLabel[req] ?? '')
}

/**
 * External factors — anything that's caster-context but not a stat or a
 * skill choice: codex level (refetches stats), guild HP buff, awakening
 * quirks toggle, transcend assumption (locked for now). EE block surfaces
 * only when the current char has at least one extracted EE buff.
 */
function ExternalFactorCadre({
  guildLevel, codexLevel, assumeMaxTranscend, applyQuirks,
  eeEnabled, eeLevel, eeVariant, eeBuffs, selectedChar, currentSlot, onChange,
}: {
  guildLevel: number
  codexLevel: number
  assumeMaxTranscend: boolean
  applyQuirks: boolean
  eeEnabled: boolean
  eeLevel: number
  eeVariant: 'self' | 'base'
  /** All applicable buffs for the current caster — filtered to EE inside. */
  eeBuffs: ApplicableBuff[]
  /** Drives the base/CF variant selector (CF chars carry `baseCharId`). */
  selectedChar?: CharSummary
  /** Current attacker slot — narrows the visible EE buffs to those that fire here. */
  currentSlot: CallerSlot
  onChange: (patch: Partial<AttackerState>) => void
}) {
  // Filter EE buffs by the wearer's selected variant. CF chars wearing base
  // see only base-EE buffs (source.charId = baseCharId); else own-EE only.
  // Further narrow to buffs that would fire on the current slot — passives
  // pinned to a specific CallerSkillType (e.g. Asphodel S2-only) shouldn't
  // appear when the operator is testing S1/S3.
  const eeWearerId = eeVariant === 'base' && selectedChar?.baseCharId
    ? selectedChar.baseCharId
    : selectedChar?.id
  const visibleEEBuffs = eeBuffs.filter(b => {
    if (b.source.kind !== 'ee' || b.source.charId !== eeWearerId) return false
    const slots = b.trigger.callerSlots
    return slots === 'all' || slots.includes(currentSlot)
  })
  // Variant selector only when both an own-EE and a base-EE exist for the
  // current CF char. Non-CF chars (no baseCharId) skip the picker.
  // Resolve in-game EE display names (TextItem) once for the dropdown.
  const ownEEName = eeBuffs.find(b => b.source.kind === 'ee' && b.source.charId === selectedChar?.id)?.ui?.name
  const baseEEName = !selectedChar?.baseCharId ? undefined
    : eeBuffs.find(b => b.source.kind === 'ee' && b.source.charId === selectedChar.baseCharId)?.ui?.name
  const ownHasEE = !!ownEEName
  const baseHasEE = !!baseEEName
  const showVariantPicker = !!selectedChar?.baseCharId && (ownHasEE || baseHasEE)
  const guildPct = GUILD_HP_BY_LEVEL[Math.max(0, Math.min(GUILD_HP_BY_LEVEL.length - 1, guildLevel))] ?? 0
  return (
    <fieldset className="rounded border border-zinc-800 bg-zinc-950 p-2">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        External factor
      </legend>
      <div className="space-y-1.5">
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-300">Hero Codex Lv</span>
          <select
            value={codexLevel}
            onChange={e => onChange({ codexLevel: parseInt(e.target.value, 10) })}
            className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i).map(lv => (
              <option key={lv} value={lv}>Lv {lv}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-300">Guild HP buff</span>
          <select
            value={guildLevel}
            onChange={e => onChange({ guildLevel: parseInt(e.target.value, 10) })}
            className="w-32 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            <option value={0}>None</option>
            {Array.from({ length: GUILD_HP_BY_LEVEL.length - 1 }, (_, i) => i + 1).map(lv => (
              <option key={lv} value={lv}>{`Lv ${lv} (+${GUILD_HP_BY_LEVEL[lv]}% HP)`}</option>
            ))}
          </select>
        </label>
        <Toggle
          label="Quirks (awakening passives)"
          checked={applyQuirks}
          onChange={v => onChange({ applyQuirks: v })}
        />
        {(ownHasEE || baseHasEE) && (
          <>
            <Toggle
              label="Equip Exclusive Equipment"
              checked={eeEnabled}
              onChange={v => onChange({ eeEnabled: v })}
            />
            {eeEnabled && (
              <>
                {showVariantPicker && (
                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-zinc-300">EE</span>
                    <select
                      value={eeVariant}
                      onChange={e => onChange({ eeVariant: e.target.value as 'self' | 'base' })}
                      className="min-w-0 max-w-[60%] truncate rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      {ownHasEE && <option value="self">{ownEEName}</option>}
                      {baseHasEE && <option value="base">{baseEEName}</option>}
                    </select>
                  </label>
                )}
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-300">EE level</span>
                  <select
                    value={eeLevel}
                    onChange={e => onChange({ eeLevel: parseInt(e.target.value, 10) })}
                    className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-right text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                  >
                    {Array.from({ length: 11 }, (_, i) => i).map(lv => (
                      <option key={lv} value={lv}>Lv {lv}</option>
                    ))}
                  </select>
                </label>
                {visibleEEBuffs.length > 0 ? (
                  <ul className="ml-4 list-disc space-y-0.5 text-[10px] text-zinc-400">
                    {visibleEEBuffs.map(b => {
                      const amt = b.effect.eeLevelValues?.[eeLevel] ?? b.effect.amount
                      const sign = amt >= 0 ? '+' : ''
                      return (
                        <li key={b.id}>
                          <span className="text-zinc-300">{eeBuffLabel(b)}</span>
                          {' '}
                          <span className="text-emerald-400">{sign}{amt.toFixed(amt % 1 === 0 ? 0 : 1)}{b.effect.unit === '%' ? '%' : ''}</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="ml-4 text-[10px] text-zinc-600 italic">No damage-relevant EE effect for this variant.</p>
                )}
              </>
            )}
          </>
        )}
        <label className="flex cursor-not-allowed items-center justify-between gap-2 text-xs opacity-60">
          <span className="text-zinc-300">Assume 6★ transcend</span>
          <input
            type="checkbox"
            checked={assumeMaxTranscend}
            disabled
            readOnly
            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800"
          />
        </label>
        <p className="text-[9px] text-zinc-600">
          Codex Lv {codexLevel}{guildPct > 0 ? ` · Guild +${guildPct}% HP` : ''}
          {' · '}max transcend (locked)
        </p>
      </div>
    </fieldset>
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

function StatField({ label, value, auto, primary, onChange }: {
  label: string
  value: number
  auto: boolean
  /** Mark as the primary scaling stat (skill DF reads this stat). */
  primary?: boolean
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
        {primary && (
          <span className="rounded bg-blue-900/40 px-1 py-0.5 text-[8px] font-semibold text-blue-300">primary</span>
        )}
        {!auto && (
          <span className="rounded bg-amber-900/30 px-1 py-0.5 text-[8px] text-amber-400">manual</span>
        )}
      </span>
      <NumberInput value={value} onChange={onChange} />
    </label>
  )
}

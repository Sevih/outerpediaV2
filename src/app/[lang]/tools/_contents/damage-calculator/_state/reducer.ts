import type { DamageCalcCharDetail, DamageCalcMonsterStats, DamageCalcStatsStep } from '@/lib/data/damage-calc'
import type { BossMechanicState, BossOverride } from '@/lib/damage/v2/boss-overrides'
import {
  INITIAL_STATE, INITIAL_STATS, INITIAL_LOADOUT, INITIAL_MANUAL, INITIAL_CONDITIONAL,
  INITIAL_TEAM_MEMBER,
  cloneInitialBuffs, makeInitialTeam,
  type CalcState, type ConditionalModifiers, type ManualTargetState, type SkillSlot, type StatKey, type StatScaling, type StatValues, type TargetMode, type TeamMember,
} from './types'

/** Equipment slot keys exposed by the picker. */
export type EquipSlot = 'weapon' | 'accessory' | 'set1' | 'set2' | 'talisman'

/** Action payload for settings/applyAuto: prefilled stats from computeFinalStats. */
export type AutoStats = StatValues

/**
 * Reducer for the damage calculator state. Discriminated-union actions to
 * keep transitions explicit — every panel emits a single dispatch with the
 * data it changed, and the reducer is the single source of truth for what
 * a transition does to the rest of the state (e.g. picking a new char
 * resets stats from the new char's baseline).
 */

export type CalcAction =
  | { type: 'attacker/pickChar'; charId: string }
  | { type: 'attacker/detailLoaded'; charId: string; detail: DamageCalcCharDetail; defaultTransStar: number }
  | { type: 'attacker/detailFailed'; charId: string }
  | { type: 'attacker/clearChar' }
  | { type: 'attacker/setStat'; key: StatKey; value: number }
  | { type: 'attacker/resetStats' }
  | { type: 'attacker/setSkillSlot'; slot: SkillSlot }
  | { type: 'attacker/setSkillLevel'; level: 1 | 2 | 3 | 4 | 5 }
  /** Burst level 0..3 — gated on S3 + transcend unlock at the call site. */
  | { type: 'attacker/setBurstLevel'; level: 0 | 1 | 2 | 3 }
  | { type: 'attacker/setCrit'; crit: boolean }
  | { type: 'attacker/setTransStar'; tier: number }
  /** Auto-prefill — written by the effect that watches char/transcend/settings.
   *  `atkScaling` carries the breakdown so external ATK% buffs can stack
   *  additively in `recompute()`. Null when the breakdown isn't available
   *  (no detail loaded). */
  | { type: 'attacker/applyAutoStats'; stats: AutoStats; atkScaling: StatScaling | null }
  | { type: 'settings/setCodexLevel'; level: number }
  | { type: 'settings/setQuirk'; scope: 'element' | 'job' | 'pve' | 'adventureLicense'; enabled: boolean }
  | { type: 'settings/replace'; settings: CalcState['settings'] }
  // Equipment loadout — slug-based picker selections. Null = empty slot.
  | { type: 'attacker/setEquipSlot'; slot: EquipSlot; slug: string | null }
  | { type: 'attacker/setEEEnabled'; enabled: boolean }
  | { type: 'attacker/setEESlug'; slug: string | null }
  | { type: 'attacker/setEELevel'; level: number }
  | { type: 'attacker/setEEVariant'; variant: 'self' | 'base' }
  | { type: 'attacker/clearEquipment' }
  | { type: 'attacker/setConditional'; key: keyof ConditionalModifiers; value: number }
  | { type: 'attacker/resetConditional' }
  | { type: 'target/pickMonster'; stageId: string | null; monsterId: string | null }
  | { type: 'target/setMode'; mode: TargetMode }
  | { type: 'target/setManualField'; key: 'isBoss' | 'element'; value: boolean | string }
  | { type: 'target/setManualStat'; key: keyof DamageCalcMonsterStats; value: number }
  | { type: 'target/seedManual'; manual: ManualTargetState }
  | { type: 'target/resetManual' }
  // External buffs/debuffs — catalog-driven via `EXTERNAL_BUFFS` ids. Mirrors
  // the admin Damage Lab v2 reducer (toggle + setValue), with an extra
  // `setMarked` for the off-catalog target-side Marked toggle.
  | { type: 'buffs/toggle'; id: string; active: boolean }
  | { type: 'buffs/setValue'; id: string; value: number }
  | { type: 'buffs/setMarked'; marked: boolean }
  | { type: 'buffs/reset' }
  // Ally team — single shallow patch per slot (admin-style). Picking a new
  // char clears the slot's class-gated fields so they don't leak across.
  | { type: 'team/patchMember'; slot: number; patch: Partial<TeamMember> }
  | { type: 'team/setChar'; slot: number; charId: string | null; defaultTransStar?: number }
  | { type: 'team/setTransStar'; slot: number; transStar: number }
  | { type: 'team/clearMember'; slot: number }
  | { type: 'team/reset' }
  // Boss mechanics — toggle on/off only. Effects evaluate from the override's
  // raw buff list at recompute time. No multiplier knob.
  | { type: 'boss/toggleMechanic'; id: string; active: boolean }
  /**
   * Set the boss override (definitions + buffs) for the currently-selected
   * monster. Dispatched by the CalculatorClient effect after the mechanics
   * fetch resolves. Merges with existing toggle states so a monster swap
   * preserves picks for any passive that survived the swap.
   */
  | { type: 'boss/setOverride'; override: BossOverride | null }
  // Whole-state replace — drives the share panel's "Import" button. The
  // payload is a sanitized `CalcState` (detail/loading/statsDirty already
  // reset, defaults filled in for any missing slices) so the reducer can
  // swap it in wholesale.
  | { type: 'state/import'; state: CalcState }

export function calcReducer(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {
    case 'attacker/pickChar': {
      // Optimistic char id update — `detailLoaded` follows once the fetch
      // resolves (or `detailFailed` clears the spinner). Equipment + conditional
      // reset because both are per-char (EE is char-specific; conditional inputs
      // only render for the picked char's applicable buffs).
      if (state.attacker.charId === action.charId && state.attacker.detail) return state
      return {
        ...state,
        attacker: {
          ...state.attacker,
          charId: action.charId,
          detail: null,
          loading: true,
          equipment: { ...INITIAL_LOADOUT, setSlots: [...INITIAL_LOADOUT.setSlots], ee: { ...INITIAL_LOADOUT.ee } },
          conditional: { ...INITIAL_CONDITIONAL },
          atkScaling: null,
        },
      }
    }

    case 'attacker/detailLoaded': {
      // Race guard: only commit if the loaded detail still matches the
      // currently-selected char (user might have picked another mid-fetch).
      // Stats stay at the lv60_ev3 baseline here — the auto-prefill effect
      // dispatches `applyAutoStats` once it has the resolved noGearStats +
      // settings + transcend tier in hand.
      if (state.attacker.charId !== action.charId) return state
      return {
        ...state,
        attacker: {
          ...state.attacker,
          detail: action.detail,
          loading: false,
          stats: prefillStatsFromDetail(action.detail) ?? state.attacker.stats,
          transStar: action.defaultTransStar,
        },
        statsDirty: false,
      }
    }

    case 'attacker/detailFailed': {
      if (state.attacker.charId !== action.charId) return state
      return { ...state, attacker: { ...state.attacker, loading: false } }
    }

    case 'attacker/clearChar': {
      return {
        ...state,
        attacker: {
          ...state.attacker,
          charId: null, detail: null, loading: false,
          stats: { ...INITIAL_STATS },
          transStar: 0,
          equipment: { ...INITIAL_LOADOUT, setSlots: [...INITIAL_LOADOUT.setSlots], ee: { ...INITIAL_LOADOUT.ee } },
          conditional: { ...INITIAL_CONDITIONAL },
          atkScaling: null,
        },
        statsDirty: false,
      }
    }

    case 'attacker/setStat': {
      return {
        ...state,
        attacker: {
          ...state.attacker,
          stats: { ...state.attacker.stats, [action.key]: action.value },
          // Manual ATK edit invalidates the breakdown — the displayed number
          // no longer matches the scaling block, so external buffs fall back
          // to linear stacking until the user resets / picks a fresh char.
          atkScaling: action.key === 'ATK' ? null : state.attacker.atkScaling,
        },
        // User typed → freeze auto-prefill until they reset or pick another char.
        statsDirty: true,
      }
    }

    case 'attacker/resetStats': {
      // Reset clears the dirty flag so the next render's auto-prefill effect
      // re-applies the no-gear sheet for the current settings + transcend
      // (and re-populates `atkScaling` along with the stats).
      return {
        ...state,
        attacker: {
          ...state.attacker,
          stats: { ...INITIAL_STATS },
          atkScaling: null,
        },
        statsDirty: false,
      }
    }

    case 'attacker/applyAutoStats':
      return {
        ...state,
        attacker: { ...state.attacker, stats: action.stats, atkScaling: action.atkScaling },
      }

    case 'attacker/setSkillSlot':
      // Switching away from S3 drops any active burst — bursts only apply
      // to S3, and a stale burstLevel on S1/S2 is invisible in the UI but
      // would leak back when the user returns to S3.
      return {
        ...state,
        attacker: {
          ...state.attacker,
          skillSlot: action.slot,
          burstLevel: action.slot === 'S3' ? state.attacker.burstLevel : 0,
        },
      }
    case 'attacker/setSkillLevel':
      return { ...state, attacker: { ...state.attacker, skillLevel: action.level } }
    case 'attacker/setBurstLevel':
      return { ...state, attacker: { ...state.attacker, burstLevel: action.level } }
    case 'attacker/setCrit':
      return { ...state, attacker: { ...state.attacker, crit: action.crit } }
    case 'attacker/setTransStar':
      return { ...state, attacker: { ...state.attacker, transStar: action.tier } }

    case 'settings/setCodexLevel':
      return { ...state, settings: { ...state.settings, codexLevel: action.level } }
    case 'settings/setQuirk':
      return {
        ...state,
        settings: {
          ...state.settings,
          quirks: { ...state.settings.quirks, [action.scope]: action.enabled },
        },
      }
    case 'settings/replace':
      return { ...state, settings: action.settings }

    case 'attacker/setEquipSlot': {
      const eq = state.attacker.equipment
      let next = eq
      if (action.slot === 'weapon')         next = { ...eq, weaponSlug:    action.slug }
      else if (action.slot === 'accessory') next = { ...eq, accessorySlug: action.slug }
      else if (action.slot === 'talisman')  next = { ...eq, talismanSlug:  action.slug }
      else if (action.slot === 'set1')      next = { ...eq, setSlots: [action.slug, eq.setSlots[1]] }
      else if (action.slot === 'set2')      next = { ...eq, setSlots: [eq.setSlots[0], action.slug] }
      return { ...state, attacker: { ...state.attacker, equipment: next } }
    }

    case 'attacker/setEEEnabled':
      return { ...state, attacker: { ...state.attacker, equipment: { ...state.attacker.equipment, ee: { ...state.attacker.equipment.ee, enabled: action.enabled } } } }
    case 'attacker/setEESlug':
      return { ...state, attacker: { ...state.attacker, equipment: { ...state.attacker.equipment, ee: { ...state.attacker.equipment.ee, slug: action.slug } } } }
    case 'attacker/setEELevel':
      return { ...state, attacker: { ...state.attacker, equipment: { ...state.attacker.equipment, ee: { ...state.attacker.equipment.ee, level: Math.max(0, Math.min(10, Math.floor(action.level))) } } } }
    case 'attacker/setEEVariant':
      return { ...state, attacker: { ...state.attacker, equipment: { ...state.attacker.equipment, ee: { ...state.attacker.equipment.ee, variant: action.variant } } } }
    case 'attacker/clearEquipment':
      return { ...state, attacker: { ...state.attacker, equipment: { ...INITIAL_LOADOUT, setSlots: [...INITIAL_LOADOUT.setSlots], ee: { ...INITIAL_LOADOUT.ee } } } }

    case 'attacker/setConditional':
      return {
        ...state,
        attacker: {
          ...state.attacker,
          conditional: { ...state.attacker.conditional, [action.key]: Math.max(0, action.value) },
        },
      }

    case 'attacker/resetConditional':
      return { ...state, attacker: { ...state.attacker, conditional: { ...INITIAL_CONDITIONAL } } }

    case 'target/pickMonster':
      // No-op when the (stage, monster) pair hasn't changed — keeps the
      // reducer pure-ish and avoids spurious re-renders downstream.
      if (state.target.stageId === action.stageId && state.target.monsterId === action.monsterId) return state
      // Monster swap clears the override + toggles. The CalculatorClient
      // effect re-fetches mechanics on the new monsterId and dispatches
      // `boss/setOverride` once the payload resolves (panel hidden until then).
      return {
        ...state,
        target: { ...state.target, stageId: action.stageId, monsterId: action.monsterId },
        bossMechanics: {},
        bossOverride: null,
      }

    case 'target/setMode':
      if (state.target.mode === action.mode) return state
      // Switching to manual mode (or back) drops the cascade-resolved boss
      // override — manual targets have no associated MonsterTemplet id, so
      // mechanics aren't applicable.
      return {
        ...state,
        target: { ...state.target, mode: action.mode },
        bossMechanics: {},
        bossOverride: null,
      }

    case 'target/setManualField': {
      const m = state.target.manual
      let next: ManualTargetState = m
      if (action.key === 'isBoss')       next = { ...m, isBoss:  Boolean(action.value) }
      else if (action.key === 'element') next = { ...m, element: String(action.value) }
      return { ...state, target: { ...state.target, manual: next } }
    }

    case 'target/setManualStat':
      return {
        ...state,
        target: {
          ...state.target,
          manual: {
            ...state.target.manual,
            stats: { ...state.target.manual.stats, [action.key]: Math.max(0, action.value) },
          },
        },
      }

    case 'target/seedManual':
      return {
        ...state,
        target: { ...state.target, manual: { ...action.manual, stats: { ...action.manual.stats } } },
      }

    case 'target/resetManual':
      return {
        ...state,
        target: { ...state.target, manual: { ...INITIAL_MANUAL, stats: { ...INITIAL_MANUAL.stats } } },
      }

    case 'buffs/toggle': {
      const cur = state.buffs.toggles[action.id]
      if (!cur) return state
      return {
        ...state,
        buffs: {
          ...state.buffs,
          toggles: { ...state.buffs.toggles, [action.id]: { ...cur, active: action.active } },
        },
      }
    }

    case 'buffs/setValue': {
      const cur = state.buffs.toggles[action.id]
      if (!cur) return state
      return {
        ...state,
        buffs: {
          ...state.buffs,
          toggles: { ...state.buffs.toggles, [action.id]: { ...cur, value: action.value } },
        },
      }
    }

    case 'buffs/setMarked':
      return { ...state, buffs: { ...state.buffs, marked: action.marked } }

    case 'buffs/reset':
      return { ...state, buffs: cloneInitialBuffs() }

    case 'team/patchMember': {
      if (action.slot < 0 || action.slot >= state.team.members.length) return state
      const cur = state.team.members[action.slot]
      const next = { ...cur, ...action.patch }
      const members = state.team.members.slice()
      members[action.slot] = next
      return { ...state, team: { members } }
    }

    case 'team/setChar': {
      if (action.slot < 0 || action.slot >= state.team.members.length) return state
      const cur = state.team.members[action.slot]
      // Picking a new char (or clearing) wipes the class-gated fields so the
      // previous char's defender/ranger inputs don't leak across. Talisman
      // config survives the swap — same generic stat picker.
      const fresh: TeamMember = {
        ...INITIAL_TEAM_MEMBER,
        talisman: { ...cur.talisman },
        exquisiteDeath: { ...INITIAL_TEAM_MEMBER.exquisiteDeath },
        absoluteMusic: { ...INITIAL_TEAM_MEMBER.absoluteMusic },
        charId: action.charId,
        transStar: action.defaultTransStar ?? 0,
      }
      const members = state.team.members.slice()
      members[action.slot] = fresh
      return { ...state, team: { members } }
    }

    case 'team/setTransStar': {
      if (action.slot < 0 || action.slot >= state.team.members.length) return state
      const cur = state.team.members[action.slot]
      if (cur.transStar === action.transStar) return state
      const members = state.team.members.slice()
      members[action.slot] = { ...cur, transStar: action.transStar }
      return { ...state, team: { members } }
    }

    case 'team/clearMember': {
      if (action.slot < 0 || action.slot >= state.team.members.length) return state
      const members = state.team.members.slice()
      members[action.slot] = {
        ...INITIAL_TEAM_MEMBER,
        talisman: { ...INITIAL_TEAM_MEMBER.talisman },
        exquisiteDeath: { ...INITIAL_TEAM_MEMBER.exquisiteDeath },
        absoluteMusic: { ...INITIAL_TEAM_MEMBER.absoluteMusic },
      }
      return { ...state, team: { members } }
    }

    case 'team/reset':
      return { ...state, team: makeInitialTeam() }

    case 'boss/toggleMechanic':
      return {
        ...state,
        bossMechanics: {
          ...state.bossMechanics,
          [action.id]: { active: action.active },
        },
      }

    case 'boss/setOverride': {
      // Merge: preserve existing toggle state for keys that still exist in
      // the new override (so a re-fetch on the same monster doesn't wipe
      // operator picks), default-init keys that didn't exist before, drop
      // keys not in the new override.
      const next: Record<string, BossMechanicState> = {}
      if (action.override) {
        for (const m of action.override.mechanics) {
          next[m.id] = state.bossMechanics[m.id] ?? { active: false }
        }
      }
      return { ...state, bossOverride: action.override, bossMechanics: next }
    }

    case 'state/import':
      // `parseSharedState` upstream already filled defaults + reset runtime
      // fields — the action's payload is a fully-formed `CalcState` so we
      // swap it in directly. The lazy char-detail fetch effect in
      // `AttackerPanel` re-runs on the new charId and rehydrates `detail`.
      // The mechanics fetch effect re-fires on `state.target.monsterId` to
      // rehydrate `bossOverride` (the imported toggles survive via the merge
      // in `boss/setOverride`).
      return action.state
  }
}

/**
 * Map `lv60_ev3` (max evolution at lvl 60 — typical 6★ baseline) into the
 * UI's flat stat block. Values mirror the in-game character screen (CHC=5,
 * CHD=150 are already percentages). PEN isn't in `CharacterTemplet` —
 * it's purely a gear stat, so the prefill leaves it at 0.
 *
 * Returns null when the char has no curated stats (~10 NPCs surfaced for
 * completeness without a `data/generated/character-stats.json` entry).
 */
function prefillStatsFromDetail(detail: DamageCalcCharDetail): StatValues | null {
  const step = detail.baseStats?.lv60_ev3
  if (!step) return null
  return statsFromStep(step)
}

function statsFromStep(step: DamageCalcStatsStep): StatValues {
  return {
    ATK: step.ATK,
    DEF: step.DEF,
    HP: step.HP,
    SPD: step.SPD,
    CHC: step.CHC,
    CHD: step.CHD,
    EFF: step.EFF,
    RES: step.RES,
    PEN: 0,
    DMG_INC: step.DMG_INC,
  }
}

export { INITIAL_STATE }

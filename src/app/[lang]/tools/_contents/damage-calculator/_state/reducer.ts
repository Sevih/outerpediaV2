import type { DamageCalcCharDetail, DamageCalcMonsterStats, DamageCalcStatsStep } from '@/lib/data/damage-calc'
import {
  INITIAL_STATE, INITIAL_STATS, INITIAL_LOADOUT, INITIAL_MANUAL,
  type CalcState, type ManualTargetState, type SkillSlot, type StatKey, type StatValues, type TargetMode,
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
  | { type: 'attacker/setCrit'; crit: boolean }
  | { type: 'attacker/setTransStar'; tier: number }
  /** Auto-prefill — written by the effect that watches char/transcend/settings. */
  | { type: 'attacker/applyAutoStats'; stats: AutoStats }
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
  | { type: 'target/pickMonster'; stageId: string | null; monsterId: string | null }
  | { type: 'target/setMode'; mode: TargetMode }
  | { type: 'target/setManualField'; key: 'isBoss' | 'element'; value: boolean | string }
  | { type: 'target/setManualStat'; key: keyof DamageCalcMonsterStats; value: number }
  | { type: 'target/seedManual'; manual: ManualTargetState }
  | { type: 'target/resetManual' }

export function calcReducer(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {
    case 'attacker/pickChar': {
      // Optimistic char id update — `detailLoaded` follows once the fetch
      // resolves (or `detailFailed` clears the spinner). Equipment resets
      // because the loadout is per-char (especially EE which is char-specific).
      if (state.attacker.charId === action.charId && state.attacker.detail) return state
      return {
        ...state,
        attacker: {
          ...state.attacker,
          charId: action.charId,
          detail: null,
          loading: true,
          equipment: { ...INITIAL_LOADOUT, setSlots: [...INITIAL_LOADOUT.setSlots], ee: { ...INITIAL_LOADOUT.ee } },
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
        },
        // User typed → freeze auto-prefill until they reset or pick another char.
        statsDirty: true,
      }
    }

    case 'attacker/resetStats': {
      // Reset clears the dirty flag so the next render's auto-prefill effect
      // re-applies the no-gear sheet for the current settings + transcend.
      return {
        ...state,
        attacker: {
          ...state.attacker,
          stats: { ...INITIAL_STATS },
        },
        statsDirty: false,
      }
    }

    case 'attacker/applyAutoStats':
      return {
        ...state,
        attacker: { ...state.attacker, stats: action.stats },
      }

    case 'attacker/setSkillSlot':
      return { ...state, attacker: { ...state.attacker, skillSlot: action.slot } }
    case 'attacker/setSkillLevel':
      return { ...state, attacker: { ...state.attacker, skillLevel: action.level } }
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

    case 'target/pickMonster':
      // No-op when the (stage, monster) pair hasn't changed — keeps the
      // reducer pure-ish and avoids spurious re-renders downstream.
      if (state.target.stageId === action.stageId && state.target.monsterId === action.monsterId) return state
      return { ...state, target: { ...state.target, stageId: action.stageId, monsterId: action.monsterId } }

    case 'target/setMode':
      if (state.target.mode === action.mode) return state
      return { ...state, target: { ...state.target, mode: action.mode } }

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

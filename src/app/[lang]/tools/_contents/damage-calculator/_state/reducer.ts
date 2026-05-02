import type { DamageCalcCharDetail, DamageCalcStatsStep } from '@/lib/data/damage-calc'
import {
  INITIAL_STATE, INITIAL_STATS,
  type CalcState, type SkillSlot, type StatKey, type StatValues,
} from './types'

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

export function calcReducer(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {
    case 'attacker/pickChar': {
      // Optimistic char id update — `detailLoaded` follows once the fetch
      // resolves (or `detailFailed` clears the spinner).
      if (state.attacker.charId === action.charId && state.attacker.detail) return state
      return {
        ...state,
        attacker: {
          ...state.attacker,
          charId: action.charId,
          detail: null,
          loading: true,
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

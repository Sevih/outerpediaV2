/**
 * Damage Lab v2 — form reducer.
 *
 * Single reducer over `FormState`. Replaces the ~11 useState hooks the page
 * had in PR 7. Action shapes follow the catalog in `damage-lab-v2-ui-spec.md`
 * §4 — every change to attacker / target / external buffs / boss mechanics /
 * UI flags goes through one of the action types below.
 *
 * Cascade semantics:
 *   - `attacker/setChar` resets slot, skill level, charFlags, extraStats,
 *     additionalAttackEnabled (a new char starts fresh).
 *   - `attacker/setSlot` resets skill level + additionalAttackEnabled (other
 *     slots' DF and add-attack ratio change).
 *   - `target/setMode` clears stage + monster + element + isBoss + boss mechanics.
 *   - `target/setStage` clears monster + element + isBoss + boss mechanics.
 *   - `target/setMonster` syncs element + isBoss from the picked monster AND
 *     re-initializes boss mechanics for that monster's override (or {} if none).
 *   - `target/autoFillStats` overwrites all 4 stat fields and marks them auto.
 *   - `target/manualEditStat` patches one field and flips its `statsAuto.X` to false.
 */

import type { CallerSlot } from '@/lib/damage/v2/buffs'
import type { CharFlags } from '@/lib/damage/v2/char-overrides'
import {
  getBossOverride, makeDefaultBossMechanicsState,
} from '@/lib/damage/v2/boss-overrides'
import {
  makeDefaultExternalBuffsState, type ExternalBuffState,
} from '@/lib/damage/v2/external-buffs'
import type {
  AttackerState, FormState, MonsterOption, PoolCondState, TargetState,
} from './types'

export interface LoadFromObsPayload {
  attacker: Partial<AttackerState> & { charId: string; slot: CallerSlot }
  target: Partial<TargetState>
  poolConds?: Partial<PoolCondState>
  externalBuffs?: Record<string, ExternalBuffState>
}

// ── Action catalog ───────────────────────────────────────────────────────

export type FormAction =
  // Attacker
  | { type: 'attacker/patch';        patch: Partial<AttackerState> }
  | { type: 'attacker/setChar';      charId: string }
  | { type: 'attacker/setSlot';      slot: CallerSlot }
  | { type: 'attacker/setFlag';      flag: keyof CharFlags; value: boolean }
  | { type: 'attacker/autoFillStats'; stats: { atk: number; chd: number; pen: number; dmgInc: number };
                                       extraStats?: Record<string, number> }
  | { type: 'attacker/manualEditStat'; field: 'atk' | 'chd' | 'pen' | 'dmgInc'; value: number }
  // Target
  | { type: 'target/patch';          patch: Partial<TargetState> }
  | { type: 'target/setMode';        mode: string }
  | { type: 'target/setStage';       stageId: string }
  | { type: 'target/setMonster';     monster: MonsterOption }
  | { type: 'target/autoFillStats';  stats: { def: number; dmgRed: number; cdmgRed: number; hp: number | null } }
  | { type: 'target/manualEditStat'; field: 'def' | 'dmgRed' | 'cdmgRed' | 'hp'; value: number }
  // External buffs / debuffs
  | { type: 'externalBuff/toggle';   id: string; active: boolean }
  | { type: 'externalBuff/setValue'; id: string; value: number }
  // Boss mechanics
  | { type: 'bossMechanic/toggle';   id: string; active: boolean }
  | { type: 'bossMechanic/setValue'; id: string; value: number }
  // Pool conditions
  | { type: 'poolCond/patch';        patch: Partial<PoolCondState> }
  | { type: 'poolCond/reset' }
  // UI
  | { type: 'ui/setShowDebug';       value: boolean }
  // Form-level
  | { type: 'form/reset' }
  | { type: 'form/loadFromObs';      payload: LoadFromObsPayload }
  | { type: 'form/hydrate';          payload: Partial<FormState> }

// ── Initial state factory ────────────────────────────────────────────────

export function makeInitialFormState(): FormState {
  return {
    attacker: {
      charId: '', slot: 'S1', skillLevel: 5,
      atk: 10000, chd: 50, pen: 50, dmgInc: 0,
      statsAuto: { atk: true, chd: true, pen: true, dmgInc: true },
      crit: false, applyQuirks: true,
      additionalAttackEnabled: false,
      charFlags: {},
      extraStats: {},
    },
    target: {
      mode: '', stageId: null, monsterId: null, monsterName: null,
      element: '', isBoss: false,
      def: 1000, dmgRed: 0, cdmgRed: 0, hp: null,
      statsAuto: { def: true, dmgRed: true, cdmgRed: true, hp: true },
      C: 1000, ratioDivisor: 1000,
    },
    externalBuffs: makeDefaultExternalBuffsState(),
    bossMechanics: {},
    poolConds: makeDefaultPoolConds(),
    ui: { showDebug: false },
  }
}

export function makeDefaultPoolConds(): PoolCondState {
  return {
    ownerHpRate: 1, targetHpRate: 1, casterHpRate: 1,
    ownerBuffCount: 0, targetBuffCount: 0, ownerDebuffCount: 0, targetDebuffCount: 0,
    targetBroken: false,
    killCountStack: 0,
    teamBuffCount: 0, teamDecreaseCount: 0, enemyTeamDecreaseCount: 0,
    inMonadGate: false, inTower: false, inPvp: false,
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    // ── Attacker ─────────────────────────────────────────────────────────
    case 'attacker/patch':
      return { ...state, attacker: { ...state.attacker, ...action.patch } }

    case 'attacker/setChar':
      return {
        ...state,
        attacker: {
          ...state.attacker,
          charId: action.charId,
          slot: 'S1',
          skillLevel: 5,
          // Reset statsAuto so the page-level effect re-runs char-stats fetch
          // and overwrites previously-typed values from the prior char.
          statsAuto: { atk: true, chd: true, pen: true, dmgInc: true },
          additionalAttackEnabled: false,
          charFlags: {},
          extraStats: {},
        },
      }

    case 'attacker/setSlot':
      return {
        ...state,
        attacker: {
          ...state.attacker,
          slot: action.slot,
          skillLevel: 5,
          additionalAttackEnabled: false,
        },
      }

    case 'attacker/setFlag':
      return {
        ...state,
        attacker: {
          ...state.attacker,
          charFlags: { ...state.attacker.charFlags, [action.flag]: action.value },
        },
      }

    case 'attacker/autoFillStats':
      return {
        ...state,
        attacker: {
          ...state.attacker,
          // Only overwrite fields whose statsAuto is still true — never clobber
          // a manual edit. The page dispatches this once on char select; reducer
          // remains pure.
          atk:    state.attacker.statsAuto.atk    ? action.stats.atk    : state.attacker.atk,
          chd:    state.attacker.statsAuto.chd    ? action.stats.chd    : state.attacker.chd,
          pen:    state.attacker.statsAuto.pen    ? action.stats.pen    : state.attacker.pen,
          dmgInc: state.attacker.statsAuto.dmgInc ? action.stats.dmgInc : state.attacker.dmgInc,
          extraStats: action.extraStats ?? state.attacker.extraStats,
        },
      }

    case 'attacker/manualEditStat':
      return {
        ...state,
        attacker: {
          ...state.attacker,
          [action.field]: action.value,
          statsAuto: { ...state.attacker.statsAuto, [action.field]: false },
        },
      }

    // ── Target ───────────────────────────────────────────────────────────
    case 'target/patch':
      return { ...state, target: { ...state.target, ...action.patch } }

    case 'target/setMode':
      return {
        ...state,
        target: {
          ...state.target,
          mode: action.mode,
          stageId: null,
          monsterId: null,
          monsterName: null,
          element: '',
          isBoss: false,
        },
        bossMechanics: {},
      }

    case 'target/setStage':
      return {
        ...state,
        target: {
          ...state.target,
          stageId: action.stageId,
          monsterId: null,
          monsterName: null,
          element: '',
          isBoss: false,
        },
        bossMechanics: {},
      }

    case 'target/setMonster': {
      const m = action.monster
      const override = getBossOverride(m.id)
      return {
        ...state,
        target: {
          ...state.target,
          monsterId: m.id,
          monsterName: m.name,
          element: m.element,
          isBoss: m.isBoss,
        },
        bossMechanics: makeDefaultBossMechanicsState(override),
      }
    }

    case 'target/autoFillStats':
      return {
        ...state,
        target: {
          ...state.target,
          def:    action.stats.def,
          dmgRed: action.stats.dmgRed,
          cdmgRed: action.stats.cdmgRed,
          hp:     action.stats.hp,
          statsAuto: { def: true, dmgRed: true, cdmgRed: true, hp: true },
        },
      }

    case 'target/manualEditStat':
      return {
        ...state,
        target: {
          ...state.target,
          [action.field]: action.value,
          statsAuto: { ...state.target.statsAuto, [action.field]: false },
        },
      }

    // ── External buffs / debuffs ─────────────────────────────────────────
    case 'externalBuff/toggle':
      return {
        ...state,
        externalBuffs: {
          ...state.externalBuffs,
          [action.id]: {
            ...(state.externalBuffs[action.id] ?? { active: false, value: 0 }),
            active: action.active,
          },
        },
      }

    case 'externalBuff/setValue':
      return {
        ...state,
        externalBuffs: {
          ...state.externalBuffs,
          [action.id]: {
            ...(state.externalBuffs[action.id] ?? { active: false, value: 0 }),
            value: action.value,
          },
        },
      }

    // ── Boss mechanics ───────────────────────────────────────────────────
    case 'bossMechanic/toggle':
      return {
        ...state,
        bossMechanics: {
          ...state.bossMechanics,
          [action.id]: {
            ...(state.bossMechanics[action.id] ?? { active: false, value: 1.0 }),
            active: action.active,
          },
        },
      }

    case 'bossMechanic/setValue':
      return {
        ...state,
        bossMechanics: {
          ...state.bossMechanics,
          [action.id]: {
            ...(state.bossMechanics[action.id] ?? { active: false, value: 1.0 }),
            value: action.value,
          },
        },
      }

    // ── Pool conditions ──────────────────────────────────────────────────
    case 'poolCond/patch':
      return { ...state, poolConds: { ...state.poolConds, ...action.patch } }

    case 'poolCond/reset':
      return { ...state, poolConds: makeDefaultPoolConds() }

    // ── UI ───────────────────────────────────────────────────────────────
    case 'ui/setShowDebug':
      return { ...state, ui: { ...state.ui, showDebug: action.value } }

    // ── Form-level ───────────────────────────────────────────────────────
    case 'form/reset':
      return makeInitialFormState()

    case 'form/hydrate': {
      // Deep-merge a partial blob (typically from localStorage) into the
      // current state. Runs in a post-mount useEffect — NOT in the useReducer
      // initializer — so server SSR and the first client render use identical
      // defaults (no hydration mismatch).
      const loaded = action.payload
      return {
        attacker: {
          ...state.attacker,
          ...loaded.attacker,
          statsAuto: { ...state.attacker.statsAuto, ...(loaded.attacker?.statsAuto ?? {}) },
          charFlags: { ...state.attacker.charFlags, ...(loaded.attacker?.charFlags ?? {}) },
          extraStats: { ...state.attacker.extraStats, ...(loaded.attacker?.extraStats ?? {}) },
        },
        target: {
          ...state.target,
          ...loaded.target,
          statsAuto: { ...state.target.statsAuto, ...(loaded.target?.statsAuto ?? {}) },
        },
        externalBuffs: loaded.externalBuffs ?? state.externalBuffs,
        bossMechanics: loaded.bossMechanics ?? state.bossMechanics,
        poolConds: { ...state.poolConds, ...(loaded.poolConds ?? {}) },
        ui: { ...state.ui, ...(loaded.ui ?? {}) },
      }
    }

    case 'form/loadFromObs': {
      // Re-init from a saved observation. All stat fields are marked manual
      // (statsAuto false) so the page-level effects don't clobber them with
      // freshly-fetched defaults. Boss mechanics are reset to the monster's
      // override (the obs's bossMechanics blob is captured at save time but
      // not re-applied — operator dials them back in).
      const init = makeInitialFormState()
      const next: FormState = {
        attacker: {
          ...init.attacker,
          ...action.payload.attacker,
          statsAuto: { atk: false, chd: false, pen: false, dmgInc: false },
        },
        target: {
          ...init.target,
          ...action.payload.target,
          statsAuto: { def: false, dmgRed: false, cdmgRed: false, hp: false },
        },
        externalBuffs: action.payload.externalBuffs ?? init.externalBuffs,
        bossMechanics: makeDefaultBossMechanicsState(getBossOverride(action.payload.target.monsterId)),
        poolConds: { ...init.poolConds, ...(action.payload.poolConds ?? {}) },
        ui: state.ui,
      }
      return next
    }
  }
}

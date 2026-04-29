/**
 * Damage Lab v2 — form state types.
 *
 * Shape consumed by the page reducer (PR 8) and selectors (PR 9). For now
 * (PR 7) the components import these directly while the page uses local
 * `useState` hooks. Switching to `useReducer` in PR 8 won't change the
 * component contracts.
 *
 * Reference: `data/admin/damage-lab-v2-ui-spec.md` §4.
 */

import type { CallerSlot } from '@/lib/damage/v2/buffs'
import type { CharFlags } from '@/lib/damage/v2/char-overrides'
import type { ExternalBuffState } from '@/lib/damage/v2/external-buffs'
import type { BossMechanicState } from '@/lib/damage/v2/boss-overrides'

export interface CharSummary {
  id: string
  name: string
  element: 'Earth' | 'Water' | 'Fire' | 'Light' | 'Dark'
  /** Defender / Attacker / Ranger / Mage / Priest (in-game label). */
  class: string
  /** ATTACKER, BRUISER, WIZARD, … (uppercase). */
  subclass: string
  portraitUrl: string
}

export interface AttackerState {
  charId: string
  slot: CallerSlot
  /** 1..15, default 5. */
  skillLevel: number
  atk: number
  /** % */
  chd: number
  /** % */
  pen: number
  /** % */
  dmgInc: number
  /** True = stat came from `/api/admin/characters/:id/stats`; false = manually edited. */
  statsAuto: { atk: boolean; chd: boolean; pen: boolean; dmgInc: boolean }
  crit: boolean
  /** Apply awakening passives (boss +30, mage +12, adv +50). */
  applyQuirks: boolean
  /** Toggle for skills with a conditional sub-attack (Luna's Barrier, etc.). */
  additionalAttackEnabled: boolean
  charFlags: CharFlags
  /** ST_HP / ST_DEF / ST_CRITICAL_RATE / etc. — for secondary scaling. */
  extraStats: Record<string, number>
}

export interface ModeOption {
  id: string
  label: string
}

export interface StageOption {
  id: string
  label: string
}

export interface MonsterOption {
  id: string
  name: string
  element: string
  isBoss: boolean
}

export interface TargetState {
  mode: string
  stageId: string | null
  monsterId: string | null
  monsterName: string | null
  /** Copied at selection time. */
  element: string
  isBoss: boolean
  // Stats — auto-fetched, overridable
  def: number
  /** % */
  dmgRed: number
  /** % */
  cdmgRed: number
  /** Required only for `BT_DMG_TARGET_STAT` (Noa S2). */
  hp: number | null
  /** True = value came from API; false = manually edited. */
  statsAuto: { def: boolean; dmgRed: boolean; cdmgRed: boolean; hp: boolean }
  // Constantes formula (tunables debug)
  C: number
  ratioDivisor: number
}

/**
 * Pool-condition inputs (BT_DMG_* multipliers) surfaced as click-to-set
 * counters / flags in the lab UI. Each value matches a `PoolCondition` key
 * from `src/lib/damage/v2/buffs.ts`. Defaults: HP rates → 1 (full HP),
 * counts → 0, flags → false.
 *
 * NEW vs v1: `enemyTeamDecreaseCount` is its own field (PR 4bis fix —
 * type 94 isolated from type 103 `teamDecreaseCount`).
 */
export interface PoolCondState {
  /** 0..1, caster HP fraction. */
  ownerHpRate: number
  /** 0..1, target HP fraction. */
  targetHpRate: number
  /** 0..1, original-caster HP. Default = ownerHpRate. */
  casterHpRate: number
  ownerBuffCount: number
  targetBuffCount: number
  ownerDebuffCount: number
  targetDebuffCount: number
  targetBroken: boolean
  killCountStack: number
  teamBuffCount: number
  /** MY_TEAM_DECREASE — count of dead allies on the caster's team. */
  teamDecreaseCount: number
  /** ENEMY_TEAM_DECREASE — count of dead enemies on the opposing team (Maxwell type 94). */
  enemyTeamDecreaseCount: number
  inMonadGate: boolean
  inTower: boolean
  inPvp: boolean
}

export interface FormState {
  attacker: AttackerState
  target: TargetState
  externalBuffs: Record<string, ExternalBuffState>
  bossMechanics: Record<string, BossMechanicState>
  poolConds: PoolCondState
  ui: { showDebug: boolean }
}

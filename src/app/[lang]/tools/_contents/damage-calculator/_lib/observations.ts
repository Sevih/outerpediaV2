import type { ApplicableBuff } from '@/lib/damage/v2/buffs'
import { recompute, guildHpPctForLevel } from '@/lib/damage/v2/recompute'
import type { RecomputeContext } from '@/lib/damage/v2/recompute'

/**
 * Dev-only observation table support.
 *
 * The Damage Lab v2 admin saves human-recorded damage values into a
 * JSONL file at `data/admin/damage-lab-observations-v2.jsonl`. Each row
 * carries a snapshot of the admin's `RecomputeContext` (caster + skill +
 * target + pool conds + …) so the formula can be re-evaluated on-demand
 * without needing the original UI state.
 *
 * The public calc reads that same file (gated on `NODE_ENV === 'development'`
 * via the server component) so we can spot divergences between what the
 * admin lab computes today and what the formula returns when re-played by
 * our own pipeline. ANY delta points at:
 *   - a buff catalog mismatch (the admin had a buff our public bake doesn't)
 *   - a context-composition bug (we miss a field the admin sets)
 *   - a formula change (`recompute()` updated since the obs was saved)
 *
 * The `ObservationV2` interface is duplicated from
 * `src/app/api/admin/damage-lab/v2/observations/route.ts` because the
 * admin tree is excluded from the prod bundle — keep them in sync when
 * the admin schema evolves.
 */

export interface ObservationV2 {
  id: string
  ts: string
  charId: string
  charName: string
  charElement: string
  charClass: string
  charSubclass: string
  slot: 'S1' | 'S2' | 'S3'
  skillLevel: number
  df: number
  additionalAttackEnabled?: boolean
  additionalAttackRatio?: number
  atk: number
  chd: number
  pen: number
  dmgInc: number
  applyQuirks: boolean
  extraStats?: Record<string, number>
  charFlags?: { umeActive?: boolean; sakuraActive?: boolean }
  atkScaling?: {
    baseMax: number
    flat: number
    pctBonus: number
    codexPct: number
    transcendPct: number
  }
  guildLevel?: number
  guildHpBuffPct?: number
  codexLevel?: number
  eeEnabled?: boolean
  eeLevel?: number
  eeVariant?: 'self' | 'base'
  targetDef: number
  targetDmgRed: number
  targetCdmgRed: number
  targetHp?: number
  isBoss: boolean
  elem: 'none' | 'adv' | 'disadv'
  mode?: string
  modeLabel?: string
  stageId?: string
  stageName?: string
  monsterId?: string
  monsterName?: string
  monsterLvl?: number
  monsterElement?: string
  monsterClass?: string
  monsterType?: string
  ownerHpRate?: number
  targetHpRate?: number
  casterHpRate?: number
  ownerBuffCount?: number
  targetBuffCount?: number
  ownerDebuffCount?: number
  targetDebuffCount?: number
  targetBroken?: boolean
  killCountStack?: number
  teamBuffCount?: number
  teamDecreaseCount?: number
  enemyTeamDecreaseCount?: number
  inMonadGate?: boolean
  inTower?: boolean
  inPvp?: boolean
  externalBuffs?: Record<string, { active: boolean; value: number }>
  bossMechanics?: Record<string, { active: boolean; value?: number }>
  // bossOverride intentionally typed loose here — it's a snapshot the formula
  // consumes opaquely (the BossOverride type lives in @/lib/damage/v2 and is
  // passed through verbatim).
  bossOverride?: unknown
  crit: boolean
  obs: number
  note?: string
  calculatedAtSave?: number
}

/** Replay an observation through `recompute()`. Mirrors the admin's
 *  `recomputeFromObs` line-for-line — if they diverge, look here first. */
export function recomputeFromObs(o: ObservationV2, buffs: ApplicableBuff[], baseCharIdLookup: (charId: string) => string | undefined): number {
  const baseCharId = baseCharIdLookup(o.charId)
  const ctx: RecomputeContext = {
    charId: o.charId,
    charElement: o.charElement,
    charClass: o.charClass,
    charSubclass: o.charSubclass,
    slot: o.slot,
    damageFactor: o.df,
    additionalAttackRatio: o.additionalAttackEnabled ? o.additionalAttackRatio : undefined,
    atk: o.atk,
    chd: o.chd,
    pen: o.pen,
    dmgInc: o.dmgInc,
    applyQuirks: o.applyQuirks,
    extraStats: o.extraStats,
    atkScaling: o.atkScaling,
    guildHpBuffPct: o.guildLevel != null
      ? guildHpPctForLevel(o.guildLevel)
      : o.guildHpBuffPct,
    targetDef: o.targetDef,
    targetDmgRed: o.targetDmgRed,
    targetCdmgRed: o.targetCdmgRed,
    targetHp: o.targetHp,
    isBoss: o.isBoss,
    elem: o.elem,
    crit: o.crit,
    mode: o.mode,
    monsterId: o.monsterId,
    charFlags: o.charFlags,
    ownerHpRate: o.ownerHpRate,
    targetHpRate: o.targetHpRate,
    casterHpRate: o.casterHpRate,
    ownerBuffCount: o.ownerBuffCount,
    targetBuffCount: o.targetBuffCount,
    ownerDebuffCount: o.ownerDebuffCount,
    targetDebuffCount: o.targetDebuffCount,
    targetBroken: o.targetBroken,
    killCountStack: o.killCountStack,
    teamBuffCount: o.teamBuffCount,
    teamDecreaseCount: o.teamDecreaseCount,
    enemyTeamDecreaseCount: o.enemyTeamDecreaseCount,
    inMonadGate: o.inMonadGate,
    inTower: o.inTower,
    inPvp: o.inPvp,
    externalBuffs: o.externalBuffs,
    bossMechanics: o.bossMechanics,
    bossOverride: o.bossOverride as RecomputeContext['bossOverride'],
    eeEnabled: o.eeEnabled,
    eeLevel: o.eeLevel,
    eeCharId: o.eeVariant === 'base' ? (baseCharId ?? o.charId) : o.charId,
    targetElement: o.monsterElement,
  }
  return recompute(ctx, buffs).calculated
}

// `loadObservations` lives in `./load-observations` (server-only) — the fs
// read can't ship to the client bundle since this file is also imported by
// `ObsTablePanel` (a 'use client' component) for the type + recompute helper.

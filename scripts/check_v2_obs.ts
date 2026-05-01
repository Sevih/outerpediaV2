import fs from 'node:fs'
import path from 'node:path'
import { recompute, type RecomputeContext } from '../src/lib/damage/v2/recompute'
import { extractAwakeningBuffs, extractCharSkillBuffs } from '../src/lib/damage/v2/extract-buffs'
import { extractEEBuffs } from '../src/lib/damage/v2/extract-ee'
import type { ApplicableBuff } from '../src/lib/damage/v2/buffs'
import type { BossOverride } from '../src/lib/damage/v2/boss-overrides'

const J = path.join(process.cwd(), 'data', 'admin', 'json2')
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(J, f), 'utf-8'))

const nodes = load('CharacterAwakeningNodeTemplet.json')
const lvls  = load('CharacterAwakeningLevelTemplet.json')
const buffs = load('BuffTemplet.json')
const chars = load('CharacterTemplet.json')
const skl   = load('CharacterSkillLevelTemplet.json')
const text  = load('TextSystem.json')
type Row = Record<string, string | undefined>
const ts = new Map<string, { English: string }>()
for (const t of text) if ((t as Row).ID) ts.set((t as Row).ID!, { English: (t as Row).English ?? '' })

const items     = load('ItemTemplet.json')
const itemOpts  = load('ItemOptionTemplet.json')
const itemSpec  = load('ItemSpecialOptionTemplet.json')
const textItemRows = load('TextItem.json')
const textItem = new Map<string, string>()
for (const t of textItemRows) if ((t as Row).ID) textItem.set((t as Row).ID!, (t as Row).English ?? '')

const all: ApplicableBuff[] = [
  ...extractAwakeningBuffs({ nodes, levels: lvls, buffs, textSystem: ts }),
  ...extractCharSkillBuffs({
    characters: chars.filter((r: Row) => r.ID).map((r: Row) => r as { ID: string } & Row),
    skillLevels: skl.filter((r: Row) => r.SkillID).map((r: Row) => ({ SkillID: r.SkillID!, SkillLevel: r.SkillLevel ?? '0', BuffID: r.BuffID })),
    buffs: buffs.map((b: Row) => ({
      ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type, StatType: b.StatType,
      ApplyingType: b.ApplyingType, Value: b.Value, BuffConditionType: b.BuffConditionType,
      BuffConditionValue: b.BuffConditionValue, TargetType: b.TargetType,
      TargetSkillType: b.TargetSkillType, CallerSkillType: b.CallerSkillType,
      BuffCreateType: b.BuffCreateType,
    })),
  }),
  ...extractEEBuffs({
    items, itemOptions: itemOpts, itemSpecialOptions: itemSpec, textItem,
    buffs: buffs.map((b: Row) => ({
      ID: b.ID, BuffID: b.BuffID, Level: b.Level, Type: b.Type, StatType: b.StatType,
      ApplyingType: b.ApplyingType, Value: b.Value, BuffConditionType: b.BuffConditionType,
      BuffConditionValue: b.BuffConditionValue, TargetType: b.TargetType,
      TargetSkillType: b.TargetSkillType, CallerSkillType: b.CallerSkillType,
      BuffCreateType: b.BuffCreateType,
    })),
  }),
]

const obsText = fs.readFileSync('data/admin/damage-lab-observations-v2.jsonl', 'utf-8')
type Obs = Record<string, unknown>
const observations: Obs[] = obsText.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as Obs)

console.log('  # | char    | slot | crit | adv  | xATK | tag    | tgt        | obs   | calc  | ratio')
console.log('----+---------+------+------+------+------+--------+------------+-------+-------+------')
for (let i = 0; i < observations.length; i++) {
  const o = observations[i] as Record<string, never> & {
    charId: string; charElement: string; charClass: string; charSubclass: string;
    slot: 'S1'|'S2'|'S3'; df: number; atk: number; chd: number; pen: number; dmgInc: number;
    applyQuirks: boolean; extraStats?: Record<string, number>;
    atkScaling?: { baseMax: number; flat: number; pctBonus: number; codexPct: number; transcendPct: number };
    targetDef: number; targetDmgRed: number; targetCdmgRed: number; targetHp?: number;
    isBoss: boolean; elem: 'none'|'adv'|'disadv'; crit: boolean;
    mode?: string; monsterId?: string; charFlags?: { umeActive?: boolean; sakuraActive?: boolean; ownerResourceMax?: boolean };
    ownerHpRate?: number; targetHpRate?: number; casterHpRate?: number;
    ownerBuffCount?: number; targetBuffCount?: number; ownerDebuffCount?: number; targetDebuffCount?: number;
    targetBroken?: boolean; killCountStack?: number;
    teamBuffCount?: number; teamDecreaseCount?: number; enemyTeamDecreaseCount?: number;
    inMonadGate?: boolean; inTower?: boolean; inPvp?: boolean;
    externalBuffs?: Record<string, { active: boolean; value: number }>;
    bossMechanics?: Record<string, { active: boolean; value?: number }>;
    bossOverride?: BossOverride | null;
    eeEnabled?: boolean; eeLevel?: number; monsterElement?: string;
    obs: number; charName: string; monsterName?: string;
  }

  const ctx: RecomputeContext = {
    charId: o.charId, charElement: o.charElement, charClass: o.charClass, charSubclass: o.charSubclass,
    slot: o.slot, damageFactor: o.df,
    atk: o.atk, chd: o.chd, pen: o.pen, dmgInc: o.dmgInc,
    applyQuirks: o.applyQuirks, extraStats: o.extraStats,
    atkScaling: o.atkScaling,
    targetDef: o.targetDef, targetDmgRed: o.targetDmgRed, targetCdmgRed: o.targetCdmgRed,
    targetHp: o.targetHp, isBoss: o.isBoss, elem: o.elem, crit: o.crit,
    mode: o.mode, monsterId: o.monsterId, charFlags: o.charFlags,
    ownerHpRate: o.ownerHpRate, targetHpRate: o.targetHpRate, casterHpRate: o.casterHpRate,
    ownerBuffCount: o.ownerBuffCount, targetBuffCount: o.targetBuffCount,
    ownerDebuffCount: o.ownerDebuffCount, targetDebuffCount: o.targetDebuffCount,
    targetBroken: o.targetBroken, killCountStack: o.killCountStack,
    teamBuffCount: o.teamBuffCount, teamDecreaseCount: o.teamDecreaseCount,
    enemyTeamDecreaseCount: o.enemyTeamDecreaseCount,
    inMonadGate: o.inMonadGate, inTower: o.inTower, inPvp: o.inPvp,
    externalBuffs: o.externalBuffs, bossMechanics: o.bossMechanics, bossOverride: o.bossOverride,
    guildHpBuffPct: (o as { guildHpBuffPct?: number }).guildHpBuffPct,
    eeEnabled: o.eeEnabled, eeLevel: o.eeLevel, targetElement: o.monsterElement,
  }
  const r = recompute(ctx, all)
  const ratio = (o.obs / r.calculated).toFixed(3)
  const xAtk = o.externalBuffs && o.externalBuffs['a-buff-atk']?.active ? '+30%' : '—'
  const tgt = (o.monsterName ?? '?').padEnd(10)
  const slot = o.slot.padEnd(4)
  const crit = o.crit ? '  T  ' : '     '
  const elem = (o.elem || 'none').padEnd(4)
  // Compact tag for active boss mechanics + char flags
  const tags: string[] = []
  if (o.bossMechanics) {
    for (const [id, s] of Object.entries(o.bossMechanics)) {
      if (s?.active) tags.push(id === 'enrage' ? 'EN' : 'PR')
    }
  }
  if (o.charFlags?.ownerResourceMax) tags.push('Kz')
  const tag = tags.join('+').padEnd(6)
  console.log(`  ${(i+1).toString().padStart(2)} | ${o.charName.padEnd(7)} | ${slot} | ${crit} | ${elem} | ${xAtk.padEnd(4)} | ${tag} | ${tgt} | ${o.obs.toString().padStart(5)} | ${r.calculated.toString().padStart(5)} | ${ratio}`)
}

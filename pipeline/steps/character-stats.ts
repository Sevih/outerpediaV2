import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { PATHS } from '../config';
import { writeFileAtomicSync } from '../lib/write-json';

const OUTPUT_FILE = join(PATHS.generated, 'character-stats.json');
const CHECKSUM_FILE = join(PATHS.generated, '.character-stats-checksum');

// Source JSON files we depend on
const SOURCE_FILES = [
  'CharacterTemplet.json',
  'CharacterEvolutionStatTemplet.json',
  'CharacterSkillLevelTemplet.json',
  'BuffTemplet.json',
  'CharacterMaxLevelTemplet.json',
];

// Stat column mappings in CharacterTemplet
const STAT_COLUMNS: Record<string, [string, string]> = {
  ATK: ['Atk_Min', 'Atk_Max'],
  DEF: ['Def_Min', 'Def_Max'],
  HP:  ['HP_Min', 'HP_Max'],
  SPD: ['Speed_Min', 'Speed_Max'],
  EFF: ['BuffChance_Min', 'BuffChance_Max'],
  RES: ['BuffResist_Min', 'BuffResist_Max'],
  CHC: ['CriticalRate_Min', 'CriticalRate_Max'],
  CHD: ['CriticalDMGRate_Min', 'CriticalDMGRate_Max'],
};

const EVO_STAT_MAP: Record<string, string> = {
  ST_ATK: 'ATK', ST_DEF: 'DEF', ST_HP: 'HP',
  ST_SPEED: 'SPD', ST_BUFF_CHANCE: 'EFF', ST_BUFF_RESIST: 'RES',
  ST_DMG_REDUCE_RATE: 'DMG_RED', ST_DMG_BOOST: 'DMG_INC',
};

const PREMIUM_STAT_DISPLAY: Record<string, string> = {
  ST_DEF: 'DEF', ST_ATK: 'ATK', ST_HP: 'HP',
  ST_CRITICAL_RATE: 'CHC', ST_CRITICAL_DMG_RATE: 'CHD', ST_SPEED: 'SPD',
  ST_BUFF_CHANCE: 'EFF', ST_BUFF_RESIST: 'RES',
  ST_DMG_REDUCE_RATE: 'DMG_RED', ST_DMG_BOOST: 'DMG_INC',
};

const EVO_STEPS: [number, number, number[]][] = [
  [1,   0, []],
  [20,  1, [2]],
  [40,  2, [2, 3]],
  [60,  3, [2, 3, 4]],
  [80,  4, [2, 3, 4, 5]],
  [100, 5, [2, 3, 4, 5, 6]],
  [105, 6, [2, 3, 4, 5, 6, 7]],
  [110, 7, [2, 3, 4, 5, 6, 7, 8]],
  [120, 8, [2, 3, 4, 5, 6, 7, 8, 9]],
];

const ALL_STATS = ['ATK', 'DEF', 'HP', 'SPD', 'EFF', 'RES', 'CHC', 'CHD', 'DMG_RED', 'DMG_INC'];

// ─── Checksum ───────────────────────────────────────────────────────

function computeChecksum(): string | null {
  const combined = createHash('md5');
  for (const file of SOURCE_FILES) {
    const p = join(PATHS.adminJson2, file);
    if (!existsSync(p)) return null;
    const md5 = createHash('md5').update(readFileSync(p)).digest('hex');
    combined.update(md5);
  }
  return combined.digest('hex');
}

function isUpToDate(): boolean {
  if (!existsSync(OUTPUT_FILE) || !existsSync(CHECKSUM_FILE)) return false;
  const stored = readFileSync(CHECKSUM_FILE, 'utf-8').trim();
  const current = computeChecksum();
  return current !== null && stored === current;
}

// ─── Lookups ────────────────────────────────────────────────────────

function buildBuffLookup(data: Record<string, string>[]): Record<string, Record<string, string>> {
  const lookup: Record<string, Record<string, string>> = {};
  for (const entry of data) {
    const bid = entry.BuffID ?? '';
    if (bid) lookup[bid] = entry;
  }
  return lookup;
}

function buildSkillLevelLookup(data: Record<string, string>[]): Record<string, Set<string>> {
  const lookup: Record<string, Set<string>> = {};
  for (const entry of data) {
    const sid = entry.SkillID ?? '';
    const buffId = entry.BuffID ?? '';
    if (!sid || !buffId) continue;
    if (!lookup[sid]) lookup[sid] = new Set();
    for (const bid of buffId.split(',').map(s => s.trim())) {
      if (bid) lookup[sid].add(bid);
    }
  }
  return lookup;
}

interface LimitBreakStep {
  step: number;
  requireLevel: number;
  maxLevel: number;
  factors: number;
  recallItemId: string;
  gold: number;
  statModifier: number;
}

function buildMaxLevelLookup(data: Record<string, string>[]): Record<string, LimitBreakStep[]> {
  const lookup: Record<string, LimitBreakStep[]> = {};
  for (const entry of data) {
    const key = `${entry.BasicStar}_${entry.Element}`;
    const step: LimitBreakStep = {
      step: parseInt(entry.Step ?? '0', 10),
      requireLevel: parseInt(entry.RequireLevel ?? '0', 10),
      maxLevel: parseInt(entry.MaxLevel ?? '0', 10),
      factors: parseInt(entry.CharBreakPieceQuantity ?? '0', 10),
      recallItemId: entry.CharBreakPieceRecallItemID ?? '',
      gold: parseInt(entry.Price ?? '0', 10),
      statModifier: parseInt(entry.LevelUpStatModifierAfter100 ?? '0', 10),
    };
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push(step);
  }
  for (const arr of Object.values(lookup)) arr.sort((a, b) => a.step - b.step);
  return lookup;
}

function buildEvoLookup(data: Record<string, string>[]): Record<string, Record<number, Record<string, number>>> {
  const lookup: Record<string, Record<number, Record<string, number>>> = {};
  for (const entry of data) {
    const cid = entry.CharacterID ?? '';
    if (!cid) continue;
    const evLv = parseInt(entry.EvolutionLevel ?? '0', 10);
    if (isNaN(evLv)) continue;

    const bonuses: Record<string, number> = {};
    for (let i = 1; i <= 3; i++) {
      const statType = entry[`RewardStatType_${i}`] ?? '';
      const value = entry[`RewardValue_${i}`] ?? '';
      if (statType && value) {
        const statName = EVO_STAT_MAP[statType] ?? statType;
        const v = parseInt(value, 10);
        if (!isNaN(v)) bonuses[statName] = v;
      }
    }
    if (!lookup[cid]) lookup[cid] = {};
    lookup[cid][evLv] = bonuses;
  }
  return lookup;
}

// ─── Premium buff ───────────────────────────────────────────────────

interface PremiumBuff {
  buffID: string;
  stat: string;
  applyingType: string;
  value: number;
}

function getPremiumBuff(
  skill8: string,
  skillLevelLookup: Record<string, Set<string>>,
  buffLookup: Record<string, Record<string, string>>,
): PremiumBuff | null {
  const buffIds = skillLevelLookup[skill8];
  if (!buffIds) return null;

  for (const bid of buffIds) {
    const buff = buffLookup[bid];
    if (buff && buff.Type === 'BT_STAT_PREMIUM') {
      return {
        buffID: bid,
        stat: PREMIUM_STAT_DISPLAY[buff.StatType ?? ''] ?? buff.StatType ?? '',
        applyingType: buff.ApplyingType ?? '',
        value: parseInt(buff.Value ?? '0', 10),
      };
    }
  }
  return null;
}

function computePremiumValue(premium: PremiumBuff, baseStatValue: number): number | null {
  if (premium.applyingType === 'OAT_ADD') return premium.value / 10;
  if (premium.applyingType === 'OAT_RATE') return Math.floor(baseStatValue * premium.value / 1000);
  return null;
}

// ─── Main ───────────────────────────────────────────────────────────

export async function run() {
  // Check sources exist
  const allExist = SOURCE_FILES.every(f => existsSync(join(PATHS.adminJson2, f)));
  if (!allExist) {
    if (existsSync(OUTPUT_FILE)) return 'skipped (no datamine, using existing)';
    throw new Error('character-stats.json is missing and cannot be generated without datamine');
  }

  if (isUpToDate()) return 'skipped (up to date)';

  // Load pre-parsed JSON (json2 = flat arrays)
  const charData: Record<string, string>[] = JSON.parse(readFileSync(join(PATHS.adminJson2, 'CharacterTemplet.json'), 'utf-8'));
  const evoData: Record<string, string>[] = JSON.parse(readFileSync(join(PATHS.adminJson2, 'CharacterEvolutionStatTemplet.json'), 'utf-8'));
  const skillLevelData: Record<string, string>[] = JSON.parse(readFileSync(join(PATHS.adminJson2, 'CharacterSkillLevelTemplet.json'), 'utf-8'));
  const buffData: Record<string, string>[] = JSON.parse(readFileSync(join(PATHS.adminJson2, 'BuffTemplet.json'), 'utf-8'));
  const maxLevelData: Record<string, string>[] = JSON.parse(readFileSync(join(PATHS.adminJson2, 'CharacterMaxLevelTemplet.json'), 'utf-8'));

  // Build lookups
  const buffLookup = buildBuffLookup(buffData);
  const skillLevelLookup = buildSkillLevelLookup(skillLevelData);
  const evoLookup = buildEvoLookup(evoData);
  const maxLevelLookup = buildMaxLevelLookup(maxLevelData);

  // Find all 2000XXX / 2700XXX characters
  const characters = charData.filter((row) => {
    const id = row.ID ?? '';
    return id.startsWith('2000') || id.startsWith('2700');
  });

  const results: Record<string, unknown> = {};

  for (const char of characters) {
    const cid = char.ID;

    const info = {
      id: cid,
      class: char.Class ?? '',
      subclass: char.SubClass ?? '',
      element: char.Element ?? '',
      star: char.BasicStar ?? '',
    };

    // Base stat ranges
    const base: Record<string, { min: number; max: number }> = {};
    for (const [stat, [minCol, maxCol]] of Object.entries(STAT_COLUMNS)) {
      const mn = parseInt(char[minCol] ?? '0', 10) || 0;
      let mx = parseInt(char[maxCol] ?? '0', 10) || 0;
      if (stat === 'CHD' && mx === 0) mx = mn;
      base[stat] = { min: mn, max: mx };
    }

    const charEvo = evoLookup[cid] ?? {};
    const skillId = char.Skill_23 ?? char.Skill_22 ?? '';
    const premium = skillId ? getPremiumBuff(skillId, skillLevelLookup, buffLookup) : null;

    // Compute stats at each evo step
    const steps: Record<string, Record<string, number | null>> = {};
    for (const [level, evoCount, evLevels] of EVO_STEPS) {
      const cumEvo: Record<string, number> = {};
      for (const elv of evLevels) {
        if (charEvo[elv]) {
          for (const [stat, val] of Object.entries(charEvo[elv])) {
            cumEvo[stat] = (cumEvo[stat] ?? 0) + val;
          }
        }
      }

      const stepStats: Record<string, number | null> = {};
      for (const stat of ALL_STATS) {
        if (stat === 'CHC' || stat === 'CHD') {
          stepStats[stat] = base[stat].min / 10;
        } else if (stat === 'DMG_RED' || stat === 'DMG_INC') {
          stepStats[stat] = (cumEvo[stat] ?? 0) / 10;
        } else {
          const mn = base[stat].min;
          const mx = base[stat].max;
          const rng = mx - mn;
          const growth = rng > 0 ? Math.floor(rng * (level - 1) / 99) : 0;
          stepStats[stat] = mn + growth + (cumEvo[stat] ?? 0);
        }
      }

      if (premium && premium.stat in stepStats) {
        stepStats.premium_value = computePremiumValue(premium, stepStats[premium.stat] as number);
      }

      steps[`lv${level}_ev${evoCount}`] = stepStats;
    }

    const limitBreak = maxLevelLookup[`${info.star}_${info.element}`] ?? [];

    results[cid] = {
      info,
      premium: {
        skill_23: skillId,
        buffID: premium?.buffID ?? null,
        stat: premium?.stat ?? null,
        applyingType: premium?.applyingType ?? null,
        rawValue: premium?.value ?? null,
      },
      steps,
      limitBreak,
    };
  }

  // Save
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileAtomicSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  const checksum = computeChecksum();
  if (checksum) {
    writeFileSync(CHECKSUM_FILE, checksum, 'utf-8');
  }

  return `${Object.keys(results).length} characters`;
}

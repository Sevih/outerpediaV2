import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { PATHS } from '../config';

const OUTPUT_FILE = join(PATHS.generated, 'character-stats.json');
const CHECKSUM_FILE = join(PATHS.generated, '.character-stats-checksum');

// Source JSON files we depend on
const SOURCE_FILES = [
  'CharacterTemplet.json',
  'CharacterEvolutionStatTemplet.json',
  'CharacterSkillLevelTemplet.json',
  'BuffTemplet.json',
];

// Stat column mappings in CharacterTemplet
const STAT_COLUMNS: Record<string, [string, string]> = {
  ATK: ['Atk_Min', 'Atk_Max'],
  DEF: ['Def_Min', 'DMGReduceRate_Max'],
  HP:  ['HP_Min', 'WG_Max'],
  SPD: ['Speed_Min', 'Speed_Max'],
  EFF: ['BuffChance_Min', 'BuffChance_Max'],
  RES: ['BuffResist_Min', 'EnemyCriticalDamageReduce_Max'],
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
  ST_CRITICAL_RATE: 'CHC', ST_SPEED: 'SPD',
  ST_BUFF_CHANCE: 'EFF', ST_BUFF_RESIST: 'RES',
};

const EVO_STEPS: [number, number, number[]][] = [
  [1,   0, []],
  [20,  1, [2]],
  [40,  2, [2, 3]],
  [60,  3, [2, 3, 4]],
  [80,  4, [2, 3, 4, 5]],
  [100, 5, [2, 3, 4, 5, 6]],
];

const ALL_STATS = ['ATK', 'DEF', 'HP', 'SPD', 'EFF', 'RES', 'CHC', 'CHD', 'DMG_RED', 'DMG_INC'];

// ─── Checksum ───────────────────────────────────────────────────────

function computeChecksum(): string | null {
  const combined = createHash('md5');
  for (const file of SOURCE_FILES) {
    const p = join(PATHS.adminJson, file);
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

function buildSkillLevelLookup(data: Record<string, string>[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const entry of data) {
    const sid = entry.SkillID ?? '';
    if (sid && !(sid in lookup)) {
      lookup[sid] = entry.BuffID ?? entry.DescID ?? entry.GainAP ?? '';
    }
  }
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
      let value = entry[`RewardValue_${i}`] ?? '';
      if (!value) value = entry[`RewardStatType_${i}_fallback1`] ?? '';
      if (!value) value = entry[`RewardValue_${i}_fallback1`] ?? '';
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
  skill23: string,
  skillLevelLookup: Record<string, string>,
  buffLookup: Record<string, Record<string, string>>,
): PremiumBuff | null {
  const descStr = skillLevelLookup[skill23] ?? '';
  if (!descStr) return null;

  for (const bid of descStr.split(',').map(s => s.trim())) {
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
  const allExist = SOURCE_FILES.every(f => existsSync(join(PATHS.adminJson, f)));
  if (!allExist) {
    if (existsSync(OUTPUT_FILE)) return 'skipped (no datamine, using existing)';
    throw new Error('character-stats.json is missing and cannot be generated without datamine');
  }

  if (isUpToDate()) return 'skipped (up to date)';

  // Load pre-parsed JSON
  const charData = JSON.parse(readFileSync(join(PATHS.adminJson, 'CharacterTemplet.json'), 'utf-8')).data;
  const evoData = JSON.parse(readFileSync(join(PATHS.adminJson, 'CharacterEvolutionStatTemplet.json'), 'utf-8')).data;
  const skillLevelData = JSON.parse(readFileSync(join(PATHS.adminJson, 'CharacterSkillLevelTemplet.json'), 'utf-8')).data;
  const buffData = JSON.parse(readFileSync(join(PATHS.adminJson, 'BuffTemplet.json'), 'utf-8')).data;

  // Build lookups
  const buffLookup = buildBuffLookup(buffData);
  const skillLevelLookup = buildSkillLevelLookup(skillLevelData);
  const evoLookup = buildEvoLookup(evoData);

  // Find all 2000XXX / 2700XXX characters
  const characters = charData.filter((row: Record<string, string>) => {
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
    const skill23 = char.Skill_23 ?? '';
    const premium = skill23 ? getPremiumBuff(skill23, skillLevelLookup, buffLookup) : null;

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

    results[cid] = {
      info,
      premium: {
        skill_23: skill23,
        buffID: premium?.buffID ?? null,
        stat: premium?.stat ?? null,
        applyingType: premium?.applyingType ?? null,
        rawValue: premium?.value ?? null,
      },
      steps,
    };
  }

  // Save
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');

  const checksum = computeChecksum();
  if (checksum) {
    writeFileSync(CHECKSUM_FILE, checksum, 'utf-8');
  }

  return `${Object.keys(results).length} characters`;
}

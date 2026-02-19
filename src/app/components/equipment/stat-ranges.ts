import statRangesData from '@data/equipment/statRanges.json';

type RangeMap = Record<string, Record<string, Record<string, number[]>>>;
const statRanges = statRangesData as Record<string, RangeMap>;

/**
 * Get the max value of a main stat for a given equipment type, rarity, and level.
 * @param type - 'weapons' or 'accessories'
 * @param stat - Stat name (e.g., 'ATK%', 'HP%')
 * @param rarity - Item rarity (e.g., 'legendary', 'epic')
 * @param level - Equipment level (e.g., 6)
 * @returns The max value as a formatted string (e.g., '60%'), or undefined if not found
 */
export function getStatMax(
  type: 'weapons' | 'accessories',
  stat: string,
  rarity: string,
  level: number,
): string | undefined {
  const range = statRanges[type]?.[stat]?.[rarity]?.[String(level)];
  if (!range) return undefined;
  const max = range[1];
  const isPercent = stat.includes('%') || ['CHC', 'CHD', 'EFF', 'RES', 'DMG UP', 'DMG RED', 'CDMG RED'].includes(stat);
  return isPercent ? `${max}%` : String(max);
}

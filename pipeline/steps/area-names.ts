import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { PATHS } from '../config';

const OUTPUT = join(process.cwd(), 'data', 'guides', 'area_name.json');

// Game S3 is actually S2 part 2 (episodes 6-10), so remap
const SEASON_REMAP: Record<string, string> = { '1': '1', '2': '2', '3': '2', '4': '3', '5': '4' };

interface AreaEntry {
  en: string;
  kr: string;
  jp: string;
  zh: string;
  image?: string;
}

export async function run() {
  const textPath = join(PATHS.adminJson, 'TextSystem.json');
  const areaPath = join(PATHS.adminJson, 'AreaTemplet.json');

  if (!existsSync(textPath) || !existsSync(areaPath)) {
    if (existsSync(OUTPUT)) {
      return 'skipped (no datamine, using existing)';
    }
    throw new Error('area_name.json is missing and cannot be generated without datamine');
  }

  const textData = JSON.parse(readFileSync(textPath, 'utf-8'));
  const areaData = JSON.parse(readFileSync(areaPath, 'utf-8'));

  // Extract SYS_AREA_NAME_* translations
  const names: Record<string, { en: string; kr: string; jp: string; zh: string }> = {};
  for (const row of textData.data ?? []) {
    const symbol = row.IDSymbol ?? '';
    if (symbol.startsWith('SYS_AREA_NAME_')) {
      names[symbol] = {
        en: row.English ?? '',
        kr: row.Korean ?? '',
        jp: row.Japanese ?? '',
        zh: row.China_Simplified ?? '',
      };
    }
  }

  // Map area entries to locations
  const result: Record<string, Record<string, AreaEntry>> = {};
  for (const row of areaData.data ?? []) {
    const nameKey = row.RewardIDList ?? '';
    if (!nameKey.startsWith('SYS_AREA_NAME_')) continue;

    const modeRaw = row.ID ?? '';
    let mode: string;
    if (modeRaw === 'AGT_NORMAL') mode = 'normal';
    else if (modeRaw === 'AGT_HARD') mode = 'hard';
    else continue;

    const gameSeason = row.ID_fallback1 ?? '';
    const episode = row.EpisodeNum ?? '';
    const bgImage = row.BGImage ?? '';

    if (!gameSeason || !episode) continue;
    if (!(nameKey in names)) continue;

    const realSeason = SEASON_REMAP[gameSeason] ?? gameSeason;
    const location = `S${realSeason}-${episode}`;

    const entry: AreaEntry = { ...names[nameKey] };
    if (bgImage) entry.image = bgImage;

    if (!result[location]) result[location] = {};
    result[location][mode] = entry;
  }

  // Sort by season then episode
  const sorted = Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => {
      const [sa, ea] = a.slice(1).split('-').map(Number);
      const [sb, eb] = b.slice(1).split('-').map(Number);
      return sa - sb || ea - eb;
    })
  );

  // Check if up to date
  if (existsSync(OUTPUT)) {
    const existing = readFileSync(OUTPUT, 'utf-8');
    const newContent = JSON.stringify(sorted, null, 2);
    if (existing.trim() === newContent.trim()) {
      return `skipped (up to date, ${Object.keys(sorted).length} locations)`;
    }
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(sorted, null, 2), 'utf-8');
  return `${Object.keys(sorted).length} locations`;
}

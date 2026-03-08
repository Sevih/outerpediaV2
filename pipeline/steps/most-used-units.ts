import { readFile, readdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';

const TOWER_DIR = join(process.cwd(), 'data/tower');

// ── Types ────────────────────────────────────────────────────────────────────

type RecommendedEntry = { names: string[] };
type TeamData = Record<string, { team: string[][] }>;
type GuildRaidPhase = Record<string, { recommended?: RecommendedEntry[]; team?: string[][] }>;

// Standard recommended.json: either an array or { phase1: [], phase2: [] }
type RecommendedFile = RecommendedEntry[] | Record<string, RecommendedEntry[]>;

// Categories that use versions/ subdirectories (take latest only)
const VERSIONED_CATEGORIES = ['world-boss', 'joint-challenge'];
const GUILD_RAID = 'guild-raid';

// Categories with direct files (no versions/)
const DIRECT_CATEGORIES = [
  'adventure',
  'adventure-license',
  'special-request',
  'irregular-extermination',
];

// Categories to skip entirely (skyward-tower handled separately via data/tower/)
const SKIP_CATEGORIES = ['general-guides', 'other', 'monad-gate', 'skyward-tower'];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function getDirs(dir: string): Promise<string[]> {
  if (!await exists(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter(e => e.isDirectory() && !e.name.startsWith('_')).map(e => e.name);
}

/** Parse MM-YYYY version folders and return the latest one */
function getLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;

  const parsed = versions
    .map(v => {
      const m = v.match(/^(\d{2})-(\d{4})$/);
      if (!m) return null;
      return { raw: v, sort: parseInt(m[2]) * 100 + parseInt(m[1]) };
    })
    .filter((v): v is { raw: string; sort: number } => v !== null);

  if (parsed.length === 0) return versions[0]; // fallback
  parsed.sort((a, b) => b.sort - a.sort);
  return parsed[0].raw;
}

/** Extract names from recommended entries */
function namesFromRecommended(data: RecommendedFile): string[] {
  const names: string[] = [];
  if (Array.isArray(data)) {
    for (const entry of data) names.push(...(entry.names || []));
  } else {
    // { phase1: [...], phase2: [...] } format
    for (const entries of Object.values(data)) {
      if (Array.isArray(entries)) {
        for (const entry of entries) names.push(...(entry.names || []));
      }
    }
  }
  return names;
}

/** Extract names from teams data: { "Stage": { team: [["A","B"],["C"]] } } or [["A","B"],["C"]] */
function namesFromTeams(data: TeamData | string[][]): string[] {
  const names: string[] = [];
  if (Array.isArray(data)) {
    for (const slot of data) names.push(...slot);
  } else {
    for (const stage of Object.values(data)) {
      if (stage.team) {
        for (const slot of stage.team) names.push(...slot);
      }
    }
  }
  return names;
}

// ── Category extractors ──────────────────────────────────────────────────────

/** Versioned categories (world-boss, joint-challenge): latest version's recommended + teams */
async function extractVersioned(guideDir: string): Promise<string[]> {
  const versionsDir = join(guideDir, 'versions');
  const versions = await getDirs(versionsDir);
  const latest = getLatestVersion(versions);
  if (!latest) return [];

  const dir = join(versionsDir, latest);
  const names: string[] = [];

  const recoPath = join(dir, 'recommended.json');
  if (await exists(recoPath)) {
    names.push(...namesFromRecommended(await readJson(recoPath)));
  }

  const teamsPath = join(dir, 'teams.json');
  if (await exists(teamsPath)) {
    names.push(...namesFromTeams(await readJson(teamsPath)));
  }

  return names;
}

/** Guild raid: latest version's phase1.json + phase2.json */
async function extractGuildRaid(guideDir: string): Promise<string[]> {
  const versionsDir = join(guideDir, 'versions');
  const versions = await getDirs(versionsDir);
  const latest = getLatestVersion(versions);
  if (!latest) return [];

  const dir = join(versionsDir, latest);
  const names: string[] = [];

  for (const phaseFile of ['phase1.json', 'phase2.json']) {
    const phasePath = join(dir, phaseFile);
    if (!await exists(phasePath)) continue;

    const phase = await readJson<GuildRaidPhase>(phasePath);
    for (const boss of Object.values(phase)) {
      if (boss.recommended) {
        for (const entry of boss.recommended) names.push(...(entry.names || []));
      }
      if (boss.team) {
        for (const slot of boss.team) names.push(...slot);
      }
    }
  }

  return names;
}

/** Direct categories (adventure, adventure-license, etc.): recommended.json + teams.json at root */
async function extractDirect(guideDir: string): Promise<string[]> {
  const names: string[] = [];

  const recoPath = join(guideDir, 'recommended.json');
  if (await exists(recoPath)) {
    names.push(...namesFromRecommended(await readJson(recoPath)));
  }

  const teamsPath = join(guideDir, 'teams.json');
  if (await exists(teamsPath)) {
    names.push(...namesFromTeams(await readJson(teamsPath)));
  }

  return names;
}

// ── Tower extractor ──────────────────────────────────────────────────────────

type TowerRecommended = { names: string[] };
type TowerRestrictionSet = { restrictions: string[]; recommended?: TowerRecommended[] };
type TowerPoolEntry = { boss_id: string; restrictionSets: TowerRestrictionSet[] };
type TowerFloor = {
  floor: number;
  recommended?: TowerRecommended[];
  random?: boolean;
  sets?: { recommended?: TowerRecommended[] }[];
};
type TowerData = {
  floors: TowerFloor[];
  randomPool?: TowerPoolEntry[];
};

/** Extract character IDs from tower data files (they use IDs, not names) */
async function extractTowerIds(): Promise<Map<string, string[]>> {
  // Returns: towerName → list of character IDs
  const result = new Map<string, string[]>();
  if (!await exists(TOWER_DIR)) return result;

  const files = (await readdir(TOWER_DIR)).filter(f => f.endsWith('.json') && f !== 'restrictions.json');

  for (const file of files) {
    const towerName = file.replace('.json', '') + '-tower';
    const data = await readJson<TowerData>(join(TOWER_DIR, file));
    const ids: string[] = [];

    // Fixed floors with recommended
    for (const floor of data.floors) {
      if (floor.recommended) {
        for (const entry of floor.recommended) {
          ids.push(...(entry.names || []).filter(n => n.length > 0));
        }
      }
      // Random floors with sets
      if (floor.sets) {
        for (const set of floor.sets) {
          if (set.recommended) {
            for (const entry of set.recommended) {
              ids.push(...(entry.names || []).filter(n => n.length > 0));
            }
          }
        }
      }
    }

    // Random pool entries
    if (data.randomPool) {
      for (const pool of data.randomPool) {
        for (const rs of pool.restrictionSets) {
          if (rs.recommended) {
            for (const entry of rs.recommended) {
              ids.push(...(entry.names || []).filter(n => n.length > 0));
            }
          }
        }
      }
    }

    if (ids.length > 0) {
      result.set(towerName, [...new Set(ids)]);
    }
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function run() {
  const nameToIdRaw = await readFile(join(PATHS.generated, 'characters-name-to-id.json'), 'utf-8');
  const nameToId: Record<string, string> = JSON.parse(nameToIdRaw);

  // Build reverse: id → slug (from slug-to-id)
  const slugToIdRaw = await readFile(join(PATHS.generated, 'characters-slug-to-id.json'), 'utf-8');
  const slugToId: Record<string, string> = JSON.parse(slugToIdRaw);
  const idToSlug: Record<string, string> = {};
  for (const [slug, id] of Object.entries(slugToId)) {
    idToSlug[id] = slug;
  }

  // Result: characterSlug → { category → guideSlug[] }
  const result: Record<string, Record<string, string[]>> = {};
  const warnings: string[] = [];

  let guideCount = 0;

  async function processCategory(category: string) {
    const categoryDir = join(PATHS.guidesContent, category);
    const guides = await getDirs(categoryDir);

    for (const guideSlug of guides) {
      const guideDir = join(categoryDir, guideSlug);
      let names: string[];

      if (VERSIONED_CATEGORIES.includes(category)) {
        names = await extractVersioned(guideDir);
      } else if (category === GUILD_RAID) {
        names = await extractGuildRaid(guideDir);
      } else {
        names = await extractDirect(guideDir);
      }

      if (names.length === 0) continue;
      guideCount++;

      // Deduplicate names per guide
      const unique = [...new Set(names)];

      for (const name of unique) {
        const id = nameToId[name];
        if (!id) {
          warnings.push(`Unknown character: "${name}" in ${category}/${guideSlug}`);
          continue;
        }
        const slug = idToSlug[id];
        if (!slug) continue;

        if (!result[slug]) result[slug] = {};
        if (!result[slug][category]) result[slug][category] = [];
        if (!result[slug][category].includes(guideSlug)) {
          result[slug][category].push(guideSlug);
        }
      }
    }
  }

  const allCategories = [...VERSIONED_CATEGORIES, GUILD_RAID, ...DIRECT_CATEGORIES];
  const categoryDir = PATHS.guidesContent;
  const existingCategories = await getDirs(categoryDir);

  for (const cat of allCategories) {
    if (SKIP_CATEGORIES.includes(cat)) continue;
    if (!existingCategories.includes(cat)) continue;
    await processCategory(cat);
  }

  // ── Skyward Tower (uses character IDs, not names) ──
  const towerData = await extractTowerIds();
  for (const [towerName, charIds] of towerData) {
    guideCount++;
    for (const id of charIds) {
      const slug = idToSlug[id];
      if (!slug) {
        warnings.push(`Unknown character ID: "${id}" in skyward-tower/${towerName}`);
        continue;
      }
      if (!result[slug]) result[slug] = {};
      if (!result[slug]['skyward-tower']) result[slug]['skyward-tower'] = [];
      if (!result[slug]['skyward-tower'].includes(towerName)) {
        result[slug]['skyward-tower'].push(towerName);
      }
    }
  }

  // Sort by total guide appearances (descending)
  const sorted = Object.entries(result)
    .map(([slug, categories]) => {
      const total = Object.values(categories).reduce((sum, guides) => sum + guides.length, 0);
      return { slug, categories, total };
    })
    .sort((a, b) => b.total - a.total);

  const output = sorted.map(({ slug, categories, total }) => ({
    slug,
    total,
    categories,
  }));

  // Print warnings
  for (const w of warnings) {
    console.warn(`  WARN ${w}`);
  }

  const outPath = join(PATHS.generated, 'most-used-units.json');
  await writeFile(outPath, JSON.stringify(output, null, 2));

  return `${output.length} characters from ${guideCount} guides${warnings.length ? `, ${warnings.length} warning(s)` : ''}`;
}

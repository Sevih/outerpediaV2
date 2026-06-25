import { join } from 'path';
import { readJson } from './_json';
import type { Character, CharacterIndexMap, CharacterListEntry, CharacterNameToIdMap, CharacterProfile, CharacterProsCons, CharacterSkin, CharacterStats, CharacterSynergies, CharacterVideo, NameAliases } from '@/types/character';
import type { CharacterReco, RecoPresets, StructuredCharacterReco, RecoGearStat } from '@/types/equipment';
import { resolveRecoPresets } from '@/lib/data/reco';
import { getWeapons, getAmulets, getArmorSets } from '@/lib/data/equipment';

const CHARS_DIR = join(process.cwd(), 'data/character');
const RECO_DIR = join(process.cwd(), 'data/reco');
const PROFILES_PATH = join(process.cwd(), 'data/character-profiles.json');
const INDEX_PATH = join(process.cwd(), 'data/generated/characters-index.json');
const NAME_TO_ID_PATH = join(process.cwd(), 'data/generated/characters-name-to-id.json');
const LIST_PATH = join(process.cwd(), 'data/generated/characters-list.json');
const SLUG_TO_ID_PATH = join(process.cwd(), 'data/generated/characters-slug-to-id.json');
const STATS_PATH = join(process.cwd(), 'data/generated/character-stats.json');
const PROS_CONS_PATH = join(process.cwd(), 'data/pros-cons.json');
const PARTNERS_PATH = join(process.cwd(), 'data/partners.json');
const VIDEOS_PATH = join(process.cwd(), 'data/character-videos.json');
const SKINS_PATH = join(process.cwd(), 'data/character-skins.json');
const NAME_ALIASES_PATH = join(process.cwd(), 'data/name-aliases.json');

type SlugToIdMap = Record<string, string>;

let slugToIdCache: SlugToIdMap | null = null;

/** Load and cache the slug → ID mapping */
async function getSlugToId(): Promise<SlugToIdMap> {
  if (slugToIdCache) return slugToIdCache;
  slugToIdCache = await readJson<SlugToIdMap>(SLUG_TO_ID_PATH);
  return slugToIdCache;
}

/** Resolve a readable slug to a character ID */
export async function resolveSlug(slug: string): Promise<string | null> {
  const map = await getSlugToId();
  return map[slug] ?? null;
}

/** Get a single character by readable slug */
export async function getCharacter(slug: string): Promise<Character | null> {
  const id = await resolveSlug(slug);
  if (!id) return null;
  try {
    return await readJson<Character>(join(CHARS_DIR, `${id}.json`));
  } catch {
    return null;
  }
}

/** Get all character slugs (readable) */
export async function getCharacterSlugs(): Promise<string[]> {
  const map = await getSlugToId();
  return Object.keys(map);
}

/** Get the ID-keyed character index */
export async function getCharacterIndex(): Promise<CharacterIndexMap> {
  return readJson<CharacterIndexMap>(INDEX_PATH);
}

/** Get the English Fullname → ID reverse map */
export async function getCharacterNameToId(): Promise<CharacterNameToIdMap> {
  return readJson<CharacterNameToIdMap>(NAME_TO_ID_PATH);
}

/** Get enriched character list with buff/debuff data for filtering (pre-generated) */
export async function getCharactersForList(): Promise<CharacterListEntry[]> {
  return readJson<CharacterListEntry[]>(LIST_PATH);
}

/** Get equipment recommendations for a character by readable slug */
export async function getCharacterReco(slug: string): Promise<CharacterReco | null> {
  const id = await resolveSlug(slug);
  if (!id) return null;
  try {
    return await readJson<CharacterReco>(join(RECO_DIR, `${id}.json`));
  } catch {
    return null;
  }
}

/** Get reco presets (shared talisman/set templates) */
export async function getRecoPresets(): Promise<RecoPresets> {
  return readJson<RecoPresets>(join(RECO_DIR, '_presets.json'));
}

/**
 * Outerpedia stat label → canonical engine stat key (the vocabulary the gear-solver uses).
 * Sourced from the solver's `GAME_STAT` table (gear-solver/packages/core/src/stats.ts):
 * each label maps through its game `ST_*` enum to the exact key the solver filters on.
 */
const STAT_KEY: Record<string, string> = {
  'ATK': 'atk', 'ATK%': 'atkPct',
  'HP': 'hp', 'HP%': 'hpPct',
  'DEF': 'def', 'DEF%': 'defPct',
  'CHC': 'critRate',          // ST_CRITICAL_RATE (game label CRC)
  'CHD': 'critDmg',           // ST_CRITICAL_DMG_RATE
  'SPD': 'spd',               // ST_SPEED
  'EFF': 'eff',               // ST_BUFF_CHANCE
  'RES': 'effRes',            // ST_BUFF_RESIST
  'PEN%': 'pen',              // ST_PIERCE_POWER_RATE
  'DMG UP%': 'dmgUp',         // ST_DMG_BOOST
  'DMG RED%': 'dmgReduce',    // ST_DMG_REDUCE_RATE
  'CDMG RED%': 'critDmgReduce', // ST_E_CRI_DMG_REDUCE
};

/** Map a display stat label to its canonical key, falling back to the raw label if unknown. */
function toStatKey(label: string): string {
  return STAT_KEY[label] ?? label;
}

/** Split a main-stat field like "PEN%/CHD" into its alternative canonical stat keys. */
function parseMainStat(value: string | undefined): string[] {
  if (!value) return [];
  return value.split('/').map(s => s.trim()).filter(Boolean).map(toStatKey);
}

/** Parse a substat priority string ("ATK>CHC=EFF>CHD") into ordered tiers of tied canonical keys. */
function parseSubstatPrio(value: string | undefined): string[][] | undefined {
  if (!value) return undefined;
  const tiers = value
    .split('>')
    .map(tier => tier.split('=').map(s => s.trim()).filter(Boolean).map(toStatKey))
    .filter(tier => tier.length > 0);
  return tiers.length > 0 ? tiers : undefined;
}

/**
 * Get a character's recos by character ID, fully structured and aligned to the gear-solver's
 * game vocabulary: weapons/amulets resolve to `itemId` (ItemTemplet.ID) + icon, sets to `setId`,
 * and every stat label is mapped to its canonical engine key. Name→id joins run against the same
 * extracted game data both projects share, so no string matching is left to the consumer.
 */
export async function getRecoStatPriorities(id: string): Promise<StructuredCharacterReco | null> {
  let reco: CharacterReco;
  try {
    reco = await readJson<CharacterReco>(join(RECO_DIR, `${id}.json`));
  } catch {
    return null;
  }

  const presets = await getRecoPresets();
  const resolved = resolveRecoPresets(reco, presets);

  // Build name→game-id indexes once from the shared equipment dataset.
  const [weapons, amulets, sets] = await Promise.all([getWeapons(), getAmulets(), getArmorSets()]);
  const gearById = new Map<string, { itemId: number | null; effectIcon: string | null }>();
  for (const g of [...weapons, ...amulets]) {
    gearById.set(g.name, { itemId: g.id != null ? Number(g.id) : null, effectIcon: g.effect_icon });
  }
  // sets.json names carry a trailing " Set"/" set" suffix; recos use the short name.
  const setIdByName = new Map<string, string>();
  for (const s of sets) {
    setIdByName.set(s.name, s.id);
    setIdByName.set(s.name.replace(/\s+set$/i, ''), s.id);
  }

  const resolveGear = (entry: { name: string; mainStat?: string }): RecoGearStat => {
    const match = gearById.get(entry.name);
    return {
      name: entry.name,
      itemId: match?.itemId ?? null,
      effectIcon: match?.effectIcon ?? null,
      mainStat: parseMainStat(entry.mainStat),
    };
  };

  const builds: StructuredCharacterReco['builds'] = {};
  for (const [buildName, build] of Object.entries(resolved)) {
    builds[buildName] = {
      Weapon: build.Weapon?.map(resolveGear),
      Amulet: build.Amulet?.map(resolveGear),
      Set: build.Set?.map(combo =>
        combo.map(s => ({ name: s.name, setId: setIdByName.get(s.name) ?? null, count: s.count }))
      ),
      SubstatPrio: parseSubstatPrio(build.SubstatPrio),
    };
  }

  return { id, builds };
}

/** Get a character's profile (bio, story) by ID */
export async function getCharacterProfile(id: string): Promise<CharacterProfile | null> {
  try {
    const profiles = await readJson<Record<string, CharacterProfile>>(PROFILES_PATH);
    return profiles[id] ?? null;
  } catch {
    return null;
  }
}

/** Get base stats for a character by ID */
export async function getCharacterStats(id: string): Promise<CharacterStats | null> {
  try {
    const all = await readJson<Record<string, CharacterStats>>(STATS_PATH);
    return all[id] ?? null;
  } catch {
    return null;
  }
}

/** Get pros & cons for a character by readable slug */
export async function getCharacterProsCons(slug: string): Promise<CharacterProsCons | null> {
  try {
    const all = await readJson<Record<string, CharacterProsCons>>(PROS_CONS_PATH);
    return all[slug] ?? null;
  } catch {
    return null;
  }
}

/** Get a single character by ID (no slug resolution) */
export async function getCharacterById(id: string): Promise<Character | null> {
  try {
    return await readJson<Character>(join(CHARS_DIR, `${id}.json`));
  } catch {
    return null;
  }
}

/** Resolve a character ID to its readable slug */
export async function resolveIdToSlug(id: string): Promise<string | null> {
  const map = await getSlugToId();
  const entry = Object.entries(map).find(([, v]) => v === id);
  return entry ? entry[0] : null;
}

/** Get synergy / partner data for a character by readable slug */
export async function getCharacterPartners(slug: string): Promise<CharacterSynergies | null> {
  try {
    const all = await readJson<Record<string, CharacterSynergies>>(PARTNERS_PATH);
    return all[slug] ?? null;
  } catch {
    return null;
  }
}

/** Get extra video entries (in addition to legacy `character.video`) for a character by slug */
export async function getCharacterVideos(slug: string): Promise<CharacterVideo[]> {
  try {
    const all = await readJson<Record<string, CharacterVideo[]>>(VIDEOS_PATH);
    return all[slug] ?? [];
  } catch {
    return [];
  }
}

/** Get all character skins, keyed by character ID. */
export async function getCharacterSkins(): Promise<Record<string, CharacterSkin[]>> {
  try {
    return await readJson<Record<string, CharacterSkin[]>>(SKINS_PATH);
  } catch {
    return {};
  }
}

/** Get manual short-name overrides (abbreviations), keyed by item id. */
export async function getNameAliases(): Promise<NameAliases> {
  try {
    return await readJson<NameAliases>(NAME_ALIASES_PATH);
  } catch {
    return {};
  }
}

import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config';
import { SUFFIX_LANGS } from '../../src/lib/i18n/config';

type SkillData = {
  buff?: string[];
  debuff?: string[];
  dual_buff?: string[];
  dual_debuff?: string[];
};

type RawCharacter = {
  ID: string;
  Fullname: string;
  Element: string;
  Class: string;
  SubClass: string;
  Rarity: number;
  role: string;
  rank: string;
  rank_pvp?: string;
  rank_by_transcend?: Record<string, string>;
  role_by_transcend?: Record<string, string>;
  Chain_Type: string;
  gift: string;
  tags?: string[];
  skills?: Record<string, SkillData>;
  [key: string]: unknown;
};

/** Convert English Fullname to a URL-friendly slug */
function toSlug(fullname: string): string {
  return fullname
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[']/g, '')                                // remove apostrophes
    .replace(/[^a-z0-9-]+/g, '-')                       // non-alnum → dash
    .replace(/-+/g, '-')                                 // collapse dashes
    .replace(/^-|-$/g, '');                              // trim leading/trailing
}

async function loadGroupMap(): Promise<Map<string, string>> {
  const [buffsRaw, debuffsRaw] = await Promise.all([
    readFile(join(PATHS.effects, 'buffs.json'), 'utf-8'),
    readFile(join(PATHS.effects, 'debuffs.json'), 'utf-8'),
  ]);
  const buffs = JSON.parse(buffsRaw) as { name: string; group?: string }[];
  const debuffs = JSON.parse(debuffsRaw) as { name: string; group?: string }[];

  const map = new Map<string, string>();
  for (const effect of [...buffs, ...debuffs]) {
    if (effect.group) map.set(effect.name, effect.group);
  }
  return map;
}

type EeEntry = { buff?: string[]; debuff?: string[] };

export async function run() {
  const [files, groupMap, eeRaw] = await Promise.all([
    readdir(PATHS.characters),
    loadGroupMap(),
    readFile(join(PATHS.equipment, 'ee.json'), 'utf-8'),
  ]);
  const eeMap: Record<string, EeEntry> = JSON.parse(eeRaw);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const canonicalize = (name: string) => groupMap.get(name) || name;

  // First pass: load all characters and compute slugs
  const rawEntries = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await readFile(join(PATHS.characters, file), 'utf-8');
      const char: RawCharacter = JSON.parse(raw);
      return { char, fileId: file.replace('.json', '') };
    })
  );

  // Generate unique slugs (detect collisions)
  const slugCounts = new Map<string, number>();
  for (const { char } of rawEntries) {
    const s = toSlug(char.Fullname);
    slugCounts.set(s, (slugCounts.get(s) || 0) + 1);
  }
  const slugUsed = new Map<string, number>();
  function uniqueSlug(fullname: string): string {
    const s = toSlug(fullname);
    if ((slugCounts.get(s) || 0) <= 1) return s;
    const n = (slugUsed.get(s) || 0) + 1;
    slugUsed.set(s, n);
    return n === 1 ? s : `${s}-${n}`;
  }

  const entries = rawEntries.map(({ char }) => {
      const slug = uniqueSlug(char.Fullname);

      // ── Index entry (lightweight) ──
      const indexEntry: Record<string, unknown> = {
        Fullname: char.Fullname,
        slug,
        Element: char.Element,
        Class: char.Class,
        Rarity: char.Rarity,
        role: char.role,
        Chain_Type: char.Chain_Type,
        tags: char.tags ?? [],
      };

      // ── List entry (enriched for filters) ──
      const allCanonicalBuffs = new Set<string>();
      const allCanonicalDebuffs = new Set<string>();
      const effectsBySource: Record<string, { buff: string[]; debuff: string[] }> = {};

      if (char.skills) {
        for (const [key, skill] of Object.entries(char.skills)) {
          if (!skill) continue;

          // Collect raw effects (dedup within source)
          const rawBuffs = [...new Set([
            ...(skill.buff || []),
            ...(key === 'SKT_CHAIN_PASSIVE' ? (skill.dual_buff || []) : []),
          ])];
          const rawDebuffs = [...new Set([
            ...(skill.debuff || []),
            ...(key === 'SKT_CHAIN_PASSIVE' ? (skill.dual_debuff || []) : []),
          ])];

          // Canonicalize and dedup per source
          const canonicalBuffs = [...new Set(rawBuffs.map(canonicalize))];
          const canonicalDebuffs = [...new Set(rawDebuffs.map(canonicalize))];

          canonicalBuffs.forEach(b => allCanonicalBuffs.add(b));
          canonicalDebuffs.forEach(d => allCanonicalDebuffs.add(d));

          if (canonicalBuffs.length || canonicalDebuffs.length) {
            effectsBySource[key] = { buff: canonicalBuffs, debuff: canonicalDebuffs };
          }
        }
      }

      // ── EE effects ──
      const ee = eeMap[char.ID];
      if (ee) {
        const eeCanonBuffs = [...new Set((ee.buff || []).map(canonicalize))];
        const eeCanonDebuffs = [...new Set((ee.debuff || []).map(canonicalize))];
        eeCanonBuffs.forEach(b => allCanonicalBuffs.add(b));
        eeCanonDebuffs.forEach(d => allCanonicalDebuffs.add(d));
        if (eeCanonBuffs.length || eeCanonDebuffs.length) {
          effectsBySource['EXCLUSIVE_EQUIP'] = { buff: eeCanonBuffs, debuff: eeCanonDebuffs };
        }
      }

      const listEntry: Record<string, unknown> = {
        ID: char.ID,
        Fullname: char.Fullname,
        slug,
        Element: char.Element,
        Class: char.Class,
        SubClass: char.SubClass,
        Rarity: char.Rarity,
        role: char.role,
        rank: char.rank,
      rank_pvp: char.rank_pvp,
        Chain_Type: char.Chain_Type,
        gift: char.gift,
        tags: char.tags ?? [],
        buff: [...allCanonicalBuffs],
        debuff: [...allCanonicalDebuffs],
        effectsBySource,
      };
      if (char.rank_by_transcend) listEntry.rank_by_transcend = char.rank_by_transcend;
      if (char.role_by_transcend) listEntry.role_by_transcend = char.role_by_transcend;

      // Add localized Fullname suffixes to both entries
      for (const lang of SUFFIX_LANGS) {
        const key = `Fullname_${lang}`;
        const value = char[key];
        if (typeof value === 'string' && value.trim()) {
          indexEntry[key] = value.trim();
          listEntry[key] = value.trim();
        }
      }

      return { id: char.ID, slug, indexEntry, listEntry, fullname: char.Fullname };
  });

  // Sort by ID for stable output
  entries.sort((a, b) => a.id.localeCompare(b.id));

  // ID-keyed index: { "2000001": { Fullname, slug, Element, ... } }
  const index: Record<string, Record<string, unknown>> = {};
  for (const { id, indexEntry } of entries) {
    index[id] = indexEntry;
  }

  // Reverse map: English Fullname → ID
  const nameToId: Record<string, string> = {};
  for (const { id, fullname } of entries) {
    nameToId[fullname] = id;
  }

  // Slug → ID map (for URL resolution)
  const slugToId: Record<string, string> = {};
  for (const { id, slug } of entries) {
    slugToId[slug] = id;
  }

  // Enriched list array for /characters page
  const list = entries.map(({ listEntry }) => listEntry);

  const indexPath = join(PATHS.generated, 'characters-index.json');
  const namePath = join(PATHS.generated, 'characters-name-to-id.json');
  const listPath = join(PATHS.generated, 'characters-list.json');
  const slugPath = join(PATHS.generated, 'characters-slug-to-id.json');

  await Promise.all([
    writeFile(indexPath, JSON.stringify(index, null, 2)),
    writeFile(namePath, JSON.stringify(nameToId, null, 2)),
    writeFile(listPath, JSON.stringify(list)),
    writeFile(slugPath, JSON.stringify(slugToId, null, 2)),
  ]);

  return `${entries.length} characters, 4 index files`;
}

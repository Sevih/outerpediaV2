import { readdirSync } from 'fs';
import { join } from 'path';
import { getCharactersForList, getCharacterSkins, getNameAliases } from '@/lib/data/characters';
import { getExclusiveEquipment } from '@/lib/data/equipment';
import { getBossIndex } from '@/lib/data/bosses';
import type { NameAliases } from '@/types/character';
import TierListMakerClient, { type TierSourceItem } from './TierListMakerClient';

const FACEICON_DIR = join(process.cwd(), 'public/images/characters/faceicon');

// Set of model ids that actually have a face-icon portrait, cached per process.
// A costume whose portrait hasn't shipped yet is skipped here and appears on its
// own once the image lands — no code change needed.
let faceIconsCache: Set<string> | null = null;
function availableFaceIcons(): Set<string> {
  if (faceIconsCache) return faceIconsCache;
  try {
    faceIconsCache = new Set(
      readdirSync(FACEICON_DIR)
        .filter((f) => f.endsWith('.webp'))
        .map((f) => f.slice(3, -5)), // "FI_<id>.webp" → "<id>"
    );
  } catch {
    faceIconsCache = new Set();
  }
  return faceIconsCache;
}

/**
 * Resolve a boss portrait. Humanoid bosses (icon id starting with "2") reuse a
 * character face icon; the rest use a monster portrait — the same split as
 * GuildRaidGuide. Verified against the full boss index: every face-icon boss
 * has a "20…" id and every monster portrait a "30…/40…/41…" id, no overlap.
 */
function resolveBossImage(icons: string): string {
  return icons.startsWith('2')
    ? `/images/characters/faceicon/FI_${icons}.webp`
    : `/images/characters/boss/portrait/MT_${icons}.webp`;
}

const byName = (a: TierSourceItem, b: TierSourceItem) =>
  (a.name.en ?? '').localeCompare(b.name.en ?? '');

/** Attach the per-language short name (abbreviation) for an item, if any. */
function withAlias(item: TierSourceItem, aliases: NameAliases): TierSourceItem {
  const a = aliases[item.key];
  if (!a) return item;
  const { _name, ...langs } = a;
  void _name; // reference field, not rendered
  return Object.keys(langs).length ? { ...item, short: langs } : item;
}

export default async function TierListMakerTool() {
  const [characters, ee, bossIndex, skins, aliases] = await Promise.all([
    getCharactersForList(),
    getExclusiveEquipment(),
    getBossIndex(),
    getCharacterSkins(),
    getNameAliases(),
  ]);

  const faceIcons = availableFaceIcons();

  // Base characters (name-sorted), each followed by its selectable costumes.
  // Skins are keyed by their model id so they fold into the same per-type canon
  // as the base roster, keeping share-URL positions compact and stable.
  const charItems: TierSourceItem[] = [];
  for (const c of [...characters].sort((a, b) => a.Fullname.localeCompare(b.Fullname))) {
    charItems.push({
      key: `c${c.ID}`,
      name: { en: c.Fullname, jp: c.Fullname_jp, kr: c.Fullname_kr, zh: c.Fullname_zh },
      img: `/images/characters/faceicon/FI_${c.ID}.webp`,
      element: c.Element,
      cls: c.Class,
      rarity: c.Rarity,
      tags: c.tags,
    });
    for (const skin of skins[c.ID] ?? []) {
      if (!skin.showList || skin.modelNameID === c.ID || !faceIcons.has(skin.modelNameID)) continue;
      charItems.push({
        key: `c${skin.modelNameID}`,
        name: skin.name,
        img: `/images/characters/faceicon/FI_${skin.modelNameID}.webp`,
        element: c.Element, // a costume keeps the character's element/class/rarity
        cls: c.Class,
        rarity: c.Rarity,
        tags: c.tags,
        isSkin: true,
        baseKey: `c${c.ID}`, // name fallback when "skin names" is off
      });
    }
  }

  const eeItems: TierSourceItem[] = Object.entries(ee)
    .map(([id, e]) => ({
      key: `e${id}`,
      name: { en: e.name, jp: e.name_jp, kr: e.name_kr, zh: e.name_zh },
      img: `/images/characters/ee/${id}.webp`,
    }))
    .sort(byName);

  const seenBoss = new Set<string>();
  const bossItems: TierSourceItem[] = [];
  for (const entry of Object.values(bossIndex)) {
    if (seenBoss.has(entry.icons)) continue;
    seenBoss.add(entry.icons);
    bossItems.push({
      key: `b${entry.icons}`,
      name: entry.name,
      img: resolveBossImage(entry.icons),
      element: entry.element,
      cls: entry.class,
    });
  }
  bossItems.sort(byName);

  return (
    <TierListMakerClient
      characters={charItems.map((it) => withAlias(it, aliases))}
      ee={eeItems.map((it) => withAlias(it, aliases))}
      bosses={bossItems.map((it) => withAlias(it, aliases))}
    />
  );
}

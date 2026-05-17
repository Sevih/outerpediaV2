import { getCharactersForList } from '@/lib/data/characters';
import { getExclusiveEquipment } from '@/lib/data/equipment';
import { getBossIndex } from '@/lib/data/bosses';
import TierListMakerClient, { type TierSourceItem } from './TierListMakerClient';

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

export default async function TierListMakerTool() {
  const [characters, ee, bossIndex] = await Promise.all([
    getCharactersForList(),
    getExclusiveEquipment(),
    getBossIndex(),
  ]);

  const charItems: TierSourceItem[] = characters
    .map((c) => ({
      key: `c${c.ID}`,
      name: { en: c.Fullname, jp: c.Fullname_jp, kr: c.Fullname_kr, zh: c.Fullname_zh },
      img: `/images/characters/faceicon/FI_${c.ID}.webp`,
      element: c.Element,
      cls: c.Class,
    }))
    .sort(byName);

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
    });
  }
  bossItems.sort(byName);

  return <TierListMakerClient characters={charItems} ee={eeItems} bosses={bossItems} />;
}

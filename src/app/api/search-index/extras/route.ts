import { getWeapons, getAmulets, getTalismans, getArmorSets, getExclusiveEquipment } from '@/lib/data/equipment';
import { slugifyEquipment } from '@/lib/format-text';
import { getAllGuides } from '@/lib/data/guides';
import type { WithLocalizedFields } from '@/types/common';
import { SUFFIX_LANGS } from '@/lib/i18n/config';

export type EquipmentSearchItem = WithLocalizedFields<{
  slug: string;
  name: string;
  type: 'weapon' | 'amulet' | 'talisman' | 'set' | 'ee';
  image: string;
}, 'name'>;

export type GuideSearchItem = {
  slug: string;
  category: string;
  title: Record<string, string>;
  icon: string;
};

export type SearchExtras = {
  equipment: EquipmentSearchItem[];
  guides: GuideSearchItem[];
};

function toSearchItem(
  item: { name: string } & Record<string, unknown>,
  type: EquipmentSearchItem['type'],
  image: string,
): EquipmentSearchItem {
  const result: EquipmentSearchItem = { slug: slugifyEquipment(item.name), name: item.name, type, image };
  for (const lang of SUFFIX_LANGS) {
    const key = `name_${lang}` as const;
    if (item[key]) result[key] = item[key] as string;
  }
  return result;
}

export async function GET() {
  const [weapons, amulets, talismans, sets, eeMap, guides] = await Promise.all([
    getWeapons(),
    getAmulets(),
    getTalismans(),
    getArmorSets(),
    getExclusiveEquipment(),
    getAllGuides(),
  ]);

const equipment: EquipmentSearchItem[] = [
    ...weapons.map((w) => toSearchItem(w, 'weapon', w.image)),
    ...amulets.map((a) => toSearchItem(a, 'amulet', a.image)),
    ...talismans.map((t) => toSearchItem(t, 'talisman', t.image)),
    ...sets.map((s) => toSearchItem(s, 'set', `TI_Equipment_Armor_${s.image_prefix}`)),
    ...Object.entries(eeMap).map(([charId, ee]) => toSearchItem(ee, 'ee', charId)),
  ];

  const guideItems: GuideSearchItem[] = guides.map((g) => ({
    slug: g.slug,
    category: g.category,
    title: g.title,
    icon: `/images/guides/${g.icon}.webp`,
  }));

  const data: SearchExtras = { equipment, guides: guideItems };

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

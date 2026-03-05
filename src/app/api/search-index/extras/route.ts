import { getWeapons, getAmulets, getTalismans, getArmorSets, getExclusiveEquipment } from '@/lib/data/equipment';
import { slugifyEquipment } from '@/lib/format-text';
import { getAllGuides } from '@/lib/data/guides';

export type EquipmentSearchItem = {
  slug: string;
  name: string;
  name_jp?: string;
  name_kr?: string;
  name_zh?: string;
  type: 'weapon' | 'amulet' | 'talisman' | 'set' | 'ee';
  image: string;
};

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
    ...weapons.map((w) => ({
      slug: slugifyEquipment(w.name),
      name: w.name,
      name_jp: w.name_jp,
      name_kr: w.name_kr,
      name_zh: w.name_zh,
      type: 'weapon' as const,
      image: w.image,
    })),
    ...amulets.map((a) => ({
      slug: slugifyEquipment(a.name),
      name: a.name,
      name_jp: a.name_jp,
      name_kr: a.name_kr,
      name_zh: a.name_zh,
      type: 'amulet' as const,
      image: a.image,
    })),
    ...talismans.map((t) => ({
      slug: slugifyEquipment(t.name),
      name: t.name,
      name_jp: t.name_jp,
      name_kr: t.name_kr,
      name_zh: t.name_zh,
      type: 'talisman' as const,
      image: t.image,
    })),
    ...sets.map((s) => ({
      slug: slugifyEquipment(s.name),
      name: s.name,
      name_jp: s.name_jp,
      name_kr: s.name_kr,
      name_zh: s.name_zh,
      type: 'set' as const,
      image: `TI_Equipment_Armor_${s.image_prefix}`,
    })),
    ...Object.entries(eeMap).map(([charId, ee]) => ({
      slug: slugifyEquipment(ee.name),
      name: ee.name,
      name_jp: ee.name_jp,
      name_kr: ee.name_kr,
      name_zh: ee.name_zh,
      type: 'ee' as const,
      image: charId,
    })),
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

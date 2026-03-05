import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getEquipmentBySlug, getAllEquipmentSlugs, getCharactersRecommendingEquipment, getWeaponStatRanges, getAccessoryStatRanges, getArmorSetStatRanges, getTalismanStatRanges, getEEStatRange } from '@/lib/data/equipment';
import { getCharacterIndex, resolveIdToSlug } from '@/lib/data/characters';
import { getBuffs, getDebuffs } from '@/lib/data/effects';
import { getBossDisplayMap } from '@/lib/data/bosses';
import type { Effect } from '@/types/effect';
import { l } from '@/lib/i18n/localize';
import EquipmentDetailClient from './EquipmentDetailClient';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string; slug: string }> };

const TYPE_LABELS: Record<string, Record<Lang, string>> = {
  weapon:   { en: 'Weapon', jp: '武器', kr: '무기', zh: '武器' },
  amulet:   { en: 'Accessory', jp: 'アクセサリー', kr: '장신구', zh: '饰品' },
  talisman: { en: 'Talisman', jp: 'タリスマン', kr: '부적', zh: '护符' },
  set:      { en: 'Armor Set', jp: 'セット', kr: '세트', zh: '套装' },
  ee:       { en: 'Exclusive Equipment', jp: '専用装備', kr: '전용 장비', zh: '专属装备' },
};

export async function generateStaticParams() {
  const slugs = await getAllEquipmentSlugs();
  return LANGS.flatMap((lang) =>
    slugs.map((slug) => ({ lang, slug }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Lang;
  const equipment = await getEquipmentBySlug(slug);
  if (!equipment) return {};

  const name = l(equipment.data, 'name', lang);
  const typeLabelMap = TYPE_LABELS[equipment.type];
  const typeLabel = typeLabelMap?.[lang] ?? typeLabelMap?.en ?? '';

  return createPageMetadata({
    lang,
    path: `/equipments/${slug}`,
    title: `${name} — ${typeLabel}`,
    description: `${name} — ${typeLabel} | Outerpedia`,
  });
}

export default async function EquipmentDetailPage({ params }: Props) {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Lang;

  const equipment = await getEquipmentBySlug(slug);
  if (!equipment) notFound();

  const [messages, recoRefs, charIndex, buffsArr, debuffsArr] = await Promise.all([
    loadMessages(lang),
    getCharactersRecommendingEquipment(equipment.data.name, equipment.type),
    getCharacterIndex(),
    getBuffs(),
    getDebuffs(),
  ]);

  const buffMap: Record<string, Effect> = {};
  for (const b of buffsArr) buffMap[b.name] = b;
  const debuffMap: Record<string, Effect> = {};
  for (const d of debuffsArr) debuffMap[d.name] = d;

  // Build boss map for source display
  const bossIds = new Set<string>();
  if (equipment.type !== 'ee') {
    const boss = equipment.data.boss;
    if (boss) {
      if (Array.isArray(boss)) boss.forEach(id => bossIds.add(id));
      else bossIds.add(boss);
    }
  }
  const bossMap = await getBossDisplayMap([...bossIds]);

  // Resolve reco references to character info with slugs
  const recoCharacters = await Promise.all(
    recoRefs.map(async (ref) => {
      const charInfo = charIndex[ref.characterId];
      const charSlug = charInfo?.slug ?? await resolveIdToSlug(ref.characterId);
      return {
        id: ref.characterId,
        name: charInfo ? l(charInfo, 'Fullname', lang) : ref.characterId,
        slug: charSlug,
        element: charInfo?.Element ?? null,
        classType: charInfo?.Class ?? null,
      };
    })
  );

  // Shuffle recommended characters for varied display, limit to 15
  const totalRecoCount = recoCharacters.length;
  for (let i = recoCharacters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [recoCharacters[i], recoCharacters[j]] = [recoCharacters[j], recoCharacters[i]];
  }
  recoCharacters.splice(15);

  // Compute stat ranges
  const weaponStatRanges = equipment.type === 'weapon'
    ? await getWeaponStatRanges(equipment.data.rarity, equipment.data.level)
    : null;

  const accessoryStatRanges = equipment.type === 'amulet'
    ? await getAccessoryStatRanges(equipment.data.rarity, equipment.data.level, equipment.data.mainStats)
    : null;

  const armorSetStatRanges = equipment.type === 'set'
    ? await getArmorSetStatRanges()
    : null;

  const talismanStatRanges = equipment.type === 'talisman'
    ? await getTalismanStatRanges()
    : null;

  const eeStatRange = equipment.type === 'ee'
    ? await getEEStatRange(equipment.data.mainStat)
    : null;

  // For EE: resolve owner character info + Core Fusion companion
  type CharRef = { id: string; name: string; slug: string | null; element: string | null; classType: string | null };
  let eeOwner: CharRef | null = null;
  let eeCfCompanion: CharRef | null = null;
  if (equipment.type === 'ee') {
    const ownerInfo = charIndex[equipment.characterId];
    const ownerSlug = ownerInfo?.slug ?? await resolveIdToSlug(equipment.characterId);
    eeOwner = {
      id: equipment.characterId,
      name: ownerInfo ? l(ownerInfo, 'Fullname', lang) : equipment.characterId,
      slug: ownerSlug,
      element: ownerInfo?.Element ?? null,
      classType: ownerInfo?.Class ?? null,
    };

    // Base character (20xxxxx) can share EE with CF (27xxxxx)
    if (equipment.characterId.startsWith('20')) {
      const cfId = '27' + equipment.characterId.slice(2);
      const cfInfo = charIndex[cfId];
      if (cfInfo) {
        const cfSlug = cfInfo.slug ?? await resolveIdToSlug(cfId);
        eeCfCompanion = {
          id: cfId,
          name: l(cfInfo, 'Fullname', lang),
          slug: cfSlug,
          element: cfInfo.Element ?? null,
          classType: cfInfo.Class ?? null,
        };
      }
    }
  }

  return (
    <EquipmentDetailClient
      equipment={equipment}
      recoCharacters={recoCharacters}
      totalRecoCount={totalRecoCount}
      eeOwner={eeOwner}
      eeCfCompanion={eeCfCompanion}
      bossMap={bossMap}
      buffMap={buffMap}
      debuffMap={debuffMap}
      weaponStatRanges={weaponStatRanges}
      accessoryStatRanges={accessoryStatRanges}
      armorSetStatRanges={armorSetStatRanges}
      talismanStatRanges={talismanStatRanges}
      eeStatRange={eeStatRange}
      messages={messages}
      lang={lang}
    />
  );
}

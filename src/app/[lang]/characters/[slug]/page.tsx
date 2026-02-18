import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { getT } from '@/i18n';
import { getCharacter, getCharacterSlugs, getCharacterReco, getCharacterProfile, getCharacterStats } from '@/lib/data/characters';
import { getExclusiveEquipment, getWeapons, getAmulets, getTalismans, getArmorSets } from '@/lib/data/equipment';
import { getBuffs, getDebuffs } from '@/lib/data/effects';
import { getGiftItems } from '@/lib/data/gifts';
import type { Effect } from '@/types/effect';
import { l } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import { readFile } from 'fs/promises';
import { join } from 'path';
import CharacterDetailClient from './CharacterDetailClient';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string; slug: string }> };

type TagEntry = {
  label: string;
  image: string;
  desc: string;
  type: string;
  [k: string]: string;
};

export async function generateStaticParams() {
  const slugs = await getCharacterSlugs();
  return LANGS.flatMap((lang) =>
    slugs.map((slug) => ({ lang, slug }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Lang;
  const [t, character] = await Promise.all([
    getT(lang),
    getCharacter(slug),
  ]);

  if (!character) return {};

  const fullname = l(character, 'Fullname', lang);
  const { name } = splitCharacterName(character.ID, fullname, lang);
  const monthYear = getMonthYear(lang);
  const element = t(`sys.element.${character.Element.toLowerCase()}` as Parameters<typeof t>[0]);
  const classType = t(`sys.class.${character.Class.toLowerCase()}` as Parameters<typeof t>[0]);

  return createPageMetadata({
    lang,
    path: `/characters/${slug}`,
    title: t('page.character.meta_title', { name: fullname, monthYear }),
    description: t('page.character.meta_description', { name: fullname, monthYear, element, classType }),
    ogImage: `/images/characters/full/IMG_${character.ID}.webp`,
  });
}

export default async function CharacterDetailPage({ params }: Props) {
  const { slug } = await params;

  const [character, reco, eeMap, weapons, amulets, talismans, sets, tagsRaw, giftItemsMap, buffsArr, debuffsArr] = await Promise.all([
    getCharacter(slug),
    getCharacterReco(slug),
    getExclusiveEquipment(),
    getWeapons(),
    getAmulets(),
    getTalismans(),
    getArmorSets(),
    readFile(join(process.cwd(), 'data/tags.json'), 'utf-8')
      .then((r) => JSON.parse(r) as Record<string, TagEntry>)
      .catch(() => ({} as Record<string, TagEntry>)),
    getGiftItems(),
    getBuffs(),
    getDebuffs(),
  ]);

  const buffMap: Record<string, Effect> = {};
  for (const b of buffsArr) buffMap[b.name] = b;
  const debuffMap: Record<string, Effect> = {};
  for (const d of debuffsArr) debuffMap[d.name] = d;

  if (!character) notFound();

  const [profile, stats] = await Promise.all([
    getCharacterProfile(character.ID),
    getCharacterStats(character.ID),
  ]);
  const ee = eeMap[character.ID] ?? null;
  const giftItems = giftItemsMap[character.gift as keyof typeof giftItemsMap] ?? [];

  return (
    <CharacterDetailClient
      character={character}
      profile={profile}
      stats={stats}
      ee={ee}
      reco={reco}
      tags={tagsRaw}
      weapons={weapons}
      amulets={amulets}
      talismans={talismans}
      sets={sets}
      giftItems={giftItems}
      buffMap={buffMap}
      debuffMap={debuffMap}
    />
  );
}

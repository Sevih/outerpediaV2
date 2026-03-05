import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { getT } from '@/i18n';
import { getCharacter, getCharacterSlugs, getCharacterReco, getRecoPresets, getCharacterProfile, getCharacterStats, getCharacterProsCons, getCharacterPartners, getCharacterById, resolveIdToSlug } from '@/lib/data/characters';
import { getExclusiveEquipment, getWeapons, getAmulets, getTalismans, getArmorSets } from '@/lib/data/equipment';
import { getBossDisplayMap } from '@/lib/data/bosses';
import { resolveRecoPresets } from '@/lib/data/reco';
import { getBuffs, getDebuffs } from '@/lib/data/effects';
import { getGiftItems } from '@/lib/data/gifts';
import type { Effect } from '@/types/effect';
import { l } from '@/lib/i18n/localize';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { CoreFusionLink } from '@/app/components/character/CoreFusionBanner';
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
  const monthYear = getMonthYear(lang);
  const element = t(`sys.element.${character.Element.toLowerCase()}` as Parameters<typeof t>[0]);
  const classType = t(`sys.class.${character.Class.toLowerCase()}` as Parameters<typeof t>[0]);

  return createPageMetadata({
    lang,
    path: `/characters/${slug}`,
    title: t('page.character.meta_title', { name: fullname, monthYear }),
    description: t('page.character.meta_description', { name: fullname, monthYear, element, classType }),
    ogImage: `/images/characters/atb/IG_Turn_${character.ID}.webp`,
  });
}

export default async function CharacterDetailPage({ params }: Props) {
  const { slug } = await params;

  const [character, reco, recoPresets, prosCons, partners, eeMap, weapons, amulets, talismans, sets, tagsRaw, giftItemsMap, buffsArr, debuffsArr] = await Promise.all([
    getCharacter(slug),
    getCharacterReco(slug),
    getRecoPresets(),
    getCharacterProsCons(slug),
    getCharacterPartners(slug),
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

  // Build boss display map for equipment source rendering
  const bossIds = new Set<string>();
  const addBoss = (b?: string | string[]) => {
    if (!b) return;
    if (Array.isArray(b)) b.forEach(id => bossIds.add(id));
    else bossIds.add(b);
  };
  for (const w of weapons) addBoss(w.boss);
  for (const a of amulets) addBoss(a.boss);
  for (const s of sets) addBoss(s.boss);
  const bossMap = await getBossDisplayMap([...bossIds]);

  if (!character) notFound();

  const [profile, stats] = await Promise.all([
    getCharacterProfile(character.ID),
    getCharacterStats(character.ID),
  ]);
  const ee = eeMap[character.ID] ?? null;
  const giftItems = giftItemsMap[character.gift as keyof typeof giftItemsMap] ?? [];

  // Resolve core-fusion cross-link
  let coreFusionLink: CoreFusionLink | null = null;
  const linkedId = character.hasCoreFusion ? character.coreFusionId
    : character.fusionType === 'core-fusion' ? character.originalCharacter
    : null;
  if (linkedId) {
    const [linkedChar, linkedSlug] = await Promise.all([
      getCharacterById(linkedId),
      resolveIdToSlug(linkedId),
    ]);
    if (linkedChar && linkedSlug) {
      coreFusionLink = {
        id: linkedId,
        slug: linkedSlug,
        name: linkedChar.Fullname,
        name_jp: linkedChar.Fullname_jp,
        name_kr: linkedChar.Fullname_kr,
        name_zh: linkedChar.Fullname_zh,
        type: character.hasCoreFusion ? 'core-fusion' : 'original',
      };
    }
  }

  return (
    <CharacterDetailClient
      character={character}
      profile={profile}
      stats={stats}
      ee={ee}
      reco={reco ? resolveRecoPresets(reco, recoPresets) : null}
      tags={tagsRaw}
      weapons={weapons}
      amulets={amulets}
      talismans={talismans}
      sets={sets}
      giftItems={giftItems}
      prosCons={prosCons}
      partners={partners}
      buffMap={buffMap}
      debuffMap={debuffMap}
      coreFusionLink={coreFusionLink}
      bossMap={bossMap}
    />
  );
}

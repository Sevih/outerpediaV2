import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Lang } from '@/lib/i18n/config';
import { LANGS, SUFFIX_LANGS } from '@/lib/i18n/config';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { getT } from '@/i18n';
import { getCharacter, getCharacterSlugs, getCharacterReco, getRecoPresets, getCharacterProfile, getCharacterStats, getCharacterProsCons, getCharacterPartners, getCharacterById, resolveIdToSlug } from '@/lib/data/characters';
import { getExclusiveEquipment, getWeapons, getAmulets, getTalismans, getArmorSets } from '@/lib/data/equipment';
import { getBossDisplayMap } from '@/lib/data/bosses';
import { resolveRecoPresets } from '@/lib/data/reco';
import { getBuffs, getDebuffs } from '@/lib/data/effects';
import { getGiftItems } from '@/lib/data/gifts';
import type { Effect } from '@/types/effect';
import { l, stripOtherLangs, stripOtherLangsArray, stripOtherLangsRecord } from '@/lib/i18n/localize';
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

/** Extract all effect names referenced in a character's skills */
function collectEffectNames(character: { skills: Record<string, { buff?: string[]; debuff?: string[]; burnEffect?: Record<string, { buff?: string[]; debuff?: string[] }> } | undefined> }): Set<string> {
  const names = new Set<string>();
  for (const skill of Object.values(character.skills)) {
    if (!skill || typeof skill !== 'object') continue;
    for (const b of skill.buff ?? []) names.add(b);
    for (const d of skill.debuff ?? []) names.add(d);
    if (skill.burnEffect) {
      for (const burst of Object.values(skill.burnEffect)) {
        for (const b of burst.buff ?? []) names.add(b);
        for (const d of burst.debuff ?? []) names.add(d);
      }
    }
  }
  return names;
}

export default async function CharacterDetailPage({ params }: Props) {
  const { lang: rawLang, slug } = await params;
  const lang = rawLang as Lang;

  const [character, reco, recoPresets, prosCons, partners, eeMap, allWeapons, allAmulets, allTalismans, allSets, tagsRaw, giftItemsMap, buffsArr, debuffsArr] = await Promise.all([
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

  if (!character) notFound();

  // Resolve reco first, then filter equipment to only referenced items
  const resolvedReco = reco ? resolveRecoPresets(reco, recoPresets) : null;

  const recoWeaponNames = new Set<string>();
  const recoAmuletNames = new Set<string>();
  const recoTalismanNames = new Set<string>();
  const recoSetNames = new Set<string>();

  if (resolvedReco) {
    for (const build of Object.values(resolvedReco)) {
      for (const w of build.Weapon ?? []) recoWeaponNames.add(w.name);
      for (const a of build.Amulet ?? []) recoAmuletNames.add(a.name);
      for (const name of build.Talisman ?? []) recoTalismanNames.add(name);
      for (const combo of build.Set ?? []) {
        for (const entry of combo) recoSetNames.add(entry.name);
      }
    }
  }

  const weapons = allWeapons.filter(w => recoWeaponNames.has(w.name));
  const amulets = allAmulets.filter(a => recoAmuletNames.has(a.name));
  const talismans = allTalismans.filter(t => recoTalismanNames.has(t.name));
  const sets = allSets.filter(s => recoSetNames.has(s.name) || recoSetNames.has(s.name.replace(' Set', '')));

  // Build boss display map only for filtered equipment
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

  // Filter effects to only those referenced by this character's skills
  const effectNames = collectEffectNames(character as Parameters<typeof collectEffectNames>[0]);
  const buffMap: Record<string, Effect> = {};
  for (const b of buffsArr) { if (effectNames.has(b.name)) buffMap[b.name] = b; }
  const debuffMap: Record<string, Effect> = {};
  for (const d of debuffsArr) { if (effectNames.has(d.name)) debuffMap[d.name] = d; }

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
        ...Object.fromEntries(SUFFIX_LANGS.map(sl => [`name_${sl}`, linkedChar[`Fullname_${sl}`]])),
        type: character.hasCoreFusion ? 'core-fusion' : 'original',
      } as CoreFusionLink;
    }
  }

  return (
    <CharacterDetailClient
      character={stripOtherLangs(character, lang)}
      profile={profile}
      stats={stats}
      ee={ee ? stripOtherLangs(ee, lang) : null}
      reco={resolvedReco}
      tags={tagsRaw}
      weapons={stripOtherLangsArray(weapons, lang)}
      amulets={stripOtherLangsArray(amulets, lang)}
      talismans={stripOtherLangsArray(talismans, lang)}
      sets={stripOtherLangsArray(sets, lang)}
      giftItems={giftItems}
      prosCons={prosCons}
      partners={partners}
      buffMap={stripOtherLangsRecord(buffMap, lang)}
      debuffMap={stripOtherLangsRecord(debuffMap, lang)}
      coreFusionLink={coreFusionLink}
      bossMap={bossMap}
    />
  );
}

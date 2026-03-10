'use client';

import { use } from 'react';
import Link from 'next/link';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l, lRec } from '@/lib/i18n/localize';
import { LANGUAGES } from '@/lib/i18n/config';
import type { Lang } from '@/lib/i18n/config';
import type { LangMap } from '@/types/common';
import type { CharacterIndex } from '@/types/character';
import type { Banner } from '@/types/banner';
import { charIndexPromise } from '@/lib/data/characters-client';

const bannerPromise = import('@data/banner.json').then(m => m.default as Banner[]);
const tagsPromise = import('@data/tags.json').then(m => m.default as Record<string, { label: string; [k: string]: unknown }>);

const LIMITED_TAGS = ['limited', 'seasonal', 'collab'] as const;
type LimitedTag = typeof LIMITED_TAGS[number];

type HeroInfo = {
  slug: string;
  id: string;
  badge: LimitedTag;
  releaseDate: string;
  lastRerun: string | null;
  collabName?: string;
};


const COLLAB_NAMES: Record<string, string> = {
  '2000095': 'DanMachi', // Bell Cranel
  '2000096': 'DanMachi', // Ais Wallenstein
  '2000097': 'DanMachi', // Ryu Lion
};

const BADGE_COLORS: Record<string, string> = {
  limited: 'text-pink-400',
  seasonal: 'text-green-400',
  collab: 'text-red-400',
};

const LABELS = {
  released: { en: 'Released:', jp: 'リリース:', kr: '출시:', zh: '发布:' } satisfies LangMap,
  lastRerun: { en: 'Last rerun:', jp: '最終復刻:', kr: '마지막 복각:', zh: '最近复刻:' } satisfies LangMap,
  with: { en: ' with ', jp: ' × ', kr: ' × ', zh: ' × ' } satisfies LangMap,
};

function formatDate(dateStr: string, lang: Lang): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(LANGUAGES[lang].htmlLang, { year: 'numeric', month: 'long', day: '2-digit' });
}

function getLimitedHeroesInfo(characters: Record<string, CharacterIndex>, banners: Banner[]): HeroInfo[] {

  // Derive limited characters from characters-index.json tags
  const charInfoMap = new Map<string, { badge: LimitedTag; id: string; slug: string }>();
  for (const [id, c] of Object.entries(characters)) {
    const tag = LIMITED_TAGS.find(t => c.tags.includes(t));
    if (tag) charInfoMap.set(c.Fullname, { badge: tag, id, slug: c.slug });
  }

  const bannersByChar = new Map<string, { entries: Banner[]; slug: string }>();
  for (const banner of banners) {
    if (!charInfoMap.has(banner.name)) continue;
    const charInfo = charInfoMap.get(banner.name)!;
    const existing = bannersByChar.get(banner.name) || { entries: [], slug: charInfo.slug };
    existing.entries.push(banner);
    bannersByChar.set(banner.name, existing);
  }

  const heroesInfo: HeroInfo[] = [];
  for (const [name, { entries, slug }] of bannersByChar) {
    entries.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const releaseDate = entries[0].start;
    const lastRerun = entries.length > 1 ? entries[entries.length - 1].start : null;
    const charInfo = charInfoMap.get(name)!;

    heroesInfo.push({
      slug,
      id: charInfo.id,
      badge: charInfo.badge,
      releaseDate,
      lastRerun,
      collabName: COLLAB_NAMES[charInfo.id],
    });
  }

  // Most recent rerun (or release) first
  heroesInfo.sort((a, b) => {
    const dateA = new Date(a.lastRerun ?? a.releaseDate).getTime();
    const dateB = new Date(b.lastRerun ?? b.releaseDate).getTime();
    return dateB - dateA;
  });
  return heroesInfo;
}

export default function LimitedHeroesList() {
  const { lang, href } = useI18n();
  const characters = use(charIndexPromise);
  const banners = use(bannerPromise);
  const tagsData = use(tagsPromise);
  const heroes = getLimitedHeroesInfo(characters, banners);

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {heroes.map((hero) => {
        const charData = characters[hero.id];
        if (!charData) return null;

        const heroName = l(charData, 'Fullname', lang);
        const tagMeta = tagsData[hero.badge as keyof typeof tagsData];
        const badgeLabel = tagMeta ? l(tagMeta, 'label', lang) : hero.badge;
        const badgeColor = BADGE_COLORS[hero.badge];
        const rerunText = hero.lastRerun
          ? `${lRec(LABELS.lastRerun, lang)} ${formatDate(hero.lastRerun, lang)}`
          : null;
        const collabText = hero.collabName ? `${lRec(LABELS.with, lang)}${hero.collabName}` : '';

        return (
          <Link
            key={hero.slug}
            href={href(`/characters/${hero.slug}`)}
            className="flex items-center gap-3 rounded-lg bg-gray-800/50 p-2 transition-colors hover:bg-gray-700/50"
          >
            <div className="relative shrink-0">
              <CharacterPortrait
                id={hero.id}
                name={heroName}
                size="lg"
                className="rounded-lg border-2 border-gray-600 bg-gray-900"
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{heroName}</span>
              <span className="text-sm">
                <strong className={badgeColor}>{badgeLabel}</strong>
                {collabText}
              </span>
              <span className="text-xs text-gray-400">
                {lRec(LABELS.released, lang)} {formatDate(hero.releaseDate, lang)}
              </span>
              {rerunText && (
                <span className="text-xs text-gray-400">{rerunText}</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

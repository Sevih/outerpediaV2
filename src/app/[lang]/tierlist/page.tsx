import type { Metadata } from 'next';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';
import { createPageMetadata, getMonthYear } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getAllTools } from '@/lib/data/tools';
import { getCharactersForList } from '@/lib/data/characters';
import { l as loc } from '@/lib/i18n/localize';
import FlagshipCard, { type FlagshipTopHero } from '@/app/components/tierlist/FlagshipCard';
import VsBadge from '@/app/components/tierlist/VsBadge';
import OtherRankingsRail, { type SupportingTool } from '@/app/components/tierlist/OtherRankingsRail';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string }> };

const FEATURED_SLUGS = ['tierlistpve', 'tierlistpvp'] as const;
const OTHER_RANKING_SLUGS = ['ee-priority-base', 'ee-priority-plus10', 'most-used-units'] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const l = lang as Lang;
  const t = await loadMessages(l);
  const monthYear = getMonthYear(l);
  return createPageMetadata({
    lang: l,
    path: '/tierlist',
    title: t['page.tierlist.meta_title'].replace('{monthYear}', monthYear),
    description: t['page.tierlist.description'].replace('{monthYear}', monthYear),
  });
}

/** Pick S-tier characters and shuffle them with a daily-stable seed. */
function topHeroesFor(
  characters: Awaited<ReturnType<typeof getCharactersForList>>,
  select: (c: (typeof characters)[number]) => string | undefined,
  lang: Lang,
  seedKey: string,
  cap = 12,
): FlagshipTopHero[] {
  const candidates = characters.filter((c) => select(c) === 'S');
  return seededShuffle(candidates, dailySeed(seedKey))
    .slice(0, cap)
    .map((c) => ({ id: c.ID, name: loc(c, 'Fullname', lang) }));
}

/**
 * Deterministic seed that changes once per day. Stable inside the ISR window
 * (`revalidate = 86400`) so the shuffle order matches what the page was
 * generated with.
 */
function dailySeed(extra: string): number {
  const day = Math.floor(Date.now() / 86_400_000);
  const key = `${day}:${extra}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h) ^ key.charCodeAt(i);
  return h >>> 0;
}

/** Fisher–Yates shuffle driven by a mulberry32 PRNG. */
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  let s = seed | 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default async function TierlistPage({ params }: Props) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Lang;
  const [t, allTools, characters] = await Promise.all([
    loadMessages(lang),
    getAllTools(),
    getCharactersForList(),
  ]);

  const toolMap = Object.fromEntries(allTools.map((tool) => [tool.slug, tool]));
  const flagshipMap = Object.fromEntries(
    FEATURED_SLUGS.map((slug) => [slug, toolMap[slug]]),
  );
  const supportingTools: SupportingTool[] = OTHER_RANKING_SLUGS
    .map((slug) => toolMap[slug])
    .filter(Boolean)
    .map((tool) => ({
      slug: tool.slug,
      icon: tool.icon,
      status: tool.status,
      href: tool.href,
    }));

  const topPve = topHeroesFor(characters, (c) => c.rank, lang, 'pve');
  const topPvp = topHeroesFor(characters, (c) => c.rank_pvp, lang, 'pvp');
  const totalRankings = (flagshipMap.tierlistpve ? 1 : 0) + (flagshipMap.tierlistpvp ? 1 : 0) + supportingTools.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        <h1 className="h1-page">{t['page.tierlist.title']}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-400">
          {t['page.tierlist.description'].replace('{monthYear}', getMonthYear(lang))}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          <span>{totalRankings} {t['tierlist.versus.tools_count']}</span>
          <span className="text-zinc-700" aria-hidden>·</span>
          <span>{t['tierlist.versus.units'].replace('{count}', String(characters.length))}</span>
        </div>
      </div>

      {/* Versus split */}
      <div className="relative mt-8 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-5">
        {flagshipMap.tierlistpve && (
          <FlagshipCard
            flagship="pve"
            description={t['tools.tierlistpve.desc' as TranslationKey] ?? ''}
            href={flagshipMap.tierlistpve.href ?? `/${flagshipMap.tierlistpve.slug}`}
            lang={lang}
            t={t}
            topHeroes={topPve}
            side="left"
          />
        )}
        {/* VS medallion — visible on desktop only, sits in the gutter */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-5 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <VsBadge />
        </div>
        {flagshipMap.tierlistpvp && (
          <FlagshipCard
            flagship="pvp"
            description={t['tools.tierlistpvp.desc' as TranslationKey] ?? ''}
            href={flagshipMap.tierlistpvp.href ?? `/${flagshipMap.tierlistpvp.slug}`}
            lang={lang}
            t={t}
            topHeroes={topPvp}
            side="right"
          />
        )}
      </div>

      {/* Other rankings rail */}
      <div className="mt-10">
        <OtherRankingsRail tools={supportingTools} lang={lang} t={t} />
      </div>
    </div>
  );
}

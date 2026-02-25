'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import type { GuideMeta } from '@/types/guide';
import type { LangMap } from '@/types/common';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';

import BossPortrait from '@/app/components/guides/BossPortrait';
import FitText from '@/app/components/ui/FitText';
import areaNames from '@data/guides/area_name.json';
import guideBossMap from '@data/generated/guide-boss-map.json';

/* ── Types ──────────────────────────────────────────────── */

type AreaEntry = {
  normal: LangMap & { image: string };
  hard: LangMap & { image: string };
};

type BossMapEntry = {
  boss_id: string;
  name: LangMap;
  surname?: LangMap;
  icons: string;
  element: string;
  class: string;
};

type ParsedGuide = {
  meta: GuideMeta;
  season: number;
  episode: number;
  stage: number;
  areaKey: string;
};

/* ── Helpers ─────────────────────────────────────────────── */

function parseSlug(slug: string): { season: number; episode: number; stage: number; areaKey: string } | null {
  const match = slug.match(/^S(\d+)-(\d+)-(\d+)$/);
  if (!match) return null;
  const [, s, e, st] = match;
  return {
    season: parseInt(s, 10),
    episode: parseInt(e, 10),
    stage: parseInt(st, 10),
    areaKey: `S${s}-${e}`,
  };
}

function groupBySeason(guides: GuideMeta[]): Map<number, ParsedGuide[]> {
  const parsed: ParsedGuide[] = [];

  for (const meta of guides) {
    const p = parseSlug(meta.slug);
    if (!p) continue;
    parsed.push({ meta, ...p });
  }

  parsed.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    if (a.episode !== b.episode) return a.episode - b.episode;
    return a.stage - b.stage;
  });

  const groups = new Map<number, ParsedGuide[]>();
  for (const item of parsed) {
    if (!groups.has(item.season)) groups.set(item.season, []);
    groups.get(item.season)!.push(item);
  }

  return groups;
}

/* ── Component ───────────────────────────────────────────── */

export default function AdventureList({ guides, lang, t }: CategoryViewProps) {
  const [spoilerFree, setSpoilerFree] = useState(false);

  const seasons = useMemo(() => groupBySeason(guides), [guides]);

  const areaMap = areaNames as Record<string, AreaEntry>;
  const bossMap = guideBossMap as Record<string, BossMapEntry>;

  return (
    <div className="mt-6 space-y-8">
      {/* Toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setSpoilerFree(v => !v)}
          className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300
                     hover:bg-zinc-700 transition-colors"
        >
          {spoilerFree
            ? t['guides.adventure.spoiler']
            : t['guides.adventure.spoiler_free']}
        </button>
      </div>

      {/* Season groups */}
      {[...seasons.entries()].map(([season, items]) => (
        <section key={season}>
          <h2 className="mb-4">
            {t['guides.adventure.season'].replace('{n}', String(season))}
          </h2>

          <div className="flex flex-wrap gap-3 sm:max-w-[calc(5*7.875rem+4*0.75rem)]">
            {items.map(({ meta, areaKey, episode }) => {
              const bossEntry = bossMap[meta.slug];
              const area = areaMap[areaKey];
              const showBoss = spoilerFree && !!bossEntry;
              const areaName = area ? lRec(area.hard, lang) : lRec(meta.title, lang);

              return (
                <Link
                  key={meta.slug}
                  href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
                  className="group relative overflow-hidden rounded-lg w-20 h-40 sm:w-31.5 sm:h-64
                             ring-1 ring-white/10 hover:ring-yellow-400/50 transition-all"
                >
                  {/* Background image */}
                  <Image
                    src={`/images/guides/${meta.icon}.webp`}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Stage name (top) */}
                  <div className="absolute inset-x-0 top-0 p-2">
                    <p className="text-xs font-medium text-zinc-200 drop-shadow-lg">Ep. {episode}</p>
                    {!areaName.includes(' ') ? (
                      <FitText max={12} min={8} className="font-medium text-zinc-200 drop-shadow-lg">{areaName}</FitText>
                    ) : (
                      <p className="text-xs font-medium text-zinc-200 drop-shadow-lg line-clamp-3">{areaName}</p>
                    )}
                  </div>

                  {/* Content (bottom) */}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col p-2">
                    {/* Boss portrait + name (spoiler-free) */}
                    {showBoss && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="sm:hidden">
                          <BossPortrait icons={bossEntry.icons} name={lRec(bossEntry.name, lang)} size="sm" />
                        </div>
                        <div className="hidden sm:block">
                          <BossPortrait icons={bossEntry.icons} name={lRec(bossEntry.name, lang)} size="md" />
                        </div>
                        <span className="hidden sm:block max-w-full truncate text-xs font-medium text-zinc-200">
                          {bossEntry.surname
                            ? `${lRec(bossEntry.surname, lang)} ${lRec(bossEntry.name, lang)}`
                            : lRec(bossEntry.name, lang)}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

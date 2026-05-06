import { readFile } from 'fs/promises';
import path from 'path';
import Image from 'next/image';
import Link from 'next/link';
import type { CategoryViewProps } from './types';
import { lRec } from '@/lib/i18n/localize';
import { localePath } from '@/lib/navigation';

async function loadBossIcons(bossId: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), 'data/boss', `${bossId}.json`), 'utf-8');
    const boss = JSON.parse(raw) as { icons?: string };
    return boss.icons ?? null;
  } catch {
    return null;
  }
}

export default async function DimensionalSingularityList({ guides, lang, t }: CategoryViewProps) {
  const sorted = [...guides].sort((a, b) =>
    b.last_updated.localeCompare(a.last_updated)
  );

  const iconsByBossId: Record<string, string | null> = Object.fromEntries(
    await Promise.all(
      sorted.map(async (g) => [g.boss_id ?? '', g.boss_id ? await loadBossIcons(g.boss_id) : null] as const)
    )
  );

  return (
    <>
      <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 space-y-3 text-sm text-zinc-300">
        <p>{t['guides.category.dimensional-singularity.intro']}</p>
        <p className="text-zinc-400">{t['guides.category.dimensional-singularity.unlock']}</p>
        <p className="text-zinc-400">{t['guides.category.dimensional-singularity.schedule']}</p>
        <ul className="list-disc pl-5 space-y-1 text-zinc-300">
          <li>{t['guides.category.dimensional-singularity.feature.repel']}</li>
          <li>{t['guides.category.dimensional-singularity.feature.ascension']}</li>
          <li>{t['guides.category.dimensional-singularity.feature.ranking']}</li>
        </ul>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((meta) => {
          const name = lRec(meta.title, lang);
          const bossIcons = meta.boss_id ? iconsByBossId[meta.boss_id] : null;
          const iconSrc = bossIcons
            ? `/images/guides/MT_Singularity_${bossIcons}.webp`
            : `/images/guides/${meta.icon}.webp`;
          return (
            <Link
              key={meta.slug}
              href={localePath(lang, `/guides/${meta.category}/${meta.slug}`)}
              className="group flex items-center gap-3 rounded-lg p-3
                         ring-1 ring-white/10 hover:ring-yellow-400/50 hover:bg-white/5 transition-all"
            >
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                <Image
                  src={iconSrc}
                  alt={name}
                  fill
                  sizes="64px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-100">{name}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">{t['page.guide.updated'].replace('{date}', meta.last_updated)}</p>
                <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">{lRec(meta.description, lang)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

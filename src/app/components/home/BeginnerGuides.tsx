import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import { localePath } from '@/lib/navigation';

const GUIDES = [
  { key: 'faq', nameKey: 'home.beginner.faq', descKey: 'home.beginner.faq.desc', slug: 'beginner-faq' },
  { key: 'freeheroes', nameKey: 'home.beginner.freeheroes', descKey: 'home.beginner.freeheroes.desc', slug: 'free-heroes-start-banner' },
  { key: 'stats', nameKey: 'home.beginner.stats', descKey: 'home.beginner.stats.desc', slug: 'stats' },
  { key: 'gear', nameKey: 'home.beginner.gear', descKey: 'home.beginner.gear.desc', slug: 'gear' },
  { key: 'growth', nameKey: 'home.beginner.growth', descKey: 'home.beginner.growth.desc', slug: 'heroes-growth' },
] as const;

const CATEGORY = 'general-guides';

type Props = {
  lang: Lang;
  t: Messages;
};

export default function BeginnerGuides({ lang, t }: Props) {
  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t['home.section.beginner']}</h2>
      <div className="rounded-xl border border-zinc-800 bg-slate-800/50">
        <ol className="grid grid-cols-1 divide-y divide-zinc-800 md:grid-cols-5 md:divide-x md:divide-y-0">
          {GUIDES.map((guide, i) => (
            <li key={guide.key}>
              <Link
                href={localePath(lang, `/guides/${CATEGORY}/${guide.slug}`)}
                className="flex h-full items-start gap-3 px-3 py-2.5 transition hover:bg-zinc-800/40 md:flex-col md:items-stretch md:gap-2 md:p-4"
              >
                <span className="shrink-0 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400 md:text-[11px]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight text-zinc-100">
                    {t[guide.nameKey]}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-500 md:mt-1 md:leading-relaxed">
                    {t[guide.descKey]}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

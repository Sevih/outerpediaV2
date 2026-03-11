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
      <div className="card-light p-5 md:p-6">
        <p className="mb-4 text-sm text-zinc-400">{t['home.beginner.desc']}</p>
        <ul className="space-y-2 text-sm">
          {GUIDES.map((guide) => (
            <li key={guide.key}>
              <Link
                href={localePath(lang, `/guides/${CATEGORY}/${guide.slug}`)}
                className="font-semibold text-cyan-400 underline"
              >
                {t[guide.nameKey]}
              </Link>{' '}
              <span className="text-zinc-400">
                &mdash; {t[guide.descKey]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs italic text-zinc-500">
          {t['home.beginner.footer']}
        </p>
      </div>
    </section>
  );
}

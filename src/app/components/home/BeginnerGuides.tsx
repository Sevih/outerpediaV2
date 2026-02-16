import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';

const GUIDES = [
  { key: 'faq', nameKey: 'home.beginner.faq', descKey: 'home.beginner.faq.desc' },
  { key: 'freeheroes', nameKey: 'home.beginner.freeheroes', descKey: 'home.beginner.freeheroes.desc' },
  { key: 'stats', nameKey: 'home.beginner.stats', descKey: 'home.beginner.stats.desc' },
  { key: 'gear', nameKey: 'home.beginner.gear', descKey: 'home.beginner.gear.desc' },
  { key: 'growth', nameKey: 'home.beginner.growth', descKey: 'home.beginner.growth.desc' },
] as const;

type Props = {
  lang: Lang;
  t: Messages;
};

export default function BeginnerGuides({ t }: Props) {
  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t['home.section.beginner']}</h2>
      <div className="card p-5 md:p-6">
        <p className="mb-4 text-sm text-zinc-400">{t['home.beginner.desc']}</p>
        <ul className="space-y-2 text-sm">
          {GUIDES.map((guide) => (
            <li key={guide.key}>
              <span className="font-semibold text-white">
                {t[guide.nameKey]}
              </span>{' '}
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

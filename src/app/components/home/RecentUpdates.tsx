import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import type { TranslationKey } from '@/i18n/locales/en';
import { getChangelog } from '@/lib/changelog';
import type { ChangelogType } from '@/types/changelog';
import { localePath } from '@/lib/navigation';

const TYPE_STYLES: Record<ChangelogType, string> = {
  feature: 'bg-emerald-600/20 text-emerald-400',
  update: 'bg-blue-600/20 text-blue-400',
  fix: 'bg-red-600/20 text-red-400',
  balance: 'bg-amber-600/20 text-amber-400',
};

type Props = {
  lang: Lang;
  t: Messages;
};

export default function RecentUpdates({ lang, t }: Props) {
  const entries = getChangelog(lang, { limit: 5 });

  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t['home.section.updates']}</h2>
      <div className="space-y-3">
        {entries.map((entry, i) => (
            <article key={`${entry.date}-${i}`} className="card p-4">
              <div className="mb-2 flex items-center gap-3">
                <time className="text-sm text-zinc-500">{entry.date}</time>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${TYPE_STYLES[entry.type]}`}
                >
                  {t[`changelog.type.${entry.type}` as TranslationKey]}
                </span>
              </div>
              <p className="h2-style mb-2">
                {entry.url ? (
                  <Link href={localePath(lang, entry.url)} className="text-cyan-400 hover:underline">
                    {entry.title}
                  </Link>
                ) : (
                  entry.title
                )}
              </p>
              <ul className="space-y-1 text-sm text-zinc-300">
                {entry.content.map((line, j) => (
                  <li key={j} className="leading-relaxed">
                    {line.startsWith('- ') ? line : `- ${line}`}
                  </li>
                ))}
              </ul>
            </article>
        ))}
      </div>
      <div className="mt-4 text-center">
        <Link
          href={localePath(lang, '/changelog')}
          className="text-sm text-cyan-400 hover:underline"
        >
          {t['changelog.view_full']}
        </Link>
      </div>
    </section>
  );
}

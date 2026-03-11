import type { Metadata } from 'next';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getChangelog, CHANGELOG_TYPE_STYLES } from '@/lib/changelog';
import type { TranslationKey } from '@/i18n/locales/en';
import { localePath } from '@/lib/navigation';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  return createPageMetadata({
    lang: lang as Lang,
    path: '/changelog',
    title: t['changelog.title'],
    description: t['changelog.description'],
  });
}

export default async function ChangelogPage({ params }: Props) {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  const entries = getChangelog(lang as Lang);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mx-auto mb-8 text-center text-3xl font-bold">
        {t['changelog.title']}
        <span className="sr-only">{` — Outerplane Updates & Patch Notes`}</span>
      </h1>

      <div className="space-y-4">
        {entries.map((entry, i) => (
            <article
              key={`${entry.date}-${i}`}
              className="card p-5"
            >
              <div className="mb-2 flex items-center gap-3">
                <time className="text-sm text-zinc-500">{entry.date}</time>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${CHANGELOG_TYPE_STYLES[entry.type]}`}
                >
                  {t[`changelog.type.${entry.type}` as TranslationKey]}
                </span>
              </div>

              <p className="h2-style mb-2">
                {entry.url ? (
                  <Link href={localePath(lang as Lang, entry.url)} className="text-cyan-400 hover:underline">
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
    </div>
  );
}

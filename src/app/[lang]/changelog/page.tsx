import type { Metadata } from 'next';
// TODO: restore when page links are implemented
// import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getChangelog } from '@/lib/changelog';
import type { ChangelogType } from '@/types/changelog';

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

const TYPE_STYLES: Record<ChangelogType, { label: string; className: string }> =
  {
    feature: { label: 'FEATURE', className: 'bg-emerald-600/20 text-emerald-400' },
    update: { label: 'UPDATE', className: 'bg-blue-600/20 text-blue-400' },
    fix: { label: 'FIX', className: 'bg-red-600/20 text-red-400' },
    balance: { label: 'BALANCE', className: 'bg-amber-600/20 text-amber-400' },
  };

export default async function ChangelogPage({ params }: Props) {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  const entries = getChangelog(lang as Lang);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mx-auto mb-8 text-3xl font-bold">{t['changelog.title']}</h1>

      <div className="space-y-4">
        {entries.map((entry, i) => {
          const style = TYPE_STYLES[entry.type];
          return (
            <article
              key={`${entry.date}-${i}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5"
            >
              <div className="mb-2 flex items-center gap-3">
                <time className="text-sm text-zinc-500">{entry.date}</time>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${style.className}`}
                >
                  {style.label}
                </span>
              </div>

              <p className="h2-style mb-2">
                {entry.title}
              </p>

              <ul className="space-y-1 text-sm text-zinc-300">
                {entry.content.map((line, j) => (
                  <li key={j} className="leading-relaxed">
                    {line.startsWith('- ') ? line : `- ${line}`}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}

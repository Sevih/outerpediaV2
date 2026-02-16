import type { Metadata } from 'next';
// TODO: restore when page links are implemented
// import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import { getChangelog } from '@/lib/changelog';
import type { ChangelogType } from '@/types/changelog';

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
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="relative mb-8 text-center text-3xl font-bold">
        <span className="relative z-10">{t['changelog.title']}</span>
        <span className="absolute -bottom-1 left-1/2 h-1 w-24 -translate-x-1/2 rounded bg-cyan-600 opacity-70" />
      </h1>

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

              <h2 className="mb-2 text-lg font-semibold">
                {/* TODO: restore Link when pages are implemented
                {entry.url ? (
                  <Link
                    href={`/${lang}${entry.url}`}
                    className="text-cyan-400 hover:underline"
                  >
                    {entry.title}
                  </Link>
                ) : (
                  entry.title
                )} */}
                {entry.title}
              </h2>

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

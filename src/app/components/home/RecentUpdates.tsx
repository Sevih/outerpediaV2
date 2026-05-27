import Link from 'next/link';
import type { Lang } from '@/lib/i18n/config';
import type { Messages } from '@/i18n';
import type { TranslationKey } from '@/i18n/locales/en';
import { getChangelog, CHANGELOG_TYPE_STYLES } from '@/lib/changelog';
import { localePath } from '@/lib/navigation';

type Props = {
  lang: Lang;
  t: Messages;
};

/** Timeline pastille colors per changelog type — border = ring, dot = fill. */
const TYPE_PASTILLE: Record<string, { ring: string; dot: string }> = {
  feature: { ring: 'border-cyan-400', dot: 'bg-cyan-400' },
  update: { ring: 'border-amber-400', dot: 'bg-amber-400' },
  fix: { ring: 'border-emerald-400', dot: 'bg-emerald-400' },
};

export default function RecentUpdates({ lang, t }: Props) {
  const entries = getChangelog(lang, { limit: 5 });

  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t['home.section.updates']}</h2>

      {/* Vertical timeline */}
      <div className="relative">
        {/* Rail */}
        <div
          aria-hidden
          className="absolute bottom-3 left-1.75 top-3 w-px bg-zinc-800"
        />

        <ul className="flex flex-col gap-4">
          {entries.map((entry, i) => {
            const pastille =
              TYPE_PASTILLE[entry.type] ?? { ring: 'border-zinc-500', dot: 'bg-zinc-500' };
            return (
              <li key={`${entry.date}-${i}`} className="relative pl-7">
                {/* Pastille */}
                <span
                  aria-hidden
                  className={`absolute left-0 top-3 inline-flex size-3.5 items-center justify-center rounded-full border-2 bg-black ${pastille.ring}`}
                >
                  <span className={`size-1.5 rounded-full ${pastille.dot}`} />
                </span>

                <article className="rounded-lg border border-zinc-800 bg-slate-800/50 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <time className="font-mono text-xs text-zinc-500">
                      {entry.date}
                    </time>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${CHANGELOG_TYPE_STYLES[entry.type]}`}
                    >
                      {t[`changelog.type.${entry.type}` as TranslationKey]}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      {entry.url ? (
                        <Link
                          href={localePath(lang, entry.url)}
                          className="text-zinc-100 transition hover:text-cyan-300"
                        >
                          {entry.title}
                        </Link>
                      ) : (
                        entry.title
                      )}
                    </h3>
                  </div>
                  <ul className="space-y-0.5 text-sm text-zinc-400">
                    {entry.content.map((line, j) => (
                      <li key={j} className="leading-relaxed">
                        — {line.startsWith('- ') ? line.slice(2) : line}
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-6 text-center">
        <Link
          href={localePath(lang, '/changelog')}
          className="inline-flex items-center gap-1 text-sm text-cyan-400 transition hover:text-cyan-300"
        >
          {t['changelog.view_full']} →
        </Link>
      </div>
    </section>
  );
}

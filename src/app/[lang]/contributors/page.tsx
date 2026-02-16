import type { Metadata } from 'next';
import Image from 'next/image';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import contributors from '@data/contributors.json';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);
  return createPageMetadata({
    lang: lang as Lang,
    path: '/contributors',
    title: t['page.contributors.title'],
    description: t['contributors.description'],
  });
}

export default async function ContributorsPage({ params }: Props) {
  const { lang } = await params;
  const t = await loadMessages(lang as Lang);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mx-auto mb-4 text-3xl font-bold">{t['contributors.title']}</h1>

      <p className="mx-auto mb-8 max-w-2xl text-center text-zinc-400">
        {t['contributors.description']}
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {contributors.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <Image
                  src={`/images/contributors/${c.avatar}.webp`}
                  alt={c.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full border-2 border-cyan-600/30 object-cover"
                />
                <div className="flex-1">
                  <h2 className="mb-1 text-xl font-semibold">{c.name}</h2>
                  <p className="mb-2 text-sm text-cyan-400">{c.role}</p>
                  {c.favoriteCharacter && (
                    <p className="mb-2 text-sm text-zinc-400">
                      <span className="text-zinc-500">{t['contributors.favorite_character']}</span>{' '}
                      {c.favoriteCharacter}
                    </p>
                  )}
                </div>
              </div>

              {c.quote && (
                <p className="border-l-2 border-cyan-600/50 pl-3 text-sm italic text-zinc-300">
                  &ldquo;{c.quote}&rdquo;
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

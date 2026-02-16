import type { Metadata } from 'next';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import PromoCodes from '@/app/components/home/PromoCodes';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: Lang }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang);
  return createPageMetadata({
    lang,
    path: '/promo-codes',
    title: t['page.promo_codes.title'],
    description: t['page.promo_codes.description'],
  });
}

async function loadPromoCodes() {
  const raw = await readFile(
    join(process.cwd(), 'data/promo-codes.json'),
    'utf-8'
  );
  return JSON.parse(raw);
}

export default async function PromoCodesPage({ params }: Props) {
  const { lang } = await params;
  const [t, promoCodes] = await Promise.all([
    loadMessages(lang),
    loadPromoCodes(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="h1-page mb-8">{t['page.promo_codes.title']}</h1>
      <p className="mx-auto mb-10 max-w-xl text-center text-zinc-400">
        {t['page.promo_codes.description']}
      </p>

      <PromoCodes
        codes={promoCodes}
        t={{
          title: t['home.section.codes'],
          copy: t['home.codes.copy'],
          copied: t['home.codes.copied'],
          empty: t['home.codes.empty'],
        }}
      />
    </main>
  );
}

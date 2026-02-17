import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import CurrentBanners from '@/app/components/home/CurrentBanners';
import PromoCodes from '@/app/components/home/PromoCodes';
import BeginnerGuides from '@/app/components/home/BeginnerGuides';
import RecentUpdates from '@/app/components/home/RecentUpdates';

export const revalidate = 86400;

type Props = { params: Promise<{ lang: Lang }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await loadMessages(lang);
  const meta = createPageMetadata({
    lang,
    path: '/',
    title: t['page.home.title'],
    description: t['page.home.description'],
  });
  // Bypass layout template — home title already includes site name
  return { ...meta, title: { absolute: t['page.home.title'] } };
}

async function loadPromoCodes() {
  const raw = await readFile(
    join(process.cwd(), 'data/promo-codes.json'),
    'utf-8'
  );
  return JSON.parse(raw);
}

export default async function Home({ params }: Props) {
  const { lang } = await params;
  const [t, promoCodes] = await Promise.all([
    loadMessages(lang),
    loadPromoCodes(),
  ]);

  return (
    <main>
      {/* Banner — full width, cropped top & bottom */}
      <div className="relative h-48 w-full md:h-72 lg:h-80">
        <Image
          src="/images/banner.webp"
          alt="Outerpedia — Outerplane Wiki & Database"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <h1 className="sr-only">{t['page.home.title']}</h1>
      </div>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-6 md:space-y-16 md:px-6">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 text-center">
        <p className="max-w-xl text-zinc-400">{t['page.home.description']}</p>
        <Link
          href={`/${lang}/characters`}
          className="mt-2 inline-block rounded-lg bg-cyan-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-600"
        >
          {t['home.cta.characters']}
        </Link>
      </section>

      {/* Desktop: left (banners + beginner) | right (codes spanning both rows) */}
      {/* Mobile: banners → codes → beginner */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[3fr_1fr] md:grid-rows-[auto_auto]">
        <div className="order-1 md:order-0">
          <CurrentBanners t={t} />
        </div>

        <div className="order-2 md:order-0 md:row-span-2">
          <PromoCodes
            codes={promoCodes}
            lang={lang}
            limit={8}
            t={{
              title: t['home.section.codes'],
              copy: t['home.codes.copy'],
              copied: t['home.codes.copied'],
              empty: t['home.codes.empty'],
              viewAll: t['home.codes.view_all'],
            }}
          />
        </div>

        <div className="order-3 md:order-0">
          <BeginnerGuides lang={lang} t={t} />
        </div>
      </div>

      {/* Recent Updates — full width */}
      <RecentUpdates lang={lang} t={t} />
      </div>
    </main>
  );
}

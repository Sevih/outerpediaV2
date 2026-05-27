import type { Metadata } from 'next';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Lang } from '@/lib/i18n/config';
import { createPageMetadata } from '@/lib/seo';
import { loadMessages } from '@/i18n';
import HomeHero from '@/app/components/home/HomeHero';
import CurrentBanners from '@/app/components/home/CurrentBanners';
import PromoCodes from '@/app/components/home/PromoCodes';
import BeginnerGuides from '@/app/components/home/BeginnerGuides';
import RecentUpdates from '@/app/components/home/RecentUpdates';
import DiscordBanner from '@/app/components/home/DiscordBanner';
import ServerResets from '@/app/components/home/ServerResets';
import BuffEventTimer, { type BuffScheduleEntry } from '@/app/components/home/BuffEventTimer';

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
  return { ...meta, title: { absolute: t['page.home.title'] } };
}

async function loadPromoCodes() {
  const raw = await readFile(
    join(process.cwd(), 'data/coupons.json'),
    'utf-8'
  );
  return JSON.parse(raw);
}

async function loadBuffEvents(): Promise<BuffScheduleEntry[]> {
  try {
    const raw = await readFile(
      join(process.cwd(), 'data/patch-notes/buff-events.json'),
      'utf-8'
    );
    return (JSON.parse(raw).schedule ?? []) as BuffScheduleEntry[];
  } catch {
    return [];
  }
}

export default async function Home({ params }: Props) {
  const { lang } = await params;
  const [t, promoCodes, buffEvents] = await Promise.all([
    loadMessages(lang),
    loadPromoCodes(),
    loadBuffEvents(),
  ]);

  return (
    <main>
      {/* Hero — banner with text overlay */}
      <HomeHero t={t} />

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:space-y-16 md:px-6">
        {/* Discord — top of content, full width */}
        <DiscordBanner t={t} />

        {/* Outer 2-col layout.
            Left col stacks: Active banners + Today section (Resets + Buff).
            Right col: PromoCodes spans the full available height. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-10 md:gap-12">
            <CurrentBanners t={t} />
            <section>
              <h2 className="mx-auto mb-6 text-2xl">
                {t['home.resets.title']} · {t['home.buff.title']}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
                <ServerResets t={t} />
                <BuffEventTimer schedule={buffEvents} lang={lang} t={t} />
              </div>
            </section>
          </div>

          <PromoCodes
            codes={promoCodes}
            lang={lang}
            limit={6}
            t={{
              title: t['home.section.codes'],
              copy: t['home.codes.copy'],
              copied: t['common.copied'],
              empty: t['home.codes.empty'],
              viewAll: t['home.codes.view_all'],
            }}
          />
        </div>

        {/* Beginner guides */}
        <BeginnerGuides lang={lang} t={t} />

        {/* Recent updates — full-width timeline */}
        <RecentUpdates lang={lang} t={t} />
      </div>
    </main>
  );
}

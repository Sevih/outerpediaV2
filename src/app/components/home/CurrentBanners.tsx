import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Messages } from '@/i18n';
import { getRequestLang } from '@/lib/i18n/server';
import { l } from '@/lib/i18n/localize';
import { getCharacterIndex } from '@/lib/data/characters';
import { splitCharacterName } from '@/lib/character-name';
import ResponsiveCharacterCard from '@/app/components/character/ResponsiveCharacterCard';
import BannerCountdown from './BannerCountdown';

type BannerEntry = {
  id: string;
  name: string;
  start: string;
  end: string;
};

async function loadBanners(): Promise<BannerEntry[]> {
  const raw = await readFile(join(process.cwd(), 'data/banner.json'), 'utf-8');
  return JSON.parse(raw);
}

type Props = {
  t: Messages;
};

export default async function CurrentBanners({ t }: Props) {
  const lang = getRequestLang();
  const [banners, charIndex] = await Promise.all([
    loadBanners(),
    getCharacterIndex(),
  ]);

  const now = new Date().toISOString().slice(0, 10);
  const active = banners.filter((b) => b.start <= now && b.end >= now);

  if (active.length === 0) return null;

  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t['home.section.banners']}</h2>

      <div className="flex flex-wrap justify-center gap-4 md:gap-6">
        {active.map((banner) => {
          const char = charIndex[banner.id];
          if (!char) return null;

          const displayName = l(char, 'Fullname', lang);
          const { prefix } = splitCharacterName(banner.id, displayName, lang);

          return (
            <ResponsiveCharacterCard
              key={`${banner.id}-${banner.start}`}
              id={banner.id}
              name={displayName}
              prefix={prefix}
              element={char.Element}
              classType={char.Class}
              rarity={char.Rarity}
              tags={char.tags}
              href={`/${lang}/characters/${char.slug}`}
            >
              <BannerCountdown
                endDate={banner.end}
                element={char.Element}
                endsInLabel={t['home.banner.ends_in']}
                endedLabel={t['home.banner.ended']}
              />
            </ResponsiveCharacterCard>
          );
        })}
      </div>
    </section>
  );
}

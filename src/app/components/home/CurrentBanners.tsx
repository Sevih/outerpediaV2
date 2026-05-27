import { readFile } from 'fs/promises';
import { join } from 'path';
import Image from 'next/image';
import type { Messages } from '@/i18n';
import type { TranslationKey } from '@/i18n/locales/en';
import { getRequestLang } from '@/lib/i18n/server';
import { l } from '@/lib/i18n/localize';
import { getCharacterIndex } from '@/lib/data/characters';
import { splitCharacterName } from '@/lib/character-name';
import { ELEMENT_TEXT } from '@/lib/theme';
import ResponsiveCharacterCard from '@/app/components/character/ResponsiveCharacterCard';
import { localePath } from '@/lib/navigation';
import BannerCountdown, { BannerWrapper } from './BannerCountdown';
import BannerCarousel, { type CarouselItem } from './BannerCarousel';

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

  const enriched = active
    .map((banner) => {
      const char = charIndex[banner.id];
      if (!char) return null;
      const displayName = l(char, 'Fullname', lang);
      const { prefix } = splitCharacterName(displayName, lang);
      return { banner, char, displayName, prefix };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Desktop layout: cards with countdown inside (original behavior)
  const desktopCards = enriched.map(({ banner, char, displayName, prefix }) => (
    <BannerWrapper key={`${banner.id}-${banner.start}`} endDate={banner.end}>
      <ResponsiveCharacterCard
        id={banner.id}
        name={displayName}
        prefix={prefix}
        element={char.Element}
        classType={char.Class}
        rarity={char.Rarity}
        tags={char.tags}
        href={localePath(lang, `/characters/${char.slug}`)}
      >
        <BannerCountdown
          endDate={banner.end}
          element={char.Element}
          endsInLabel={t['home.banner.ends_in']}
        />
      </ResponsiveCharacterCard>
    </BannerWrapper>
  ));

  // Mobile layout: deck carousel with metadata side panel
  const carouselItems: CarouselItem[] = enriched.map(
    ({ banner, char, displayName, prefix }) => {
      const elementKey = `sys.element.${char.Element.toLowerCase()}` as TranslationKey;
      const classKey = `sys.class.${char.Class.toLowerCase()}` as TranslationKey;
      return {
        key: `${banner.id}-${banner.start}`,
        card: (
          <BannerWrapper endDate={banner.end}>
            <ResponsiveCharacterCard
              id={banner.id}
              name={displayName}
              prefix={prefix}
              element={char.Element}
              classType={char.Class}
              rarity={char.Rarity}
              tags={char.tags}
              href={localePath(lang, `/characters/${char.slug}`)}
              size={{ base: 'md' }}
              showName={false}
            />
          </BannerWrapper>
        ),
        sidePanel: (
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-bold leading-tight text-zinc-100">
              {displayName}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <Image
                  src={`/images/ui/elem/CM_Element_${char.Element}.webp`}
                  alt=""
                  width={14}
                  height={14}
                  unoptimized
                />
                <span className={ELEMENT_TEXT[char.Element]}>{t[elementKey]}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Image
                  src={`/images/ui/class/CM_Class_${char.Class}.webp`}
                  alt=""
                  width={14}
                  height={14}
                  unoptimized
                />
                <span className="text-class">{t[classKey]}</span>
              </span>
            </div>
            <div className="mt-1">
              <BannerCountdown
                endDate={banner.end}
                element={char.Element}
                endsInLabel={t['home.banner.ends_in']}
              />
            </div>
          </div>
        ),
      };
    }
  );

  return (
    <section>
      <h2 className="mx-auto mb-6 text-2xl">{t['home.section.banners']}</h2>

      {/* Mobile: deck carousel with side panel */}
      <div className="md:hidden">
        <BannerCarousel items={carouselItems} />
      </div>

      {/* Desktop: flex-wrap, all banners visible */}
      <div className="hidden gap-4 md:flex md:flex-wrap md:justify-center md:gap-6">
        {desktopCards}
      </div>
    </section>
  );
}

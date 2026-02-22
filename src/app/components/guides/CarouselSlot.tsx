'use client';

import { useState } from 'react';
import { useKeenSlider, type KeenSliderPlugin } from 'keen-slider/react';
import 'keen-slider/keen-slider.min.css';
import Image from 'next/image';
import CharacterCard from '@/app/components/character/CharacterCard';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { splitCharacterName } from '@/lib/character-name';
import nameToId from '@data/generated/characters-name-to-id.json';
import charIndex from '@data/generated/characters-index.json';
import type { CharacterIndex } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';

const nameMap = nameToId as Record<string, string>;
const indexMap = charIndex as Record<string, CharacterIndex>;

type Props = {
  characters: string[];
};

type ResolvedChar = {
  charId: string;
  localizedName: string;
  prefix: string | null;
  slug: string;
  entry: CharacterIndex;
};

function resolveChar(name: string, lang: Lang): ResolvedChar | null {
  const charId = nameMap[name];
  if (!charId) return null;
  const entry = indexMap[charId];
  if (!entry) return null;
  const localizedName = l(entry, 'Fullname', lang) as string;
  const { prefix } = splitCharacterName(charId, localizedName, lang);
  return {
    charId,
    localizedName,
    prefix,
    slug: entry.slug,
    entry,
  };
}

const MAX_VISIBLE = 5;

const carousel: KeenSliderPlugin = (slider) => {
  function getZ(count: number): number {
    return 165 + Math.max(0, (count - 5) * 15);
  }

  function rotate() {
    const z = getZ(slider.slides.length);
    const deg = 360 * slider.track.details.progress;
    slider.container.style.transform = `translateZ(-${z}px) rotateY(${-deg}deg)`;
  }

  function updateVisibility() {
    const current = slider.track.details.rel;
    const total = slider.slides.length;

    slider.slides.forEach((slide, idx) => {
      let distance = idx - current;
      if (distance > total / 2) distance -= total;
      else if (distance < -total / 2) distance += total;

      const abs = Math.abs(distance);
      if (abs > Math.floor(MAX_VISIBLE / 2)) {
        slide.style.opacity = '0';
        slide.style.visibility = 'hidden';
      } else {
        slide.style.opacity = '1';
        slide.style.visibility = 'visible';
      }
      slide.classList.toggle('is-active', idx === current);
    });
  }

  slider.on('created', () => {
    // Force 3D styles — keen-slider sets inline overflow:hidden that kills 3D
    const c = slider.container;
    c.style.overflow = 'visible';
    c.style.position = 'absolute';
    c.style.transformStyle = 'preserve-3d';
    c.style.width = '100%';
    c.style.height = '100%';

    const z = getZ(slider.slides.length);
    const deg = 360 / slider.slides.length;
    slider.slides.forEach((el, idx) => {
      el.style.transform = `rotateY(${deg * idx}deg) translateZ(${z}px)`;
      el.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';
    });
    rotate();
    updateVisibility();
  });

  slider.on('detailsChanged', () => {
    rotate();
    updateVisibility();
  });
};

export default function CarouselSlot({ characters }: Props) {
  const { lang } = useI18n();
  const [isAnimating, setIsAnimating] = useState(false);

  const [sliderRef, instanceRef] = useKeenSlider(
    {
      initial: 0,
      loop: true,
      selector: '.carousel-cell',
      renderMode: 'custom',
      mode: 'free-snap',
      defaultAnimation: { duration: 400 },
      animationStarted() { setIsAnimating(true); },
      animationEnded() { setIsAnimating(false); },
    },
    [carousel],
  );

  const resolved = characters
    .map((name) => resolveChar(name, lang as Lang))
    .filter(Boolean) as ResolvedChar[];

  if (resolved.length === 0) return null;

  // Single character — static card, no carousel
  if (resolved.length === 1) {
    const c = resolved[0];
    return (
      <div className="carousel-slot">
        <CharacterCard
          id={c.charId}
          name={c.localizedName}
          prefix={c.prefix}
          element={c.entry.Element}
          classType={c.entry.Class}
          rarity={c.entry.Rarity}
          tags={c.entry.tags}
          href={`/${lang}/characters/${c.slug}`}
          size="md"
        />
      </div>
    );
  }

  // Multiple characters — 3D carousel
  return (
    <div className="carousel-slot">
      <div className="carousel-scene">
        <div ref={sliderRef} className="keen-slider">
          {resolved.map((c, idx) => (
            <div key={`${c.charId}-${idx}`} className="carousel-cell">
              <CharacterCard
                id={c.charId}
                name={c.localizedName}
                prefix={c.prefix}
                element={c.entry.Element}
                classType={c.entry.Class}
                rarity={c.entry.Rarity}
                tags={c.entry.tags}
                href={`/${lang}/characters/${c.slug}`}
                size="md"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      {resolved.length > 1 && (
        <div className="carousel-controls">
          <button
            onClick={() => !isAnimating && instanceRef.current?.prev()}
            aria-label="Previous"
            className="carousel-arrow"
            disabled={isAnimating}
          >
            <Image
              src="/images/ui/common/CM_Icon_Arrow_Story.webp"
              alt=""
              width={24}
              height={24}
              className="rotate-180"
            />
          </button>
          <button
            onClick={() => !isAnimating && instanceRef.current?.next()}
            aria-label="Next"
            className="carousel-arrow"
            disabled={isAnimating}
          >
            <Image
              src="/images/ui/common/CM_Icon_Arrow_Story.webp"
              alt=""
              width={24}
              height={24}
            />
          </button>
        </div>
      )}
    </div>
  );
}

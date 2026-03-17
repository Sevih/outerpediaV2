'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/contexts/I18nContext';
import Tabs from '@/app/components/ui/Tabs';
import comicsData from '@data/generated/comics.json';

const data = comicsData as Record<string, string[]>;
const LANGS = ['EN', 'JP', 'KR'] as const;
type ComicLang = (typeof LANGS)[number];

function getImageSrc(f: string, lang: ComicLang) {
  return `/images/4-Comics/${lang}/${encodeURIComponent(f)}.webp`;
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const portalRoot =
    typeof document !== 'undefined' ? document.getElementById('portal-root') : null;

  const handlePrev = useCallback(
    () => onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1),
    [currentIndex, images.length, onNavigate],
  );

  const handleNext = useCallback(
    () => onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0),
    [currentIndex, images.length, onNavigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, handlePrev, handleNext]);

  if (!portalRoot || images.length === 0) return null;

  const src = images[currentIndex];

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute right-4 top-4 z-50 p-2 text-white/70 transition-colors hover:text-white"
        onClick={onClose}
        aria-label="Close"
      >
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Counter */}
      <div className="absolute left-4 top-4 z-50 text-sm text-white/70">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Navigation */}
      {images.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 z-50 -translate-y-1/2 p-2 text-white/50 transition-colors hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Previous"
          >
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            className="absolute right-4 top-1/2 z-50 -translate-y-1/2 p-2 text-white/50 transition-colors hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Next"
          >
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </>
      )}

      {/* Image */}
      <div className="relative h-[85vh] w-[90vw] sm:w-[60vw] lg:w-[40vw]" onClick={(e) => e.stopPropagation()}>
        <Image
          src={src}
          alt={`Comic ${currentIndex + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 60vw, 40vw"
          priority
        />
      </div>
    </div>,
    portalRoot,
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ComicsTool() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<ComicLang>('EN');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const tabLabels = useMemo(
    () =>
      LANGS.map(
        (lang) =>
          `${t(`comics.lang.${lang}` as Parameters<typeof t>[0])} (${data[lang]?.length ?? 0})`,
      ),
    [t],
  );

  const images = useMemo(() => {
    return (data[selected] ?? []).map((f) => ({
      f,
      src: getImageSrc(f, selected),
    }));
  }, [selected]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Credit notice */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-700/50 bg-amber-900/30 p-4">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1 text-center text-sm text-amber-200/90">
          <p>{t('comics.credit')}</p>
        </div>
      </div>

      <p className="mb-6 text-center text-sm text-zinc-400">{t('comics.description')}</p>

      {/* Language tabs */}
      <div className="mb-6 flex justify-center">
        <Tabs
          items={LANGS as unknown as readonly string[]}
          labels={tabLabels}
          value={selected}
          onChange={(v) => setSelected(v as ComicLang)}
          hashPrefix="lang"
        />
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {images.map((img, index) => (
          <button
            key={img.f}
            className="group relative aspect-3/4 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 transition-all hover:scale-[1.02] hover:border-sky-500"
            onClick={() => setLightboxIndex(index)}
          >
            <Image
              src={img.src}
              alt={`Comic ${index + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain"
              loading="lazy"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
              <svg
                className="h-8 w-8 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images.map((img) => img.src)}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

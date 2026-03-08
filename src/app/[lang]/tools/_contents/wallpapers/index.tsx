'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/contexts/I18nContext';
import Tabs from '@/app/components/ui/Tabs';
import wallpapersData from '@data/generated/wallpapers.json';

type ImageEntry = { f: string; w: number; h: number };
type WallpapersData = Record<string, ImageEntry[]>;

const data = wallpapersData as WallpapersData;

const CATEGORIES = [
  'Outerpedia',
  'HeroFullArt',
  'Cutin',
  'Full:Scenario',
  'Full:Events',
  'Full:Others',
  'Banner',
  'Art',
] as const;

type Category = (typeof CATEGORIES)[number];

const HELPSHIFT_URL = 'https://outerplane.helpshift.com/hc/en/4-outerplane/';

function getFolderName(category: Category): string {
  if (category.startsWith('Full:')) return 'Full';
  return category;
}

function getImagePaths(entry: ImageEntry, category: Category) {
  const folder = getFolderName(category);
  return {
    src: `/images/download/${folder}/${entry.f}.webp`,
    downloadSrc: `/images/download/${folder}/${entry.f}.png`,
  };
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
  downloadLabel,
}: {
  images: { src: string; downloadSrc: string; w: number; h: number }[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
  downloadLabel: string;
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

  const cur = images[currentIndex];

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
      <div className="relative h-[80vh] w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <Image
          src={cur.src}
          alt={`Wallpaper ${currentIndex + 1}`}
          fill
          className="object-contain"
          sizes="90vw"
          priority
        />
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-lg bg-black/70 px-3 py-2 font-mono text-sm text-gray-300">
          {cur.w} x {cur.h} PNG
        </div>
        <a
          href={cur.downloadSrc}
          download
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-white transition-colors hover:bg-sky-500"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {downloadLabel}
        </a>
      </div>
    </div>,
    portalRoot,
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WallpapersTool() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Category>('HeroFullArt');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const tabLabels = useMemo(
    () =>
      CATEGORIES.map(
        (cat) =>
          `${t(`wallpapers.cat.${cat}` as Parameters<typeof t>[0])} (${data[cat]?.length ?? 0})`,
      ),
    [t],
  );

  const images = useMemo(() => {
    return (data[selected] ?? []).map((entry) => ({
      ...entry,
      ...getImagePaths(entry, selected),
    }));
  }, [selected]);

  const lightboxImages = useMemo(
    () =>
      images.map((img) => ({
        src: img.src,
        downloadSrc: img.downloadSrc,
        w: img.w,
        h: img.h,
      })),
    [images],
  );

  const isPortrait = selected === 'HeroFullArt' || selected === 'Cutin';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Disclaimer */}
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
          <p>{t('wallpapers.disclaimer.line1')}</p>
          <p className="mt-1">
            {t('wallpapers.disclaimer.line2')}{' '}
            <a
              href={HELPSHIFT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 underline hover:text-amber-300"
            >
              {t('wallpapers.contactLink')}
            </a>
          </p>
        </div>
      </div>

      <p className="mb-6 text-center text-sm text-zinc-400">{t('wallpapers.description')}</p>

      {/* Category tabs */}
      <div className="mb-6 flex justify-center">
        <Tabs
          items={CATEGORIES as unknown as readonly string[]}
          labels={tabLabels}
          value={selected}
          onChange={(v) => setSelected(v as Category)}
          hashPrefix="cat"
        />
      </div>

      {/* Gallery grid */}
      <div
        className={
          isPortrait
            ? 'grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5'
        }
      >
        {images.map((img, index) => (
          <button
            key={img.f}
            className={`group relative ${isPortrait ? 'aspect-3/4' : 'aspect-video'} overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 transition-all hover:scale-[1.02] hover:border-sky-500`}
            onClick={() => setLightboxIndex(index)}
          >
            <Image
              src={img.src}
              alt={img.f}
              fill
              sizes={
                isPortrait
                  ? '(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw'
                  : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw'
              }
              className={isPortrait ? 'object-contain' : 'object-cover'}
              loading="lazy"
            />
            {/* Resolution badge */}
            <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
              {img.w}x{img.h}
            </div>
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
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          downloadLabel={t('wallpapers.download')}
        />
      )}
    </div>
  );
}

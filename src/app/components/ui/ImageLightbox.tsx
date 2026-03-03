'use client';

import { useState, useEffect, useCallback } from 'react';

type Props = {
  src: string;
  alt: string;
  caption?: string;
  /** Classes appliquées au conteneur figure */
  className?: string;
  /** Classes appliquées à l'image miniature (défaut : max-h-48 w-auto) */
  thumbnailClassName?: string;
};

export default function ImageLightbox({ src, alt, caption, className, thumbnailClassName }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <figure className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-zoom-in focus:outline-none"
          aria-label={`Agrandir : ${alt}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={`rounded-lg transition-opacity hover:opacity-80 ${thumbnailClassName ?? 'max-h-48 w-auto'}`}
            loading="lazy"
          />
        </button>
        {caption && (
          <figcaption className="text-xs text-gray-400 text-center">{caption}</figcaption>
        )}
      </figure>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={close}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition"
              aria-label="Fermer"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] max-w-full rounded-lg object-contain"
            />
            {caption && (
              <p className="mt-2 text-center text-sm text-gray-300">{caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import en from '@/i18n/locales/en';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html className="dark">
      <body className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-6xl font-bold">500</h1>
          <p className="text-lg text-zinc-400">{en['error.500']}</p>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-white/10 px-6 py-2 text-sm transition-colors hover:bg-white/20"
          >
            {en['error.try_again']}
          </button>
        </div>
      </body>
    </html>
  );
}

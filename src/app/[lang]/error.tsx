'use client';

import { useI18n } from '@/lib/contexts/I18nContext';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">500</h1>
      <p className="text-lg text-zinc-400">{t('error.500')}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-white/10 px-6 py-2 text-sm transition-colors hover:bg-white/20"
      >
        {t('error.try_again')}
      </button>
    </main>
  );
}

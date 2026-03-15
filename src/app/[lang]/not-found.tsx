'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';

export default function NotFound() {
  const { t, lang } = useI18n();

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-lg text-zinc-400">{t('error.404')}</p>
      <Link
        href={`/${lang}`}
        className="mt-4 rounded-lg bg-white/10 px-6 py-2 text-sm transition-colors hover:bg-white/20"
      >
        {t('error.back_home')}
      </Link>
    </main>
  );
}

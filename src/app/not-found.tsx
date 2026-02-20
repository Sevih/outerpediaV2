import Link from 'next/link';
import { DEFAULT_LANG } from '@/lib/i18n/config';
import en from '@/i18n/locales/en';

export default function RootNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-lg text-zinc-400">{en['error.404']}</p>
      <Link
        href={`/${DEFAULT_LANG}`}
        className="mt-4 rounded-lg bg-white/10 px-6 py-2 text-sm transition-colors hover:bg-white/20"
      >
        {en['error.back_home']}
      </Link>
    </main>
  );
}

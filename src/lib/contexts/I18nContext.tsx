'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import type { Route } from 'next';
import type { Lang } from '@/lib/i18n/config';
import type { Messages, TFunction } from '@/i18n';
import { makeT } from '@/i18n';
import { localePath } from '@/lib/navigation';

type I18nCtx = {
  lang: Lang;
  t: TFunction;
  /** Build a locale-aware path (subdomain mode strips the lang prefix) */
  href: (path: string) => Route;
};

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({
  lang,
  messages,
  children,
}: {
  lang: Lang;
  messages: Messages;
  children: React.ReactNode;
}) {
  const t = useMemo(() => makeT(messages), [messages]);
  const href = useCallback((path: string) => localePath(lang, path), [lang]);
  const value = useMemo(() => ({ lang, t, href }), [lang, t, href]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

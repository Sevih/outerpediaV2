'use client';

import { createContext, useContext, useMemo } from 'react';
import type { Lang } from '@/lib/i18n/config';
import type { Messages, TFunction } from '@/i18n';
import { makeT } from '@/i18n';

type I18nCtx = {
  lang: Lang;
  t: TFunction;
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
  const value = useMemo(() => ({ lang, t }), [lang, t]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

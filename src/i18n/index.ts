import { cache } from 'react';
import type { Lang } from '@/lib/i18n/config';
import { isValidLang } from '@/lib/i18n/config';
import type { TranslationKey } from './locales/en';

export type { TranslationKey };
export type Messages = Record<TranslationKey, string>;
export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** Load messages for a language (cached per request) */
export const loadMessages = cache(async (lang: Lang): Promise<Messages> => {
  const safeLang = isValidLang(lang) ? lang : 'en';
  const mod = await import(`./locales/${safeLang}.ts`);
  return mod.default;
});

/** Resolve ICU {var, plural, one {…} other {…}} patterns */
function resolvePlurals(text: string, vars: Record<string, string | number>): string {
  return text.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
    (_, varName, one, other) => {
      const count = Number(vars[varName] ?? 0);
      return (count === 1 ? one : other).replace(/#/g, String(count));
    },
  );
}

/** Create a translation function from a messages dict */
export function makeT(messages: Messages): TFunction {
  return (key, vars) => {
    let text = messages[key] ?? key;
    if (!vars) return text;
    text = resolvePlurals(text, vars);
    return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  };
}

/** Get a translation function for Server Components (cached per request) */
export const getT = cache(async (lang: Lang): Promise<TFunction> => {
  const messages = await loadMessages(lang);
  return makeT(messages);
});

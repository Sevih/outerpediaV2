import { cache } from 'react';
import type { Lang } from './config';
import { DEFAULT_LANG } from './config';

/**
 * Request-scoped lang store using React cache().
 * Set once in the root layout, read anywhere in server components.
 */
const getStore = cache(() => ({ lang: DEFAULT_LANG as Lang }));

/** Call this in [lang]/layout.tsx to set the lang for the current request */
export function setRequestLang(lang: Lang) {
  getStore().lang = lang;
}

/** Read the current request lang from any server component */
export function getRequestLang(): Lang {
  return getStore().lang;
}

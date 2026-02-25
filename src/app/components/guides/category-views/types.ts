import type { Lang } from '@/lib/i18n/config';
import type { GuideMeta } from '@/types/guide';
import type { TranslationKey } from '@/i18n';

export type CategoryViewProps = {
  guides: GuideMeta[];
  lang: Lang;
  t: Record<TranslationKey, string>;
};

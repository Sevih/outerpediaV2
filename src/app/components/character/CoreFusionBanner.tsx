'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import CharacterPortrait from './CharacterPortrait';

export type CoreFusionLink = {
  id: string;
  slug: string;
  name: string;
  name_jp?: string;
  name_kr?: string;
  name_zh?: string;
  type: 'core-fusion' | 'original';
};

type Props = {
  link: CoreFusionLink;
};

export default function CoreFusionBanner({ link }: Props) {
  const { lang, t } = useI18n();
  const name = l(link, 'name', lang);
  const label = link.type === 'core-fusion'
    ? t('page.character.core_fusion.available')
    : t('page.character.core_fusion.original');

  return (
    <Link
      href={`/${lang}/characters/${link.slug}`}
      className="group flex items-center gap-4 rounded-lg border border-purple-500/30 bg-purple-950/20 px-4 py-3 transition-colors hover:border-purple-400/50 hover:bg-purple-950/30"
    >
      <CharacterPortrait id={link.id} size="sm" showIcons />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-purple-300">{label}</p>
        <p className="truncate text-sm text-zinc-300">{name}</p>
      </div>
      <svg
        className="h-5 w-5 shrink-0 text-purple-400 transition-transform group-hover:translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/contexts/I18nContext';
import { useBreadcrumbLabel } from '@/lib/contexts/BreadcrumbContext';
import type { TranslationKey } from '@/i18n';

const SEGMENT_LABELS: Record<string, TranslationKey> = {
  characters: 'nav.characters',
  equipments: 'nav.equipment',
  guides: 'nav.guides',
  tierlist: 'nav.tierlist',
  tools: 'nav.utilities',
  changelog: 'home.section.updates',
  'promo-codes': 'page.promo_codes.title',
  contributors: 'page.contributors.title',
  legal: 'page.legal.title',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const { lang, t, href: buildHref } = useI18n();
  const breadcrumbOverride = useBreadcrumbLabel();

  // Remove lang prefix, split into segments
  const stripped = pathname.replace(`/${lang}`, '') || '/';
  if (stripped === '/') return null;

  const segments = stripped.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-4 md:px-6">
      <ol className="flex items-center gap-1.5 text-xs text-zinc-500">
        <li>
          <Link href={buildHref('/')} className="hover:text-zinc-300">
            {t('nav.home')}
          </Link>
        </li>
        {segments.map((segment, i) => {
          const href = buildHref(`/${segments.slice(0, i + 1).join('/')}`);
          const isLast = i === segments.length - 1;
          const labelKey = SEGMENT_LABELS[segment];
          // Guide category segments: try guides.category.{slug} key
          const guideCatKey = segments[i - 1] === 'guides'
            ? `guides.category.${segment}` as TranslationKey
            : undefined;
          const label = isLast && breadcrumbOverride
            ? breadcrumbOverride
            : labelKey ? t(labelKey)
            : guideCatKey && t(guideCatKey) !== guideCatKey ? t(guideCatKey)
            : decodeURIComponent(segment);

          return (
            <li key={href} className="flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              {isLast ? (
                <span className="text-zinc-300">{label}</span>
              ) : (
                <Link href={href as never} className="hover:text-zinc-300">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

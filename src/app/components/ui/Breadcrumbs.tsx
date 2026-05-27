'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/contexts/I18nContext';
import { useBreadcrumbLabel } from '@/lib/contexts/BreadcrumbContext';
import { buildBreadcrumbJsonLd, buildUrl } from '@/lib/seo';
import JsonLd from '@/app/components/seo/JsonLd';
import type { Lang } from '@/lib/i18n/config';
import type { TranslationKey } from '@/i18n';

const SEGMENT_LABELS: Record<string, TranslationKey> = {
  characters: 'nav.characters',
  equipment: 'nav.equipment',
  guides: 'nav.guides',
  tierlist: 'nav.tierlist',
  tools: 'nav.utilities',
  changelog: 'home.section.updates',
  coupons: 'page.coupons.title',
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

  const items = segments.map((segment, i) => {
    const path = `/${segments.slice(0, i + 1).join('/')}`;
    const isLast = i === segments.length - 1;
    const labelKey = SEGMENT_LABELS[segment];
    const guideCatKey = segments[i - 1] === 'guides'
      ? `guides.category.${segment}` as TranslationKey
      : undefined;
    // `authoritative` = label came from a translation key, not a raw slug fallback.
    // The client-side override from BreadcrumbSetter isn't present at SSR, so we
    // don't treat it as authoritative for JSON-LD purposes — detail pages that
    // need a proper last-segment name emit their own BreadcrumbList server-side.
    let label: string;
    let authoritative = true;
    if (isLast && breadcrumbOverride) {
      label = breadcrumbOverride;
    } else if (labelKey) {
      label = t(labelKey);
    } else if (guideCatKey && t(guideCatKey) !== guideCatKey) {
      label = t(guideCatKey);
    } else {
      label = decodeURIComponent(segment);
      authoritative = false;
    }
    return { path, href: buildHref(path), label, isLast, authoritative };
  });

  const allAuthoritative = items.every((item) => item.authoritative);
  const jsonLd = allAuthoritative
    ? buildBreadcrumbJsonLd([
        { name: t('nav.home'), url: buildUrl(lang as Lang, '/') },
        ...items.map(({ path, label }) => ({ name: label, url: buildUrl(lang as Lang, path) })),
      ])
    : null;

  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-4 md:px-6">
      {jsonLd && <JsonLd data={jsonLd} />}
      <ol className="flex items-center gap-1.5 text-xs text-zinc-500">
        <li>
          <Link href={buildHref('/')} className="hover:text-zinc-300">
            {t('nav.home')}
          </Link>
        </li>
        {items.map(({ href, label, isLast }) => (
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
        ))}
      </ol>
    </nav>
  );
}

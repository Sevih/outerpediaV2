'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { EVENTS } from '@/app/[lang]/tools/_contents/event/events';

export default function EventBanner() {
  const { lang, href, t } = useI18n();

  const ongoing = EVENTS.filter(e => e.status === 'ongoing');
  const upcoming = EVENTS.filter(e => e.status === 'upcoming');
  if (ongoing.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="border-b border-cyan-400/20 bg-cyan-950/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-4 py-1.5">
        {ongoing.map(event => (
          <Link
            key={event.meta.slug}
            href={`${href('/event')}#${event.meta.slug}`}
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <Image
              src="/images/ui/nav/event.gif"
              alt="Event"
              width={80}
              height={24}
              className="h-6 w-auto"
              unoptimized
            />
            <span className="text-sm font-medium text-cyan-200">{event.meta.title[lang]}</span>
          </Link>
        ))}
        {upcoming.map(event => (
          <Link
            key={event.meta.slug}
            href={`${href('/event')}#${event.meta.slug}`}
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-300">{t('tools.event.status.upcoming')}</span>
            <span className="text-sm font-medium text-amber-200/80">{t(`tools.event.type.${event.meta.type}` as Parameters<typeof t>[0])}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

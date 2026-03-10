'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { EVENTS } from '@/app/[lang]/tools/_contents/event/events';

export default function EventBanner() {
  const { lang, href } = useI18n();

  const active = EVENTS.filter(e => e.status === 'ongoing');
  if (active.length === 0) return null;

  return (
    <div className="border-b border-cyan-400/20 bg-cyan-950/40">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-4 px-4 py-1.5">
        {active.map(event => (
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
      </div>
    </div>
  );
}

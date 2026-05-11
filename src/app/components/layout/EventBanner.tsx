'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { EVENTS } from '@/app/[lang]/tools/_contents/event/events';
import type { EventMeta } from '@/app/[lang]/tools/_contents/event/types';
import type { Lang } from '@/lib/i18n/config';

function formatDeadline(endStr: string, lang: Lang): string {
  const date = new Date(endStr);
  const localeMap: Record<Lang, string> = { en: 'en-US', jp: 'ja-JP', kr: 'ko-KR', zh: 'zh-CN', fr: 'fr-FR' };
  const datePart = date.toLocaleDateString(localeMap[lang], {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${datePart} ${hh}:${mm} UTC`;
}

function getCurrentPhaseLabel(meta: EventMeta, lang: Lang): string | null {
  if (!meta.phases || meta.phases.length === 0) return null;
  const now = Date.now();
  const current = meta.phases.find(p => now < new Date(p.until).getTime());
  return current ? (current.label[lang] ?? current.label.en ?? null) : null;
}

export default function EventBanner() {
  const { lang, href, t } = useI18n();

  const ongoing = EVENTS.filter(e => e.status === 'ongoing');
  const upcoming = EVENTS.filter(e => e.status === 'upcoming');
  if (ongoing.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="border-b border-cyan-400/20 bg-cyan-950/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-1.5">
        {ongoing.map(event => {
          const phaseLabel = getCurrentPhaseLabel(event.meta, lang);
          return (
            <Link
              key={event.meta.slug}
              href={`${href('/event')}#${event.meta.slug}`}
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 transition-opacity hover:opacity-80"
            >
              <Image
                src="/images/ui/nav/event.gif"
                alt="Event"
                width={80}
                height={24}
                className="h-6 w-auto"
                unoptimized
              />
              <span className="text-sm font-medium text-cyan-200">{event.meta.title[lang] ?? event.meta.title.en}</span>
              <span className="text-xs text-cyan-300/70">
                · {phaseLabel ?? `${t('tools.event.ends')} ${formatDeadline(event.meta.end, lang)}`}
              </span>
            </Link>
          );
        })}
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

'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/contexts/I18nContext';
import { TextFilterGroup } from '@/app/components/ui/FilterPills';
import { EVENTS } from './events';
import type { EventType, EventStatus } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === 'development';

const EVENT_TYPES: EventType[] = ['tournament', 'contest', 'community'];
const VISIBLE_STATUSES: EventStatus[] = ['ongoing', 'upcoming', 'ended'];

const TYPE_COLORS: Record<EventType, string> = {
  tournament: 'bg-red-500/20 text-red-300 border-red-500/30',
  contest: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  community: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
};

const STATUS_COLORS: Record<EventStatus, string> = {
  ongoing: 'bg-green-500/20 text-green-300 border-green-500/30',
  upcoming: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  ended: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  hidden: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  const localeMap: Record<string, string> = { en: 'en-US', jp: 'ja-JP', kr: 'ko-KR', zh: 'zh-CN' };
  return date.toLocaleDateString(localeMap[lang] || 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventTool() {
  const { lang, t } = useI18n();
  const [typeFilter, setTypeFilter] = useState<EventType[]>([]);
  const [statusFilter, setStatusFilter] = useState<EventStatus[]>([]);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Auto-expand event from URL hash (e.g. /event#20260201-video)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) setExpandedSlug(decodeURIComponent(hash));
  }, []);

  const events = useMemo(() => {
    // Filter out hidden events in production
    let list = EVENTS.filter(e => isDev || e.status !== 'hidden');

    if (typeFilter.length > 0) {
      list = list.filter(e => typeFilter.includes(e.meta.type));
    }
    if (statusFilter.length > 0) {
      list = list.filter(e => statusFilter.includes(e.status));
    }

    // Sort: ongoing first, then upcoming, then ended, then hidden
    const statusOrder: Record<EventStatus, number> = { ongoing: 0, upcoming: 1, ended: 2, hidden: 3 };
    list.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return list;
  }, [typeFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-8">
        <TextFilterGroup
          label={t('tools.event.filter.type')}
          items={[
            { name: t('common.all'), value: null },
            ...EVENT_TYPES.map(type => ({
              name: t(`tools.event.type.${type}` as Parameters<typeof t>[0]),
              value: type,
            })),
          ]}
          filter={typeFilter}
          onToggle={(v) => { setTypeFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]); }}
          onReset={() => setTypeFilter([])}
        />
        <TextFilterGroup
          label={t('tools.event.filter.status')}
          items={[
            { name: t('common.all'), value: null },
            ...VISIBLE_STATUSES.map(status => ({
              name: t(`tools.event.status.${status}` as Parameters<typeof t>[0]),
              value: status,
            })),
          ]}
          filter={statusFilter}
          onToggle={(v) => { setStatusFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]); }}
          onReset={() => setStatusFilter([])}
        />
      </div>

      {/* Event list */}
      <div className="space-y-3">
        {events.map(({ meta, Page, status }) => {
          const isExpanded = expandedSlug === meta.slug;
          const isUpcoming = status === 'upcoming';
          const displayTitle = isUpcoming ? t('tools.event.status.upcoming') + ' — ' + t(`tools.event.type.${meta.type}` as Parameters<typeof t>[0]) : meta.title[lang];

          return (
            <article
              key={meta.slug}
              className={`rounded-lg border bg-zinc-800/50 ${status === 'ended' ? 'border-zinc-700/30 opacity-60' : status === 'hidden' ? 'border-pink-500/20 border-dashed' : 'border-zinc-700/50'}`}
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => setExpandedSlug(prev => (prev === meta.slug ? null : meta.slug))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-700/30"
              >
                {/* Status badge */}
                <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
                  {t(`tools.event.status.${status}` as Parameters<typeof t>[0])}
                </span>

                {/* Type badge */}
                <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[meta.type]}`}>
                  {t(`tools.event.type.${meta.type}` as Parameters<typeof t>[0])}
                </span>

                {/* Title */}
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                  {displayTitle}
                </span>

                {/* Date range */}
                <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">
                  {formatDate(meta.start, lang)} — {formatDate(meta.end, lang)}
                </span>

                {/* Expand icon */}
                <svg
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content — renders the event's rich Page component */}
              {isExpanded && (
                <div className="border-t border-zinc-700/50 px-4 py-6 space-y-6 text-left">
                  {/* Auto header from meta */}
                  <header className="space-y-4 text-center">
                    <h2 className="mx-auto text-3xl font-extrabold tracking-tight text-zinc-100">
                      {displayTitle}
                    </h2>

                    {meta.cover && !isUpcoming && (
                      <div className="relative mx-auto h-48 w-full max-w-md">
                        <Image
                          src={meta.cover}
                          alt={meta.title[lang]}
                          fill
                          sizes="(max-width: 768px) 100vw, 448px"
                          className="rounded-lg object-contain"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-400">
                      <span>
                        {formatDate(meta.start, lang)} — {formatDate(meta.end, lang)}
                      </span>
                      {meta.organizer && (
                        <span>
                          {t('tools.event.organizer')}: <span className="text-zinc-200">{meta.organizer}</span>
                        </span>
                      )}
                    </div>
                  </header>

                  {/* Rich content or upcoming placeholder */}
                  {isUpcoming ? (
                    <div className="relative h-64 overflow-hidden rounded-lg">
                      {meta.cover && (
                        <>
                          <Image
                            src={meta.cover}
                            alt=""
                            fill
                            sizes="100vw"
                            className="object-cover blur-xl scale-110"
                          />
                          <div className="absolute inset-0 bg-zinc-900/60" />
                        </>
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <p className="text-center text-lg font-medium text-zinc-300">
                          {t('tools.event.upcoming_placeholder')}
                        </p>
                        <Image
                          src="/images/ui/hide.webp"
                          alt=""
                          width={300}
                          height={300}
                          className="opacity-60"
                        />
                      </div>
                    </div>
                  ) : (
                    <Page />
                  )}
                </div>
              )}
            </article>
          );
        })}

        {events.length === 0 && (
          <p className="py-12 text-center text-zinc-500">{t('tools.event.empty')}</p>
        )}
      </div>
    </div>
  );
}

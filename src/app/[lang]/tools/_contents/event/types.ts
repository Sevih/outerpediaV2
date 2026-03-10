import type React from 'react';
import type { Lang } from '@/lib/i18n/config';

export type EventType = 'tournament' | 'contest' | 'community';
export type EventStatus = 'upcoming' | 'ongoing' | 'ended' | 'hidden';

/** Per-language string record used for translatable event fields. */
export type LangString = Record<Lang, string>;

export type EventMeta = {
  slug: string;
  title: LangString;
  cover?: string;
  type: EventType;
  organizer: string;
  start: string;
  end: string;
};

export type EventDef = {
  meta: EventMeta;
  Page: React.FC;
};

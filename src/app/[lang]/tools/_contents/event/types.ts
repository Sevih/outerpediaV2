import type React from 'react';
import type { Lang } from '@/lib/i18n/config';

export type EventType = 'tournament' | 'contest' | 'community';
export type EventStatus = 'upcoming' | 'ongoing' | 'ended' | 'hidden';

/**
 * Per-language string record used for translatable event fields.
 * Partial because community-translated languages (e.g. fr) are not required
 * for every event — consumers must fall back to `.en` when a value is missing.
 */
export type LangString = Partial<Record<Lang, string>>;

export type EventPhase = {
  until: string;
  label: LangString;
};

export type EventMeta = {
  slug: string;
  title: LangString;
  cover?: string;
  type: EventType;
  organizer: string;
  start: string;
  end: string;
  phases?: EventPhase[];
};

export type EventDef = {
  meta: EventMeta;
  Page: React.FC;
};

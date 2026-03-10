import type React from 'react';

export type EventType = 'tournament' | 'contest' | 'community';
export type EventStatus = 'upcoming' | 'ongoing' | 'ended' | 'hidden';

export type EventMeta = {
  slug: string;
  title: string;
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

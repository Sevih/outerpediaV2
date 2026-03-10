import type { EventStatus } from '../types';

// Map event slug → status. Add new entries here when creating events.
// Events not listed here default to 'hidden'.
const EVENT_STATUS: Record<string, EventStatus> = {
  '20260201-video': 'hidden',
  '_no-peaking': 'ongoing',
};

export default EVENT_STATUS;

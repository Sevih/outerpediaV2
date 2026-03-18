// Slugs listed here are forced to 'hidden' regardless of their dates.
// All other events derive their status automatically from meta.start / meta.end.
const HIDDEN_EVENTS: string[] = [
  '_no-peaking',
];

export default HIDDEN_EVENTS;

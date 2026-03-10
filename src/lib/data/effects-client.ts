import type { Effect } from '@/types/effect';

function buildMap(arr: Effect[]): Record<string, Effect> {
  const map: Record<string, Effect> = {};
  for (const e of arr) map[e.name] = e;
  return map;
}

export const effectMapsPromise = Promise.all([
  import('@data/effects/buffs.json').then(m => buildMap(m.default as Effect[])),
  import('@data/effects/debuffs.json').then(m => buildMap(m.default as Effect[])),
]).then(([buffMap, debuffMap]) => ({ buffMap, debuffMap }));

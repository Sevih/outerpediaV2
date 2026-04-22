'use client';

import { use } from 'react';
import type { ThemeJson, RouteJson } from '@/lib/monad/loadRoute';
import type { Item } from '@/types/item';
import ItemInline from '@/app/components/inline/ItemInline';
import { useI18n } from '@/lib/contexts/I18nContext';

// Shared items registry — lazily loaded and shared across renders.
const itemsPromise = import('@data/items.json').then((m) => m.default as Item[]);

interface Props {
  route: RouteJson;
  theme: ThemeJson;
}

interface Aggregated {
  items: Map<string, { name: string; min: number; max: number }>
  gold: number
  crystal: number
}

function emptyAgg(): Aggregated {
  return { items: new Map(), gold: 0, crystal: 0 }
}

function aggregate(
  rewardIds: Iterable<string>,
  theme: ThemeJson,
  items: Item[],
): Aggregated {
  const out = emptyAgg()
  for (const rid of rewardIds) {
    const rew = theme.rewards[rid]
    if (!rew) continue
    if (rew.gold) out.gold += rew.gold.min
    if (rew.crystal) out.crystal += rew.crystal.min
    for (const it of rew.items) {
      if (it.type !== 'RIT_ITEM') continue
      const item = items.find((x) => x.id === it.typeId)
      if (!item) continue
      const existing = out.items.get(it.typeId)
      if (existing) {
        existing.min += it.min
        existing.max += it.max
      } else {
        out.items.set(it.typeId, { name: item.name, min: it.min, max: it.max })
      }
    }
  }
  return out
}

function isEmpty(a: Aggregated): boolean {
  return a.items.size === 0 && a.gold === 0 && a.crystal === 0
}

function RewardRow({ agg }: { agg: Aggregated }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {Array.from(agg.items.values()).map((r) => (
        <div key={r.name} className="flex items-center gap-2">
          <ItemInline name={r.name} />
          <span className="text-zinc-400">x{r.min === r.max ? r.min : `${r.min}-${r.max}`}</span>
        </div>
      ))}
      {agg.crystal > 0 && (
        <div className="flex items-center gap-2">
          <ItemInline name="Free Ether" />
          <span className="text-zinc-400">x{agg.crystal}</span>
        </div>
      )}
      {agg.gold > 0 && (
        <div className="flex items-center gap-2">
          <ItemInline name="Gold" />
          <span className="text-zinc-400">x{agg.gold}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Displays the route rewards — split between per-clear reward (nodes of type `final`, boss)
 * and first-clear bonus (nodes of type `tending`, True Ending). Falls back silently when
 * nothing is defined.
 */
export default function MonadRouteReward({ route, theme }: Props) {
  const { t } = useI18n();
  const items = use(itemsPromise);

  const clearRewardIds = new Set<string>();
  const firstClearRewardIds = new Set<string>();
  for (const n of route.nodes) {
    if (n.type === 'final' && n.rewardId) clearRewardIds.add(n.rewardId);
    if (n.type === 'tending' && n.firstClearRewardId) firstClearRewardIds.add(n.firstClearRewardId);
  }

  const clear = aggregate(clearRewardIds, theme, items);
  const firstClear = aggregate(firstClearRewardIds, theme, items);

  if (isEmpty(clear) && isEmpty(firstClear)) return null;

  return (
    <div className="mt-6 space-y-4">
      {!isEmpty(clear) && (
        <div>
          <h2 className="text-lg font-semibold mb-2">{t('monad.rewards')}</h2>
          <RewardRow agg={clear} />
        </div>
      )}
      {!isEmpty(firstClear) && (
        <div>
          <h3 className="text-sm font-semibold text-emerald-300 mb-2">
            {t('monad.rewards.firstClear')}
          </h3>
          <RewardRow agg={firstClear} />
        </div>
      )}
    </div>
  );
}

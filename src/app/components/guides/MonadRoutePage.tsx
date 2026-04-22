'use client';

import { useEffect, useMemo, useState } from 'react';
import theme from '@data/monad/generated/theme-1.json';
import { loadRoute, type RouteJson, type ThemeJson } from '@/lib/monad/loadRoute';
import MonadGateMap from './MonadGateMap';
import MonadRouteReward from './MonadRouteReward';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { TranslationKey } from '@/i18n/locales/en';

export interface RouteVariant {
  label: string;
  route: RouteJson;
}

interface Props {
  /** A single route, or a list of variants rendered as tabs (used for D10 where a route has
   *  two map layouts). Variants must share the same reward pool (same theme). */
  route: RouteJson | RouteVariant[];
  titleKey: TranslationKey;
}

/**
 * Shared wrapper for every Monad Gate route page. Combines the reward header and the map,
 * both driven by the generated theme-1.json + routes/{groupId}.json.
 */
export default function MonadRoutePage({ route, titleKey }: Props) {
  const { lang } = useI18n();
  const typedTheme = theme as unknown as ThemeJson;
  const variants: RouteVariant[] = Array.isArray(route)
    ? route
    : [{ label: '', route }];
  const [active, setActive] = useState(0);
  // Pick the initial tab from `?v=<index>` so list cards that deep-link to a specific variant
  // open on the right map. Read from window to avoid pulling useSearchParams (which forces
  // the page into a Suspense boundary).
  useEffect(() => {
    if (variants.length < 2) return;
    const raw = new URLSearchParams(window.location.search).get('v');
    if (raw === null) return;
    const idx = parseInt(raw, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < variants.length) setActive(idx);
  }, [variants.length]);
  const current = variants[active] ?? variants[0];
  const { nodes, edges } = useMemo(
    () => loadRoute(current.route, typedTheme, lang),
    [current.route, typedTheme, lang],
  );

  return (
    <div className="space-y-4">
      <MonadRouteReward route={current.route} theme={typedTheme} />
      {variants.length > 1 && (
        <div className="flex gap-2">
          {variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`px-3 py-1.5 rounded border text-sm font-medium transition ${
                active === i
                  ? 'bg-yellow-400 text-black border-yellow-400'
                  : 'bg-zinc-800 text-zinc-200 border-zinc-600 hover:border-zinc-400'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <MonadGateMap
        key={active}
        nodes={nodes}
        edges={edges}
        titleKey={titleKey}
      />
    </div>
  );
}

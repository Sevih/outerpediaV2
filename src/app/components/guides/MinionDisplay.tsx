'use client';

import { useEffect, useState, useCallback } from 'react';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import { BossHeader, BossDetails, buffMap, debuffMap, bossCache } from '@/app/components/guides/BossDisplay';
import { useI18n } from '@/lib/contexts/I18nContext';
import bossIndex from '@data/generated/boss-index.json';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

/* ── Types ──────────────────────────────────────────────── */

type BossVersion = {
  id: string;
  label: LangMap;
  level?: number;
};

type BossIndexEntry = {
  modes: Record<string, { name: LangMap; versions: BossVersion[] }>;
};

type Props = {
  bossName: string;
  modeKey?: string;
  versionIndex: number;
  defaultBossId?: string;
  preloadedBosses?: Record<string, Boss>;
};

/* ── Main component ─────────────────────────────────────── */

export default function MinionDisplay({ bossName, modeKey, versionIndex, defaultBossId, preloadedBosses }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;

  // Resolve versions from boss-index
  const entry = (bossIndex as Record<string, BossIndexEntry>)[bossName];
  const modes = entry?.modes ?? {};
  const modeData = modeKey ? modes[modeKey] : Object.values(modes)[0];
  const versions = modeData?.versions ?? [];

  // Clamp version index to available range
  const clampedIndex = Math.min(versionIndex, versions.length - 1);
  const selectedId = versions[clampedIndex]?.id ?? defaultBossId;

  const preloadedBoss = preloadedBosses?.[selectedId] ?? null;
  const [boss, setBoss] = useState<Boss | null>(preloadedBoss);
  const [loading, setLoading] = useState(!preloadedBoss);

  const loadBoss = useCallback(async (id: string): Promise<Boss | null> => {
    if (preloadedBosses?.[id]) return preloadedBosses[id];
    const cached = bossCache.get(id);
    if (cached) return cached;
    try {
      const mod = await import(`@data/boss/${id}.json`);
      const data = (mod.default ?? mod) as Boss;
      bossCache.set(id, data);
      return data;
    } catch {
      return null;
    }
  }, [preloadedBosses]);

  useEffect(() => {
    if (!selectedId) return;

    const preloaded = preloadedBosses?.[selectedId] ?? null;
    if (preloaded) {
      setBoss(preloaded);
      setLoading(false);
      return;
    }

    setLoading(true);
    loadBoss(selectedId).then((b) => {
      setBoss(b);
      setLoading(false);
    });
  }, [selectedId, loadBoss, preloadedBosses]);

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading...</div>
        ) : boss ? (
          <>
            <BossHeader boss={boss} lang={lang} />
            <BossDetails boss={boss} lang={lang} />
          </>
        ) : (
          <div className="py-8 text-center text-sm text-zinc-500">No boss data</div>
        )}
      </div>
    </EffectsProvider>
  );
}

'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import { BossHeader, BossDetails, bossCache } from '@/app/components/guides/BossDisplay';
import { effectMapsPromise } from '@/lib/data/effects-client';
import { useI18n } from '@/lib/contexts/I18nContext';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

const bossIndexPromise = import('@data/generated/boss-index.json').then(m => m.default as Record<string, BossIndexEntry>);

/* ── Types ──────────────────────────────────────────────── */

type BossVersion = {
  id: string;
  label: LangMap;
  level?: number;
};

type BossIndexEntry = {
  modes: Record<string, { name: LangMap; versions: BossVersion[] }>;
};

type EntryDef = {
  bossName: string;
  modeKey?: string;
  versionIndex: number;
  defaultBossId?: string;
  preloadedBosses?: Record<string, Boss>;
};

type Props =
  | (EntryDef & { entries?: never })
  | { entries: EntryDef[]; bossName?: never; modeKey?: never; versionIndex?: never; defaultBossId?: never; preloadedBosses?: never };

/* ── Single minion card ──────────────────────────────────── */

function MinionCard({ bossName, modeKey, versionIndex, defaultBossId, preloadedBosses }: EntryDef) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;
  const bossIdx = use(bossIndexPromise);

  const entry = bossIdx[bossName];
  const modes = entry?.modes ?? {};
  const modeData = modeKey ? modes[modeKey] : Object.values(modes)[0];
  const versions = modeData?.versions ?? [];

  const clampedIndex = Math.min(versionIndex, versions.length - 1);
  const selectedId = defaultBossId ?? versions[clampedIndex]?.id;

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
  );
}

/* ── Main component ─────────────────────────────────────── */

export default function MinionDisplay(props: Props) {
  const { buffMap, debuffMap } = use(effectMapsPromise);
  const entries: EntryDef[] = 'entries' in props && props.entries
    ? props.entries
    : [props as EntryDef];

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className={entries.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : undefined}>
        {entries.map((entry, i) => (
          <MinionCard key={i} {...entry} />
        ))}
      </div>
    </EffectsProvider>
  );
}

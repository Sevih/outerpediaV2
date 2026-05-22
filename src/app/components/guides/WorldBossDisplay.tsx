'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import Tabs from '@/app/components/ui/Tabs';
import BuffDebuffDisplay, { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { ELEMENT_TEXT } from '@/lib/theme';
import { effectMapsPromise } from '@/lib/data/effects-client';
import { formatBossDesc, ImmuneList } from '@/app/components/guides/boss-shared';
import type { Boss, BossSkill } from '@/types/boss';
import type { ElementType } from '@/types/enums';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';
import type { WorldBossMode, WorldBossConfig } from '@/types/world-boss';

type Props = {
  config: WorldBossConfig;
  defaultMode?: WorldBossMode;
  /** Pre-loaded boss data keyed by ID — rendered at SSR time (no loading state) */
  preloadedBosses?: Record<string, Boss>;
  /** Suffix appended to the boss JSON filename (e.g. "-1" for legacy snapshots).
   *  Mode IDs in `config` stay as the bare current ids. */
  bossFileSuffix?: string;
};

const ALL_MODES: WorldBossMode[] = ['Normal', 'Hard', 'Very Hard', 'Extreme'];

const bossCache = new Map<string, Boss>();

function SkillCard({ skill, lang }: { skill: BossSkill; lang: Lang }) {
  const name = lRec(skill.name as LangMap, lang);
  const desc = lRec(skill.description as LangMap, lang);
  if (!name || !desc) return null;

  const isPassive = skill.type.startsWith('SKT_MONSTER');

  return (
    <div className={`p-3 ${isPassive ? 'panel-highlight' : 'card'}`}>
      <div className="flex items-start gap-2">
        <span className="relative h-8 w-8 shrink-0 rounded">
          <Image
            src={`/images/characters/${(skill.icon.split('_').pop() ?? '').startsWith('2') ? '' : 'boss/'}skills/${skill.icon}.webp`}
            alt={name}
            fill
            sizes="32px"
            className="object-contain"
          />
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-zinc-200">{name}</p>
          {(skill.buff?.length || skill.debuff?.length) && (
            <BuffDebuffDisplay buffs={skill.buff ?? []} debuffs={skill.debuff ?? []} />
          )}
          {desc && (
            <p className="text-xs leading-relaxed text-zinc-400">
              {formatBossDesc(desc, lang)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BossCard({ boss, lang }: { boss: Boss; lang: Lang }) {
  const name = lRec(boss.Name, lang);
  const element = boss.element as ElementType;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="card flex items-center gap-3 p-3">
        {boss.icons.startsWith('2') ? (
          <CharacterPortrait id={boss.icons} size="md" name={name} />
        ) : (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
            <Image
              src={`/images/characters/boss/portrait/MT_${boss.icons}.webp`}
              alt={name}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <div>
            <p className="text-base font-bold text-zinc-100">{name}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="relative h-4 w-4">
                  <Image
                    src={`/images/ui/elem/CM_Element_${element}.webp`}
                    alt={element}
                    fill
                    sizes="16px"
                    className="object-contain"
                  />
                </span>
                <span className={`text-xs ${ELEMENT_TEXT[element]}`}>{element}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="relative h-4 w-4">
                  <Image
                    src={`/images/ui/class/CM_Class_${boss.class}.webp`}
                    alt={boss.class}
                    fill
                    sizes="16px"
                    className="object-contain"
                  />
                </span>
                <span className="text-xs text-zinc-400">{boss.class}</span>
              </span>
              <span className="text-xs text-zinc-500">Lv.{boss.level}</span>
            </div>
          </div>
          <ImmuneList immuneStr={boss.BuffImmune} statImmuneStr={boss.StatBuffImmune} />
        </div>
      </div>

      {/* Skills */}
      {boss.skills
        .filter((s) => lRec(s.name as LangMap, lang) && lRec(s.description as LangMap, lang))
        .map((skill, i) => (
          <SkillCard key={i} skill={skill} lang={lang} />
        ))}
    </div>
  );
}

export default function WorldBossDisplay({ config, defaultMode = 'Extreme', preloadedBosses, bossFileSuffix = '' }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;
  const { buffMap, debuffMap } = use(effectMapsPromise);
  const [mode, setMode] = useState<WorldBossMode>(defaultMode);

  // Resolve preloaded bosses for default mode (available at SSR time)
  const preloadedBoss1 = preloadedBosses?.[config.boss1Ids[defaultMode] ?? ''] ?? null;
  const preloadedBoss2 = preloadedBosses?.[config.boss2Ids[defaultMode] ?? ''] ?? null;

  const [boss1, setBoss1] = useState<Boss | null>(preloadedBoss1);
  const [boss2, setBoss2] = useState<Boss | null>(preloadedBoss2);
  const [loading, setLoading] = useState(!preloadedBoss1 && !preloadedBoss2);

  // Determine which modes are available
  const availableModes = ALL_MODES.filter(
    (m) => config.boss1Ids[m] || config.boss2Ids[m]
  );

  const loadBoss = useCallback(async (id: string | undefined): Promise<Boss | null> => {
    if (!id) return null;
    // Check preloaded data first
    if (preloadedBosses?.[id]) return preloadedBosses[id];
    const cacheKey = `${id}${bossFileSuffix}`;
    const cached = bossCache.get(cacheKey);
    if (cached) return cached;
    try {
      const mod = await import(`@data/boss/${id}${bossFileSuffix}.json`);
      const data = (mod.default ?? mod) as Boss;
      bossCache.set(cacheKey, data);
      return data;
    } catch {
      return null;
    }
  }, [preloadedBosses, bossFileSuffix]);

  useEffect(() => {
    if (mode === defaultMode && (preloadedBoss1 || preloadedBoss2)) {
      setBoss1(preloadedBoss1);
      setBoss2(preloadedBoss2);
      return;
    }

    setLoading(true);
    Promise.all([
      loadBoss(config.boss1Ids[mode]),
      loadBoss(config.boss2Ids[mode]),
    ]).then(([b1, b2]) => {
      setBoss1(b1);
      setBoss2(b2);
      setLoading(false);
    });
  }, [mode, config, loadBoss, defaultMode, preloadedBoss1, preloadedBoss2]);

  const activeBosses = [boss1, boss2].filter(Boolean) as Boss[];

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-4">
        {availableModes.length > 1 && (
          <Tabs
            items={availableModes}
            value={mode}
            onChange={(v) => setMode(v as WorldBossMode)}
          />
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading...</div>
        ) : activeBosses.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">No boss data</div>
        ) : (
          <div className={`grid gap-4 ${activeBosses.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {activeBosses.map((boss) => (
              <BossCard key={boss.id} boss={boss} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </EffectsProvider>
  );
}

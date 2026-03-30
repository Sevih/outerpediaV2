'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import BossPortrait from '@/app/components/guides/BossPortrait';
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

type Props = {
  bossName: string;
  modeKey?: string;
  defaultBossId?: string;
  preloadedBosses?: Record<string, Boss>;
  versionIds?: string[];
  onVersionChange?: (index: number) => void;
  onBossIdChange?: (id: string) => void;
};

/* ── Sub-components ─────────────────────────────────────── */

export function SkillCard({ skill, lang }: { skill: BossSkill; lang: Lang }) {
  const name = lRec(skill.name as LangMap, lang);
  const desc = lRec(skill.description as LangMap, lang);
  if (!name || !desc) return null;

  return (
    <div className="card p-3">
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
            <BuffDebuffDisplay
              buffs={Array.isArray(skill.buff) ? skill.buff : skill.buff ? [skill.buff] : []}
              debuffs={Array.isArray(skill.debuff) ? skill.debuff : skill.debuff ? [skill.debuff] : []}
              keepInterruptions
            />
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

export function BossHeader({ boss, lang }: { boss: Boss; lang: Lang }) {
  const baseName = lRec(boss.Name, lang);
  const surname = lRec(boss.Surname as LangMap, lang);
  const displayName = boss.IncludeSurname && surname ? `${surname} ${baseName}` : baseName;
  const element = boss.element as ElementType;

  return (
    <div className="flex items-center gap-3 p-3">
      <BossPortrait icons={boss.icons} name={displayName} size="md" />
      <div>
        {!boss.IncludeSurname && surname && (
          <p className="text-xs text-zinc-400">{surname}</p>
        )}
        <p className="text-lg font-bold text-zinc-100">{displayName}</p>
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
    </div>
  );
}

export function BossDetails({ boss, lang }: { boss: Boss; lang: Lang }) {
  return (
    <div className="space-y-2">
      <ImmuneList immuneStr={boss.BuffImmune} statImmuneStr={boss.StatBuffImmune} />
      {boss.skills
        .filter((s) => lRec(s.name as LangMap, lang) && lRec(s.description as LangMap, lang))
        .map((skill, i) => (
          <SkillCard key={i} skill={skill} lang={lang} />
        ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

export const bossCache = new Map<string, Boss>();

export default function BossDisplay({ bossName, modeKey, defaultBossId, preloadedBosses, versionIds, onVersionChange, onBossIdChange }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;
  const { buffMap, debuffMap } = use(effectMapsPromise);
  const bossIdx = use(bossIndexPromise);

  // Resolve versions from boss-index
  const entry = bossIdx[bossName];
  const modes = entry?.modes ?? {};

  type VersionWithMode = BossVersion & { modeName?: LangMap };

  const versions: VersionWithMode[] = (() => {
    if (versionIds) {
      // Collect matching versions across all modes, enriched with mode name
      const idSet = new Set(versionIds);
      const seen = new Set<string>();
      const result: VersionWithMode[] = [];
      for (const mode of Object.values(modes)) {
        for (const v of mode.versions) {
          if (idSet.has(v.id) && !seen.has(v.id)) {
            seen.add(v.id);
            result.push({ ...v, modeName: mode.name });
          }
        }
      }
      return result;
    }
    const modeData = modeKey ? modes[modeKey] : Object.values(modes)[0];
    return modeData?.versions ?? [];
  })();

  const hasModeNames = versions.some((v) => v.modeName != null);
  const defaultId = defaultBossId ?? versions[0]?.id;
  const [selectedId, setSelectedId] = useState(defaultId);
  const selectedVersion = versions.find((v) => v.id === selectedId);

  const preloadedBoss = preloadedBosses?.[defaultId] ?? null;
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
    if (selectedId === defaultId && preloadedBoss) {
      setBoss(preloadedBoss);
      return;
    }

    setLoading(true);
    loadBoss(selectedId).then((b) => {
      setBoss(b);
      setLoading(false);
    });
  }, [selectedId, loadBoss, defaultId, preloadedBoss]);

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-4">
        {/* Boss identity header */}
        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading...</div>
        ) : boss ? (
          <>
            <BossHeader boss={boss} lang={lang} />

            {/* Stage selector — between header and details */}
            {versions.length > 1 && (
              <div className="space-y-1">
                <select
                  value={selectedId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedId(newId);
                    onBossIdChange?.(newId);
                    const idx = versions.findIndex((v) => v.id === newId);
                    if (idx !== -1) onVersionChange?.(idx);
                  }}
                  className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500 transition-colors"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {hasModeNames && v.modeName ? lRec(v.modeName, lang) : lRec(v.label, lang)}
                    </option>
                  ))}
                </select>

                {hasModeNames && selectedVersion && boss?.location && (
                  <p className="text-sm text-zinc-400">
                    {lRec(boss.location.area_id, lang)} : {lRec(boss.location.dungeon, lang)} ({lRec(boss.location.mode, lang)})
                  </p>
                )}
              </div>
            )}

            <BossDetails boss={boss} lang={lang} />
          </>
        ) : (
          <div className="py-8 text-center text-sm text-zinc-500">No boss data</div>
        )}
      </div>
    </EffectsProvider>
  );
}

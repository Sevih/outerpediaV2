'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import type { Character, BurnEffect } from '@/types/character';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import { useI18n } from '@/lib/contexts/I18nContext';

type Props = { character: Character };

const SKILL_ORDER = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const;

type BurstEntry = {
  skillName: string;
  skillIcon: string;
  level: number;
  cost: number;
  effect: string;
};

export default function BurstSection({ character }: Props) {
  const { lang, t } = useI18n();

  const bursts = useMemo<BurstEntry[]>(() => {
    const result: BurstEntry[] = [];
    for (const key of SKILL_ORDER) {
      const skill = character.skills[key];
      if (!skill?.burnEffect) continue;
      const skillName = l(skill, 'name', lang);
      for (const burn of Object.values(skill.burnEffect) as BurnEffect[]) {
        result.push({
          skillName,
          skillIcon: skill.IconName,
          level: burn.level,
          cost: burn.cost,
          effect: l(burn as unknown as Record<string, unknown>, 'effect', lang) as string,
        });
      }
    }
    return result;
  }, [character.skills, lang]);

  if (!bursts.length) return null;

  return (
    <section id="burst">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.burst')}</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {bursts.map((burst) => (
          <div key={`${burst.skillIcon}-${burst.level}`} className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-white/10 bg-zinc-800">
                <Image src={`/images/characters/skills/${burst.skillIcon}.webp`} alt={burst.skillName} fill sizes="32px" className="object-contain" />
              </div>
              <div className="min-w-0">
                <span className="text-xs text-zinc-400">{burst.skillName}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-amber-400">{t('page.character.skill.level')}{burst.level}</span>
                  <span className="text-zinc-500">{t('page.character.skill.burn_cost')}: {burst.cost}</span>
                </div>
              </div>
            </div>
            <div className="text-sm leading-relaxed text-zinc-200">{formatEffectText(burst.effect)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

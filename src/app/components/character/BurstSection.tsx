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
  offensive: boolean;
  target: string;
};

/** Group burst entries by parent skill */
type SkillBurstGroup = {
  skillName: string;
  skillIcon: string;
  bursts: BurstEntry[];
};

export default function BurstSection({ character }: Props) {
  const { lang, t } = useI18n();

  const groups = useMemo<SkillBurstGroup[]>(() => {
    const result: SkillBurstGroup[] = [];
    for (const key of SKILL_ORDER) {
      const skill = character.skills[key];
      if (!skill?.burnEffect) continue;
      const skillName = l(skill, 'name', lang);
      const bursts: BurstEntry[] = [];
      for (const burn of Object.values(skill.burnEffect) as BurnEffect[]) {
        bursts.push({
          skillName,
          skillIcon: skill.IconName,
          level: burn.level,
          cost: burn.cost,
          effect: l(burn as unknown as Record<string, unknown>, 'effect', lang) as string,
          offensive: burn.offensive,
          target: burn.target,
        });
      }
      if (bursts.length) {
        result.push({ skillName, skillIcon: skill.IconName, bursts });
      }
    }
    return result;
  }, [character.skills, lang]);

  if (!groups.length) return null;

  return (
    <section id="burst">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.burst')}</h2>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.skillIcon}>
            {/* Burst cards */}
            <div className="flex flex-wrap justify-center gap-4">
              {group.bursts.map((burst) => (
                <div
                  key={burst.level}
                  className="relative w-44 shrink-0"
                  style={{ aspectRatio: '220 / 310' }}
                >
                  {/* Card frame background */}
                  <Image
                    src={`/images/ui/skills/IG_Button_Burst_0${burst.level}.webp`}
                    alt={`Burst level ${burst.level}`}
                    fill
                    sizes="176px"
                    className="pointer-events-none object-contain"
                  />

                  {/* Cost circle — top-right */}
                  <div className="absolute top-[3%] right-[4%] flex h-7 w-7 items-center justify-center">
                    <span className="font-game text-xs font-bold text-white">{burst.cost}</span>
                  </div>

                  {/* Effect text — bottom area */}
                  <div className="absolute bottom-[5%] left-[5%] right-[10%] top-[48%] flex items-center overflow-y-auto px-1">
                    <div className="w-full text-center text-[10px] leading-tight text-zinc-200">
                      {formatEffectText(burst.effect)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

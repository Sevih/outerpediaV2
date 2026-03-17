'use client';

import { Fragment } from 'react';
import Image from 'next/image';
import type { Character } from '@/types/character';
import type { SkillPriority } from '@/types/character';
import type { SkillKey } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import ItemInline from '@/app/components/inline/ItemInline';
import SkillCard from './SkillCard';

type Props = { character: Character };

const SKILL_ORDER = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const;

const PRIORITY_SKILL_KEY: Record<keyof SkillPriority, SkillKey> = {
  First: 'SKT_FIRST',
  Second: 'SKT_SECOND',
  Ultimate: 'SKT_ULTIMATE',
};

/** Replace {material} placeholders with <ItemInline> components */
function renderWithMaterial(text: string, materialName: string) {
  const parts = text.split('{material}');
  return parts.flatMap((part, i) =>
    i < parts.length - 1
      ? [part, <ItemInline key={i} name={materialName} />]
      : [part]
  );
}

export default function SkillsSection({ character }: Props) {
  const { lang, t } = useI18n();
  const skills = SKILL_ORDER.map((key) => character.skills[key]).filter(Boolean);

  if (!skills.length) return null;

  const isCoreFusion = character.fusionType === 'core-fusion';
  const fusionInfo = isCoreFusion && character.costPerLevel
    ? (() => {
        const material = character.fusionRequirements?.material.id ?? 'Fusion-Type Core';
        const entries = Object.values(character.costPerLevel);
        const unlockCost = entries[0]?.nb ?? 300;
        const upgradeCost = entries.length > 1 ? entries[1].nb : 150;
        const upgradeCount = entries.length - 1;
        const totalCost = unlockCost + upgradeCost * upgradeCount;
        return { material, upgradeCost, unlockCost, totalCost };
      })()
    : null;

  // Build skill priority order for non-core-fusion characters
  const priorityOrder = !isCoreFusion && character.skill_priority
    ? (Object.entries(character.skill_priority) as [keyof SkillPriority, { prio: number }][])
        .filter(([, v]) => v?.prio != null)
        .sort((a, b) => a[1].prio - b[1].prio)
        .map(([key]) => {
          const skill = character.skills[PRIORITY_SKILL_KEY[key]];
          return {
            key,
            name: skill ? l(skill, 'name', lang) : key,
            icon: skill?.IconName ?? null,
          };
        })
    : null;

  return (
    <section id="skills">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.skills')}</h2>

      {priorityOrder && priorityOrder.length > 0 && (
        <div className="mb-6 max-w-2xl mx-auto">
          <div className="font-game text-lg font-bold">{t('page.character.skill.priority_title')}</div>
          <div className="flex flex-wrap items-start justify-center gap-3 text-sm">
            {priorityOrder.map(({ key, name, icon }, i) => (
              <Fragment key={key}>
                {i > 0 && (
                  <Image
                    src="/images/ui/nav/IG_Chain_Arrow.webp"
                    alt="→"
                    width={24}
                    height={24}
                    className="mt-2.5"
                  />
                )}
                <span className="flex flex-col items-center gap-1">
                  {icon && (
                    <Image
                      src={`/images/characters/skills/${icon}.webp`}
                      alt={name}
                      width={36}
                      height={36}
                    />
                  )}
                  <span className="text-xs font-semibold text-yellow-300">{name}</span>
                </span>
              </Fragment>
            ))}
          </div>
          <div className="panel-warning mt-4 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-yellow-100/90">{t('page.character.skill.priority_rule_title')}</p>
            <ul className="ml-4 list-inside list-disc space-y-1 text-xs text-yellow-100/90">
              <li>{t('page.character.skill.priority_rule_1')}</li>
              <li>{t('page.character.skill.priority_rule_2')}</li>
              <li>{t('page.character.skill.priority_rule_3')}</li>
            </ul>
            <p className="mt-3 text-xs text-yellow-100/90">{t('page.character.skill.priority_rule_chain')}</p>
          </div>
        </div>
      )}

      {fusionInfo && (
        <div className="panel-feature mb-4 px-4 py-3 text-sm text-zinc-300">
          {renderWithMaterial(
            t('page.character.core_fusion.skill_info', {
              unlockCost: String(fusionInfo.unlockCost),
              upgradeCost: String(fusionInfo.upgradeCost),
              totalCost: String(fusionInfo.totalCost),
            }),
            fusionInfo.material,
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {skills.map((skill) => (
          <SkillCard key={skill!.SkillType} skill={skill!} />
        ))}
      </div>
    </section>
  );
}

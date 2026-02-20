'use client';

import { Fragment } from 'react';
import type { Character } from '@/types/character';
import type { SkillPriority } from '@/types/character';
import { useI18n } from '@/lib/contexts/I18nContext';
import ItemInline from '@/app/components/inline/ItemInline';
import SkillCard from './SkillCard';

type Props = { character: Character };

const SKILL_ORDER = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const;

const PRIORITY_LABEL_MAP: Record<keyof SkillPriority, Parameters<ReturnType<typeof useI18n>['t']>[0]> = {
  First: 'page.character.skill.type.s1',
  Second: 'page.character.skill.type.s2',
  Ultimate: 'page.character.skill.type.ultimate',
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
  const { t } = useI18n();
  const skills = SKILL_ORDER.map((key) => character.skills[key]).filter(Boolean);

  if (!skills.length) return null;

  const isCoreFusion = character.fusionType === 'core-fusion';
  const fusionInfo = isCoreFusion && character.fusionLevels?.length
    ? (() => {
        const material = character.fusionLevels[0].requireItemID;
        const upgradeCost = character.fusionLevels.length > 1
          ? Number(character.fusionLevels[1].skillUpgrades.skill_1?.value ?? 150)
          : 150;
        const unlockCost = character.fusionRequirements?.material.quantity ?? 300;
        const upgradeCount = character.fusionLevels.length - 1;
        const totalCost = upgradeCost * upgradeCount + unlockCost;
        return { material, upgradeCost, unlockCost, totalCost };
      })()
    : null;

  // Build skill priority order for non-core-fusion characters
  const priorityOrder = !isCoreFusion && character.skill_priority
    ? (Object.entries(character.skill_priority) as [keyof SkillPriority, { prio: number }][])
        .filter(([, v]) => v?.prio != null)
        .sort((a, b) => a[1].prio - b[1].prio)
        .map(([key]) => ({ key, label: t(PRIORITY_LABEL_MAP[key]) }))
    : null;

  return (
    <section id="skills">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.skills')}</h2>

      {priorityOrder && priorityOrder.length > 0 && (
        <div className="mb-6 max-w-2xl mx-auto">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300 after:hidden">{t('page.character.skill.priority_title')}</h3>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {priorityOrder.map(({ key, label }, i) => (
              <Fragment key={key}>
                {i > 0 && <span className="text-zinc-500">→</span>}
                <span className="rounded bg-yellow-500/15 px-2.5 py-1 text-yellow-300 ring-1 ring-yellow-400/30 text-xs font-semibold">
                  {i + 1}. {label}
                </span>
              </Fragment>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-yellow-400/30 bg-yellow-900/30 px-4 py-3">
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
        <div className="mb-4 rounded-lg border border-purple-500/30 bg-purple-950/20 px-4 py-3 text-sm text-zinc-300">
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

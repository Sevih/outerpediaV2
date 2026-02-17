'use client';

import type { Character } from '@/types/character';
import { useI18n } from '@/lib/contexts/I18nContext';
import SkillCard from './SkillCard';

type Props = { character: Character };

const SKILL_ORDER = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const;

export default function SkillsSection({ character }: Props) {
  const { t } = useI18n();
  const skills = SKILL_ORDER.map((key) => character.skills[key]).filter(Boolean);

  if (!skills.length) return null;

  return (
    <section id="skills">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.skills')}</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {skills.map((skill) => (
          <SkillCard key={skill!.SkillType} skill={skill!} />
        ))}
      </div>
    </section>
  );
}

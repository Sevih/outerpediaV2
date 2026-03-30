'use client';

import { use, useState, useMemo } from 'react';
import Image from 'next/image';
import BossPortrait from '@/app/components/guides/BossPortrait';
import BuffDebuffDisplay, { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { effectMapsPromise } from '@/lib/data/effects-client';
import { getSkillImageSrc } from '@/lib/boss-utils';
import { formatBossDesc, ImmuneList } from '@/app/components/guides/boss-shared';
import type { Boss, BossSkill } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

/* ── Skill tab button ── */

function SkillTab({ skill, isActive, onClick }: {
  skill: BossSkill;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative h-9 w-9 shrink-0 rounded transition-all',
        isActive
          ? 'ring-2 ring-amber-400/60 bg-amber-500/15'
          : 'opacity-60 hover:opacity-100 hover:bg-zinc-800/50',
      ].join(' ')}
    >
      <Image
        src={getSkillImageSrc(skill.icon)}
        alt={lRec(skill.name as LangMap, 'en')}
        fill
        sizes="36px"
        className="object-contain"
      />
    </button>
  );
}

/* ── Skill content panel ── */

function SkillPanel({ skill, lang, iconOnly }: { skill: BossSkill; lang: Lang; iconOnly: boolean }) {
  const name = lRec(skill.name as LangMap, lang);
  const desc = lRec(skill.description as LangMap, lang);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-zinc-200">{name}</p>
      {(skill.buff?.length || skill.debuff?.length) ? (
        <BuffDebuffDisplay buffs={skill.buff ?? []} debuffs={skill.debuff ?? []} iconOnly={iconOnly} keepInterruptions />
      ) : null}
      {desc && (
        <p className="text-xs leading-relaxed text-zinc-400">
          {formatBossDesc(desc, lang)}
        </p>
      )}
    </div>
  );
}

/* ── Main component ── */

type Props = {
  boss: Boss;
  /** When true, skill buffs/debuffs show icon only (default). Set false to show labels. */
  iconOnlySkills?: boolean;
};

export default function BossCompactDisplay({ boss, iconOnlySkills = true }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;
  const { buffMap, debuffMap } = use(effectMapsPromise);

  const baseName = lRec(boss.Name, lang);
  const surname = lRec(boss.Surname as LangMap, lang);
  const displayName = boss.IncludeSurname && surname ? `${surname} ${baseName}` : baseName;

  const visibleSkills = useMemo(
    () => boss.skills.filter(s => lRec(s.name as LangMap, lang) && lRec(s.description as LangMap, lang)),
    [boss.skills, lang],
  );

  const [activeSkill, setActiveSkill] = useState(0);
  const currentSkill = visibleSkills[activeSkill] ?? visibleSkills[0];

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-3">
        {/* Boss header */}
        <div className="flex items-center gap-3">
          <BossPortrait icons={boss.icons} name={displayName} size="md" />
          <div>
            {!boss.IncludeSurname && surname && (
              <p className="text-xs text-zinc-400">{surname}</p>
            )}
            <p className="text-lg font-bold text-zinc-100">{displayName}</p>
            <div className="mt-1 flex items-center gap-2">
              <ElementInline element={boss.element} />
              <ClassInline name={boss.class} />
              <span className="text-xs text-zinc-500">Lv.{boss.level}</span>
            </div>
          </div>
        </div>

        {/* Immunities */}
        <ImmuneList immuneStr={boss.BuffImmune} statImmuneStr={boss.StatBuffImmune} headingTag="h4" />

        {/* Skills tabs */}
        {visibleSkills.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              {visibleSkills.map((skill, i) => (
                <SkillTab
                  key={i}
                  skill={skill}
                  isActive={i === activeSkill}
                  onClick={() => setActiveSkill(i)}
                />
              ))}
            </div>
            {currentSkill && <SkillPanel skill={currentSkill} lang={lang} iconOnly={iconOnlySkills} />}
          </div>
        )}
      </div>
    </EffectsProvider>
  );
}

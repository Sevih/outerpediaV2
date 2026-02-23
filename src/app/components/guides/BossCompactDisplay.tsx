'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import BuffDebuffDisplay, { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import ElementInline from '@/app/components/inline/ElementInline';
import ClassInline from '@/app/components/inline/ClassInline';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import buffsData from '@data/effects/buffs.json';
import debuffsData from '@data/effects/debuffs.json';
import type { Boss, BossSkill } from '@/types/boss';
import type { Effect } from '@/types/effect';
import type { LangMap } from '@/types/common';
import type { Lang } from '@/lib/i18n/config';

const buffMap: Record<string, Effect> = {};
for (const b of buffsData as Effect[]) buffMap[b.name] = b;
const debuffMap: Record<string, Effect> = {};
for (const d of debuffsData as Effect[]) debuffMap[d.name] = d;

/* ── Immunities ── */

function normalizeName(name: string): string {
  return name.startsWith('ST_') ? `BT_STAT|${name}` : name;
}

function ImmuneList({ immuneStr, statImmuneStr }: { immuneStr: string; statImmuneStr: string }) {
  const { t } = useI18n();
  const raw: string[] = [];
  if (immuneStr) raw.push(...immuneStr.split(',').map((s) => normalizeName(s.trim())).filter(Boolean));
  if (statImmuneStr) raw.push(...statImmuneStr.split(',').map((s) => normalizeName(s.trim())).filter(Boolean));
  // Deduplicate by label (e.g. BT_REVERSE_HEAL_BASED_TARGET and BT_REVERSE_HEAL_BASED_CASTER both map to "Fixed Damage")
  const seen = new Set<string>();
  const items = raw.filter((name) => {
    const label = debuffMap[name]?.label ?? name;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 after:hidden">
        {t('guides.boss_display.immunities')}
      </h5>
      <BuffDebuffDisplay buffs={[]} debuffs={items} iconOnly />
    </div>
  );
}

/* ── Helpers ── */

function getBossImageSrc(icons: string): string {
  if (icons.startsWith('Skill_')) {
    const suffix = icons.split('_').pop() ?? '';
    const folder = suffix.startsWith('2') ? '' : 'boss/';
    return `/images/characters/${folder}skills/${icons}.webp`;
  }
  return `/images/characters/boss/portrait/MT_${icons}.webp`;
}

function getSkillImageSrc(icon: string): string {
  const suffix = icon.split('_').pop() ?? '';
  const folder = suffix.startsWith('2') ? '' : 'boss/';
  return `/images/characters/${folder}skills/${icon}.webp`;
}

function formatBossDesc(text: string): React.ReactNode {
  if (!text) return null;

  const regex = /<color=(#[0-9a-fA-F]{6})>(.*?)<\/color>|\\n|\n/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<span key={key++} style={{ color: match[1] }}>{match[2]}</span>);
    } else {
      parts.push(<br key={key++} />);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

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
        alt=""
        fill
        sizes="36px"
        className="object-contain"
      />
    </button>
  );
}

/* ── Skill content panel ── */

function SkillPanel({ skill, lang }: { skill: BossSkill; lang: Lang }) {
  const name = lRec(skill.name as LangMap, lang);
  const desc = lRec(skill.description as LangMap, lang);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-zinc-200">{name}</p>
      {(skill.buff?.length || skill.debuff?.length) ? (
        <BuffDebuffDisplay buffs={skill.buff ?? []} debuffs={skill.debuff ?? []} iconOnly />
      ) : null}
      {desc && (
        <p className="text-xs leading-relaxed text-zinc-400">
          {formatBossDesc(desc)}
        </p>
      )}
    </div>
  );
}

/* ── Main component ── */

type Props = {
  boss: Boss;
};

export default function BossCompactDisplay({ boss }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;

  const baseName = lRec(boss.Name, lang);
  const surname = lRec(boss.Surname as LangMap, lang);
  const displayName = boss.IncludeSurname && surname ? `${surname} ${baseName}` : baseName;

  const visibleSkills = useMemo(
    () => boss.skills.filter(s => lRec(s.name as LangMap, lang) || lRec(s.description as LangMap, lang)),
    [boss.skills, lang],
  );

  const [activeSkill, setActiveSkill] = useState(0);
  const currentSkill = visibleSkills[activeSkill] ?? visibleSkills[0];

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-3">
        {/* Boss header */}
        <div className="flex items-center gap-3">
          {boss.icons.startsWith('2') ? (
            <CharacterPortrait id={boss.icons} size="md" name={displayName} className="shrink-0" />
          ) : (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
              <Image
                src={getBossImageSrc(boss.icons)}
                alt={displayName}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          )}
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
        <ImmuneList immuneStr={boss.BuffImmune} statImmuneStr={boss.StatBuffImmune} />

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
            {currentSkill && <SkillPanel skill={currentSkill} lang={lang} />}
          </div>
        )}
      </div>
    </EffectsProvider>
  );
}

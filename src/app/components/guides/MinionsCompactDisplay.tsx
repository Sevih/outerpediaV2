'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import BossPortrait from '@/app/components/guides/BossPortrait';
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
        'relative h-8 w-8 shrink-0 rounded transition-all',
        isActive
          ? 'ring-2 ring-amber-400/60 bg-amber-500/15'
          : 'opacity-60 hover:opacity-100 hover:bg-zinc-800/50',
      ].join(' ')}
    >
      <Image
        src={getSkillImageSrc(skill.icon)}
        alt=""
        fill
        sizes="32px"
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

/* ── Minion tab button ── */

function MinionTab({ minion, isActive, onClick, lang }: {
  minion: Boss;
  isActive: boolean;
  onClick: () => void;
  lang: Lang;
}) {
  const name = lRec(minion.Name, lang);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-all',
        isActive
          ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
      ].join(' ')}
    >
      <BossPortrait icons={minion.icons} size="xxs" />
      <span className="truncate">{name}</span>
    </button>
  );
}

/* ── Single minion detail ── */

function MinionDetail({ minion, lang }: { minion: Boss; lang: Lang }) {
  const name = lRec(minion.Name, lang);
  const surname = lRec(minion.Surname as LangMap, lang);
  const displayName = minion.IncludeSurname && surname ? `${surname} ${name}` : name;

  const visibleSkills = useMemo(
    () => minion.skills.filter(s => lRec(s.name as LangMap, lang) || lRec(s.description as LangMap, lang)),
    [minion.skills, lang],
  );

  const [activeSkill, setActiveSkill] = useState(0);
  const currentSkill = visibleSkills[activeSkill] ?? visibleSkills[0];

  return (
    <div className="space-y-3">
      {/* Minion header */}
      <div className="flex items-center gap-2">
        <BossPortrait icons={minion.icons} name={displayName} size="sm" />
        <div>
          {!minion.IncludeSurname && surname && (
            <p className="text-[10px] text-zinc-500">{surname}</p>
          )}
          <p className="text-sm font-bold text-zinc-100">{displayName}</p>
          <div className="flex items-center gap-1.5">
            <ElementInline element={minion.element} />
            <ClassInline name={minion.class} />
            <span className="text-xs text-zinc-500">Lv.{minion.level}</span>
          </div>
        </div>
      </div>

      {/* Immunities */}
      <ImmuneList immuneStr={minion.BuffImmune} statImmuneStr={minion.StatBuffImmune} />

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
  );
}

/* ── Main component ── */

type Props = {
  minions: Boss[];
};

export default function MinionsCompactDisplay({ minions }: Props) {
  const { lang: rawLang } = useI18n();
  const lang = rawLang as Lang;
  const [activeMinion, setActiveMinion] = useState(0);

  if (minions.length === 0) return null;

  const current = minions[activeMinion] ?? minions[0];

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-3">
        {/* Minion selector tabs */}
        {minions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            {minions.map((m, i) => (
              <MinionTab
                key={m.id}
                minion={m}
                isActive={i === activeMinion}
                onClick={() => setActiveMinion(i)}
                lang={lang}
              />
            ))}
          </div>
        )}

        {/* Active minion detail */}
        <MinionDetail key={current.id} minion={current} lang={lang} />
      </div>
    </EffectsProvider>
  );
}

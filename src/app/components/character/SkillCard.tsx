'use client';

import Image from 'next/image';
import { Fragment, useState } from 'react';
import type { SkillData } from '@/types/character';
import type { Lang } from '@/lib/i18n/config';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import BuffDebuffDisplay from './BuffDebuffDisplay';

type Props = { skill: SkillData };

function getEnhancement(skill: SkillData, level: string, lang: Lang): string[] {
  if (lang === 'en') return (skill.enhancement as Record<string, string[]>)[level] ?? [];
  return (skill.enhancement as Record<string, string[]>)[`${level}_${lang}`]
    ?? (skill.enhancement as Record<string, string[]>)[level] ?? [];
}

function getDescription(skill: SkillData, level: string, lang: Lang): string {
  if (lang === 'en') return (skill.true_desc_levels as Record<string, string>)[level] ?? '';
  return (skill.true_desc_levels as Record<string, string>)[`${level}_${lang}`]
    ?? (skill.true_desc_levels as Record<string, string>)[level] ?? '';
}

export default function SkillCard({ skill }: Props) {
  const { lang, t } = useI18n();
  const [level, setLevel] = useState('1');
  const name = l(skill, 'name', lang);
  const desc = getDescription(skill, level, lang);
  const maxLevel = Object.keys(skill.true_desc_levels).filter((k) => /^\d+$/.test(k)).length;

  // Count WGR bonus and CD reduction from active enhancements (always check English text)
  const enhancements = skill.enhancement as Record<string, string[]>;
  let wgrBonus = 0;
  let cdReduction = 0;
  for (const lv of ['2', '3', '4', '5']) {
    if (Number(level) < Number(lv)) continue;
    const items = enhancements[lv] ?? [];
    for (const item of items) {
      if (item.includes('+1 Weakness Gauge damage')) wgrBonus++;
      if (item.includes('-1 turn Skill Cooldown')) cdReduction++;
    }
  }
  const adjustedWgr = skill.wgr + wgrBonus;
  const adjustedCd = skill.cd ? skill.cd - cdReduction : null;

  return (
    <div className="card rounded-xl p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <div className="relative h-full w-full overflow-hidden">
            <Image src={`/images/characters/${skill.IconName.startsWith('Skill_CorePassive') ? 'core-fusion-skill' : 'skills'}/${skill.IconName}.webp`} alt={name} fill sizes="56px" className="object-contain" />
          </div>
          {skill.burnEffect && (
            <div className="absolute -top-1 -right-1 h-5 w-5">
              <Image src="/images/ui/skills/CM_Skill_Icon_Burst.webp" alt={t('page.character.toc.burst')} fill sizes="20px" className="object-contain" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-game text-lg font-bold">{name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {adjustedCd && <span className="rounded bg-zinc-800 px-1.5 py-0.5">{t('page.character.skill.cooldown')} {adjustedCd}</span>}
            {!!adjustedWgr && <span className="rounded bg-zinc-800 px-1.5 py-0.5">{t('page.character.skill.wgr')} {adjustedWgr}</span>}
            {skill.target && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                {t(`page.character.skill.target_${skill.target}${skill.offensive ? '' : '_ally'}` as Parameters<typeof t>[0])}
              </span>
            )}
          </div>
        </div>
      </div>

      <BuffDebuffDisplay buffs={skill.buff} debuffs={skill.debuff} />

      {maxLevel > 1 && (
        <div className="mt-3 mb-3 flex items-center gap-1">
          {Array.from({ length: maxLevel }, (_, i) => String(i + 1)).map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              className={[
                'rounded px-2 py-0.5 text-xs transition',
                lv === level ? 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-400/40' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
              ].join(' ')}
            >
              {t('page.character.skill.level')}{lv}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 text-sm leading-relaxed text-zinc-200">{formatEffectText(desc)}</div>

      <div className="mt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {t('page.character.skill.enhancement')}
          <span className="sr-only"> — {name}</span>
        </h4>
        <div className="space-y-1">
          {['2', '3', '4', '5'].map((lv) => {
            const items = getEnhancement(skill, lv, lang);
            if (!items.length) return null;
            const active = Number(level) >= Number(lv);
            return (
              <div key={lv} className={`flex gap-2 text-xs transition-opacity ${active ? '' : 'opacity-30'}`}>
                <span className="shrink-0 font-semibold text-yellow-400">+{lv}</span>
                <span className="text-zinc-300">{items.map((item, i) => (
                  <Fragment key={i}>{i > 0 && ', '}{formatEffectText(item)}</Fragment>
                ))}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

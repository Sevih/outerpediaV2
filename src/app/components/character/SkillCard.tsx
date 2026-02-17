'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { SkillData, BurnEffect } from '@/types/character';
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

function getBurns(skill: SkillData, lang: Lang): { level: number; cost: number; effect: string }[] {
  if (!skill.burnEffect) return [];
  return Object.values(skill.burnEffect).map((b: BurnEffect) => ({
    level: b.level,
    cost: b.cost,
    effect: l(b as unknown as Record<string, unknown>, 'effect', lang) as string,
  }));
}

export default function SkillCard({ skill }: Props) {
  const { lang, t } = useI18n();
  const [level, setLevel] = useState('1');
  const name = l(skill, 'name', lang);
  const desc = getDescription(skill, level, lang);
  const maxLevel = Object.keys(skill.true_desc_levels).filter((k) => /^\d+$/.test(k)).length;
  const burns = getBurns(skill, lang);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-800">
          <Image src={`/images/characters/skills/${skill.IconName}.webp`} alt={name} fill sizes="56px" className="object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-game text-lg font-bold">{name}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {skill.cd && <span className="rounded bg-zinc-800 px-1.5 py-0.5">{t('page.character.skill.cooldown')} {skill.cd}</span>}
            <span className="rounded bg-zinc-800 px-1.5 py-0.5">{t('page.character.skill.wgr')} {skill.wgr}</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5">
              {skill.target === 'mono' ? t('page.character.skill.target_mono') : t('page.character.skill.target_multi')}
            </span>
          </div>
        </div>
      </div>

      {maxLevel > 1 && (
        <div className="mb-3 flex items-center gap-1">
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
      <BuffDebuffDisplay buffs={skill.buff} debuffs={skill.debuff} />

      <div className="mt-4">
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('page.character.skill.enhancement')}</h5>
        <div className="space-y-1">
          {['2', '3', '4', '5'].map((lv) => {
            const items = getEnhancement(skill, lv, lang);
            if (!items.length) return null;
            return (
              <div key={lv} className="flex gap-2 text-xs">
                <span className="shrink-0 font-semibold text-yellow-400">+{lv}</span>
                <span className="text-zinc-300">{items.join(', ')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {burns.length > 0 && (
        <div className="mt-4">
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t('page.character.skill.burn_cards')}</h5>
          <div className="space-y-2">
            {burns.map((burn) => (
              <div key={burn.level} className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-bold text-amber-400">{t('page.character.skill.level')}{burn.level}</span>
                  <span className="text-zinc-400">{t('page.character.skill.burn_cost')}: {burn.cost}</span>
                </div>
                <div className="text-zinc-200">{formatEffectText(burn.effect)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

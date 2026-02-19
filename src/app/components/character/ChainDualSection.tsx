'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Character } from '@/types/character';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import BuffDebuffDisplay from './BuffDebuffDisplay';
import type { Lang } from '@/lib/i18n/config';

type Props = { character: Character };

/** Split chain passive description into chain effect and dual attack effect */
function splitChainDual(desc: string) {
  const marker = /<color=#ffd732>[^<]+<\/color>\s*:\s*/gi;
  const matches = [...desc.matchAll(marker)];

  if (matches.length < 2) {
    return { chain: desc.trim(), dual: '' };
  }

  const splitIndex = matches[1].index ?? 0;
  return {
    chain: desc.slice(0, splitIndex).trim(),
    dual: desc.slice(splitIndex).trim(),
  };
}

function getEnhancement(enhancement: Record<string, string[]>, level: string, lang: Lang): string[] {
  if (lang === 'en') return enhancement[level] ?? [];
  return enhancement[`${level}_${lang}`] ?? enhancement[level] ?? [];
}

export default function ChainDualSection({ character }: Props) {
  const { lang, t } = useI18n();
  const cp = character.skills.SKT_CHAIN_PASSIVE;
  if (!cp) return null;

  const [level, setLevel] = useState('1');
  const maxLevel = Object.keys(cp.true_desc_levels).filter((k) => /^\d+$/.test(k)).length;

  // Get localized description for current level
  const descKey = lang === 'en' ? level : `${level}_${lang}`;
  const rawDesc =
    (cp.true_desc_levels as Record<string, string>)[descKey] ??
    (cp.true_desc_levels as Record<string, string>)[level] ??
    '';

  const { chain, dual } = splitChainDual(rawDesc);

  // Count WGR bonus from active enhancements
  const enhancements = cp.enhancement as Record<string, string[]>;
  let wgrBonus = 0;
  for (const lv of ['2', '3', '4', '5']) {
    if (Number(level) < Number(lv)) continue;
    const items = enhancements[lv] ?? [];
    for (const item of items) {
      if (item.includes('+1 Weakness Gauge damage')) wgrBonus++;
    }
  }
  const adjustedWgr = cp.wgr + wgrBonus;
  const adjustedWgrDual = cp.wgr_dual !== undefined ? cp.wgr_dual + wgrBonus : undefined;

  const chainIcon = `/images/characters/chain/Skill_ChainPassive_${character.Element}_${character.Chain_Type}.webp`;

  return (
    <section id="chain-dual">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.chain_dual')}</h2>

      <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
        {/* Icon + name */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden">
            <Image
              src={chainIcon}
              alt="Chain Passive"
              fill
              sizes="56px"
              className="object-contain scale-83"
            />
          </div>
          <div>
            <h3 className="font-game text-lg font-bold">{l(cp, 'name', lang)}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {!isNaN(adjustedWgr) && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                  {t('page.character.skill.wgr')} {adjustedWgr}
                </span>
              )}
              {adjustedWgrDual !== undefined && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                  Dual {t('page.character.skill.wgr')} {adjustedWgrDual}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Level selector */}
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

        {/* Chain effect */}
        {chain && (
          <div className="mb-4">
            <div className="mt-2">
              <BuffDebuffDisplay buffs={cp.buff} debuffs={cp.debuff} />
            </div>
            <div className="text-sm leading-relaxed text-zinc-200">
              {formatEffectText(chain)}
            </div>
          </div>
        )}

        {/* Dual attack effect */}
        {dual && (
          <div>
            <div className="mt-2">
              <BuffDebuffDisplay
                buffs={cp.dual_buff ?? []}
                debuffs={cp.dual_debuff ?? []}
              />
              <div className="text-sm leading-relaxed text-zinc-200">
                {formatEffectText(dual)}
              </div>
            </div>
          </div>
        )}

        {/* Enhancements */}
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('page.character.skill.enhancement')}
          </h4>
          <div className="space-y-1">
            {['2', '3', '4', '5'].map((lv) => {
              const items = getEnhancement(cp.enhancement as Record<string, string[]>, lv, lang);
              if (!items.length) return null;
              const active = Number(level) >= Number(lv);
              return (
                <div key={lv} className={`flex gap-2 text-xs transition-opacity ${active ? '' : 'opacity-30'}`}>
                  <span className="shrink-0 font-semibold text-yellow-400">+{lv}</span>
                  <span className="text-zinc-300">{items.join(', ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

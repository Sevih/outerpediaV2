'use client';

import Image from 'next/image';
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

  // Get localized level 1 description
  const descKey = lang === 'en' ? '1' : `1_${lang}`;
  const rawDesc =
    (cp.true_desc_levels as Record<string, string>)[descKey] ??
    (cp.true_desc_levels as Record<string, string>)['1'] ??
    '';

  const { chain, dual } = splitChainDual(rawDesc);

  const chainIcon = `/images/characters/chain/Skill_ChainPassive_${character.Element}_${character.Chain_Type}.webp`;

  return (
    <section id="chain-dual">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.chain_dual')}</h2>

      <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
        {/* Icon + name */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-800">
            <Image
              src={chainIcon}
              alt="Chain Passive"
              fill
              sizes="56px"
              className="object-contain"
            />
          </div>
          <div>
            <h4 className="font-game text-lg font-bold">{l(cp, 'name', lang)}</h4>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                {t('page.character.skill.wgr')} {cp.wgr}
              </span>
              {cp.wgr_dual !== undefined && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                  Dual {t('page.character.skill.wgr')} {cp.wgr_dual}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chain effect */}
        {chain && (
          <div className="mb-4">
            <h5 className="mb-1 text-xs font-semibold uppercase tracking-wider text-yellow-400">
              {t('page.character.chain_effect')}
            </h5>
            <div className="text-sm leading-relaxed text-zinc-200">
              {formatEffectText(chain)}
            </div>
            <div className="mt-2">
              <BuffDebuffDisplay buffs={cp.buff} debuffs={cp.debuff} />
            </div>
          </div>
        )}

        {/* Dual attack effect */}
        {dual && (
          <div>
            <h5 className="mb-1 text-xs font-semibold uppercase tracking-wider text-yellow-400">
              {t('page.character.dual_effect')}
            </h5>
            <div className="text-sm leading-relaxed text-zinc-200">
              {formatEffectText(dual)}
            </div>
            <div className="mt-2">
              <BuffDebuffDisplay
                buffs={cp.dual_buff ?? []}
                debuffs={cp.dual_debuff ?? []}
              />
            </div>
          </div>
        )}

        {/* Enhancements */}
        <div className="mt-4">
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('page.character.skill.enhancement')}
          </h5>
          <div className="space-y-1">
            {['2', '3', '4', '5'].map((lv) => {
              const items = getEnhancement(cp.enhancement as Record<string, string[]>, lv, lang);
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
      </div>
    </section>
  );
}

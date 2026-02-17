'use client';

import Image from 'next/image';
import type { Character } from '@/types/character';
import type { ExclusiveEquipment } from '@/types/equipment';
import { l } from '@/lib/i18n/localize';
import { formatEffectText } from '@/lib/format-text';
import { useI18n } from '@/lib/contexts/I18nContext';
import BuffDebuffDisplay from './BuffDebuffDisplay';
import TranscendenceSlider from './TranscendenceSlider';

type Props = {
  character: Character;
  ee: ExclusiveEquipment | null;
};

const RANKS_PVE = ['S', 'A', 'B', 'C', 'D', 'E'] as const;

function demoteOnce(rank: string): string {
  const i = RANKS_PVE.indexOf(rank as (typeof RANKS_PVE)[number]);
  return RANKS_PVE[Math.min(i < 0 ? RANKS_PVE.length - 1 : i + 1, RANKS_PVE.length - 1)];
}

function getRankColor(rank: string): string {
  const map: Record<string, string> = {
    S: 'text-red-400 border-red-500/40',
    A: 'text-orange-400 border-orange-500/40',
    B: 'text-yellow-400 border-yellow-500/40',
    C: 'text-green-400 border-green-500/40',
    D: 'text-blue-400 border-blue-500/40',
    E: 'text-zinc-400 border-zinc-500/40',
  };
  return map[rank] ?? 'text-zinc-400 border-zinc-500/40';
}

export default function EeTranscendSection({ character, ee }: Props) {
  const { lang, t } = useI18n();
  const hasEe = !!ee;
  const hasTranscend = !!character.transcend;

  if (!hasEe && !hasTranscend) return null;

  // PvE rank: demote for 1-2 star characters
  const pveRank =
    character.Rarity < 3 ? demoteOnce(character.rank) : character.rank;

  return (
    <section id="ee-transcend">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.ee_transcend')}</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        {/* Left: EE Card */}
        {hasEe && ee && (
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <h3 className="mb-3 text-lg font-semibold">{t('page.character.ee.title')}</h3>

            <div className="flex items-start gap-4">
              {/* EE portrait */}
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-800">
                <Image
                  src={`/images/characters/ee/${character.ID}.webp`}
                  alt={l(ee, 'name', lang)}
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-game text-base font-bold">{l(ee, 'name', lang)}</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-300">{t('page.character.ee.main_stat')}</span>{' '}
                  {l(ee, 'mainStat', lang)}
                </p>
              </div>
            </div>

            {/* Effect icon */}
            {ee.icon_effect && (
              <div className="mt-3 flex items-center gap-2">
                <div className="relative h-8 w-8">
                  <Image
                    src={`/images/ui/effect/${ee.icon_effect}.webp`}
                    alt="Effect"
                    fill
                    sizes="32px"
                    className="object-contain"
                  />
                </div>
              </div>
            )}

            {/* Effect */}
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-xs font-semibold text-zinc-500">{t('page.character.ee.effect')}</p>
                <div className="text-sm text-zinc-200">
                  {formatEffectText(l(ee, 'effect', lang))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500">{t('page.character.ee.effect_max')}</p>
                <div className="text-sm text-zinc-200">
                  {formatEffectText(l(ee, 'effect10', lang))}
                </div>
              </div>
            </div>

            {/* Buffs/debuffs */}
            <div className="mt-3">
              <BuffDebuffDisplay buffs={ee.buff} debuffs={ee.debuff} />
            </div>
          </div>
        )}

        {/* Right: Tier cards */}
        <div className="flex flex-col gap-3 lg:w-40">
          {/* EE Rank */}
          {hasEe && ee && (
            <TierCard label={t('page.character.ee.rank')} rank={ee.rank} />
          )}
          {/* PvE Tier */}
          <TierCard label={t('page.character.tier.pve')} rank={pveRank} />
          {/* PvP Tier */}
          {character.rank_pvp && (
            <TierCard label={t('page.character.tier.pvp')} rank={character.rank_pvp} />
          )}
        </div>
      </div>

      {/* Transcendence */}
      {hasTranscend && character.transcend && (
        <div className="mt-6">
          <h3 className="mb-3 text-lg font-semibold">{t('page.character.transcend.title')}</h3>
          <TranscendenceSlider transcend={character.transcend} />
        </div>
      )}
    </section>
  );
}

function TierCard({ label, rank }: { label: string; rank: string }) {
  return (
    <div
      className={`flex flex-col items-center rounded-xl border bg-zinc-900/60 px-4 py-3 ${getRankColor(rank)}`}
    >
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="font-game text-3xl font-bold">{rank}</span>
    </div>
  );
}

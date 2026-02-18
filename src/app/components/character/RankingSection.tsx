'use client';

import Image from 'next/image';
import type { Character } from '@/types/character';
import type { ExclusiveEquipment } from '@/types/equipment';
import { useI18n } from '@/lib/contexts/I18nContext';

type Props = {
  character: Character;
  ee: ExclusiveEquipment | null;
};

const RANKS_PVE = ['S', 'A', 'B', 'C', 'D', 'E'] as const;

function demoteOnce(rank: string): string {
  const i = RANKS_PVE.indexOf(rank as (typeof RANKS_PVE)[number]);
  return RANKS_PVE[Math.min(i < 0 ? RANKS_PVE.length - 1 : i + 1, RANKS_PVE.length - 1)];
}

export default function RankingSection({ character, ee }: Props) {
  const { t } = useI18n();

  const pveRank =
    character.Rarity < 3 ? demoteOnce(character.rank) : character.rank;

  return (
    <section id="ranking">
      <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.ranking')}</h2>

      <div className="flex flex-wrap gap-3">
        {ee && (
          <TierCard label={t('page.character.ee.rank')} rank={ee.rank} />
        )}
        <TierCard label={t('page.character.tier.pve')} rank={pveRank} />
        {character.rank_pvp && (
          <TierCard label={t('page.character.tier.pvp')} rank={character.rank_pvp} />
        )}
      </div>
    </section>
  );
}

function TierCard({ label, rank }: { label: string; rank: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-white/10 bg-zinc-900/60 px-6 py-3">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="relative mt-1 h-8 w-8">
        <Image
          src={`/images/ui/rank/IG_Event_Rank_${rank}.webp`}
          alt={rank}
          fill
          sizes="32px"
          className="object-contain"
        />
      </div>
    </div>
  );
}

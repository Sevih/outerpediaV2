'use client';

import { useMemo } from 'react';
import type { Character, CharacterProfile, CharacterStats } from '@/types/character';
import type { ExclusiveEquipment } from '@/types/equipment';
import type { Weapon, Amulet, Talisman, ArmorSet } from '@/types/equipment';
import { useI18n } from '@/lib/contexts/I18nContext';
import QuickToc, { type TocSection } from '@/app/components/character/QuickToc';
import OverviewSection from '@/app/components/character/OverviewSection';
import StatsRankingSection from '@/app/components/character/StatsRankingSection';
import EeSection from '@/app/components/character/EeSection';
import TranscendenceSection from '@/app/components/character/TranscendenceSection';
import SkillsSection from '@/app/components/character/SkillsSection';
import BurstSection from '@/app/components/character/BurstSection';
import ChainDualSection from '@/app/components/character/ChainDualSection';
import GearRecoSection from '@/app/components/character/GearRecoSection';

type TagEntry = {
  label: string;
  image: string;
  desc: string;
  type: string;
  [k: string]: string;
};

type Props = {
  character: Character;
  profile: CharacterProfile | null;
  stats: CharacterStats | null;
  ee: ExclusiveEquipment | null;
  reco: Record<string, unknown> | null;
  tags: Record<string, TagEntry>;
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
};

export default function CharacterDetailClient({
  character,
  profile,
  stats,
  ee,
  reco,
  tags,
  weapons,
  amulets,
  talismans,
  sets,
}: Props) {
  const { t } = useI18n();

  const hasEe = !!ee;
  const hasTranscend = !!character.transcend;
  const hasChainPassive = !!character.skills.SKT_CHAIN_PASSIVE;
  const hasBurst = !!(['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const).find(
    (k) => character.skills[k]?.burnEffect && Object.keys(character.skills[k]!.burnEffect!).length > 0
  );

  const sections = useMemo<TocSection[]>(() => {
    return [
      { id: 'overview', label: t('page.character.toc.overview') },
      { id: 'stats-ranking', label: t('page.character.toc.stats_ranking') },
      hasEe && { id: 'ee', label: t('page.character.toc.ee') },
      hasTranscend && { id: 'transcend', label: t('page.character.toc.transcend') },
      { id: 'skills', label: t('page.character.toc.skills') },
      hasBurst && { id: 'burst', label: t('page.character.toc.burst') },
      hasChainPassive && { id: 'chain-dual', label: t('page.character.toc.chain_dual') },
      { id: 'gear', label: t('page.character.toc.gear') },
    ].filter(Boolean) as TocSection[];
  }, [t, hasEe, hasTranscend, hasChainPassive, hasBurst]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 md:px-6">
      <QuickToc sections={sections} />

      <OverviewSection
        character={character}
        profile={profile}
        tags={tags}
      />

      <StatsRankingSection character={character} stats={stats} ee={ee} />

      {hasEe && ee && (
        <EeSection character={character} ee={ee} />
      )}

      {hasTranscend && (
        <TranscendenceSection character={character} />
      )}

      <SkillsSection character={character} />

      {hasBurst && (
        <BurstSection character={character} />
      )}

      {hasChainPassive && (
        <ChainDualSection character={character} />
      )}

      <GearRecoSection
        reco={(reco ?? {}) as Record<string, never>}
        weapons={weapons}
        amulets={amulets}
        talismans={talismans}
        sets={sets}
      />
    </div>
  );
}

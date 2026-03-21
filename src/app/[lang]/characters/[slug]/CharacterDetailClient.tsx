'use client';

import { useMemo } from 'react';
import type { Character, CharacterProfile, CharacterProsCons, CharacterStats, CharacterSynergies } from '@/types/character';
import type { ExclusiveEquipment, ResolvedCharacterReco, BossDisplayMap } from '@/types/equipment';
import type { Weapon, Amulet, Talisman, ArmorSet } from '@/types/equipment';
import type { Item } from '@/types/item';
import type { Effect } from '@/types/effect';
// import type { Review } from '@/types/review'; // TODO: enable when review system is ready
import { useI18n } from '@/lib/contexts/I18nContext';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import QuickToc, { type TocSection } from '@/app/components/character/QuickToc';
import OverviewSection from '@/app/components/character/OverviewSection';
import StatsRankingSection from '@/app/components/character/StatsRankingSection';
import EeSection from '@/app/components/character/EeSection';
import TranscendenceSection from '@/app/components/character/TranscendenceSection';
import SkillsSection from '@/app/components/character/SkillsSection';
import BurstSection from '@/app/components/character/BurstSection';
import ChainDualSection from '@/app/components/character/ChainDualSection';
import GearRecoSection from '@/app/components/character/GearRecoSection';
import ProsConsSection from '@/app/components/character/ProsConsSection';
import SynergiesSection from '@/app/components/character/SynergiesSection';
import CoreFusionBanner from '@/app/components/character/CoreFusionBanner';
import type { CoreFusionLink } from '@/app/components/character/CoreFusionBanner';
// import ReviewsSection from '@/app/components/character/ReviewsSection'; // TODO: enable when review system is ready
import YouTubeEmbed from '@/app/components/ui/YouTubeEmbed';

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
  reco: ResolvedCharacterReco | null;
  tags: Record<string, TagEntry>;
  weapons: Weapon[];
  amulets: Amulet[];
  talismans: Talisman[];
  sets: ArmorSet[];
  giftItems: Item[];
  prosCons: CharacterProsCons | null;
  partners: CharacterSynergies | null;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
  coreFusionLink: CoreFusionLink | null;
  bossMap: BossDisplayMap;
  reviews: unknown[]; // TODO: use Review[] when review system is ready
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
  giftItems,
  prosCons,
  partners,
  buffMap,
  debuffMap,
  coreFusionLink,
  bossMap,
  reviews: _reviews,
}: Props) {
  const { t } = useI18n();

  const hasProsCons = !!prosCons && (prosCons.pros.length > 0 || prosCons.cons.length > 0);
  const hasEe = !!ee;
  const hasTranscend = !!character.transcend;
  const hasChainPassive = !!character.skills.SKT_CHAIN_PASSIVE;
  const hasSynergies = !!partners && partners.partner.length > 0;
  // const hasReviews = reviews.length > 0; // TODO: enable when review system is ready
  const hasVideo = !!character.video;
  const hasBurst = !!(['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const).find(
    (k) => character.skills[k]?.burnEffect && Object.keys(character.skills[k]!.burnEffect!).length > 0
  );

  const sections = useMemo<TocSection[]>(() => {
    return [
      { id: 'overview', label: t('page.character.toc.overview') },
      hasProsCons && { id: 'pros-cons', label: t('page.character.toc.pros_cons') },
      { id: 'stats-ranking', label: t('page.character.toc.stats_ranking') },
      hasEe && { id: 'ee', label: t('equip.tab.ee') },
      hasTranscend && { id: 'transcend', label: t('page.character.toc.transcend') },
      { id: 'skills', label: t('page.character.toc.skills') },
      hasBurst && { id: 'burst', label: t('page.character.toc.burst') },
      hasChainPassive && { id: 'chain-dual', label: t('page.character.toc.chain_dual') },
      hasSynergies && { id: 'synergies', label: t('page.character.toc.synergies') },
      { id: 'gear', label: t('page.character.toc.gear') },
      // hasReviews && { id: 'reviews', label: t('page.character.toc.reviews') }, // TODO: enable when review system is ready
      hasVideo && { id: 'video', label: t('page.character.toc.video') },
    ].filter(Boolean) as TocSection[];
  }, [t, hasProsCons, hasEe, hasTranscend, hasChainPassive, hasBurst, hasSynergies, hasVideo]);

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-16 z-50 rounded bg-black/80 px-3 py-1.5 font-mono text-xs text-white shadow-lg select-all">
          ID: {character.ID}
        </div>
      )}
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 md:px-6">
        <QuickToc sections={sections} />

        <OverviewSection
          character={character}
          profile={profile}
          tags={tags}
        />

        {coreFusionLink && (
          <CoreFusionBanner link={coreFusionLink} />
        )}

        {hasProsCons && prosCons && (
          <ProsConsSection prosCons={prosCons} />
        )}

        <StatsRankingSection character={character} stats={stats} ee={ee} />

        {hasEe && ee && (
          <EeSection character={character} ee={ee} giftItems={giftItems} />
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

        {hasSynergies && partners && (
          <SynergiesSection synergies={partners} />
        )}

        <GearRecoSection
          reco={reco ?? {}}
          weapons={weapons}
          amulets={amulets}
          talismans={talismans}
          sets={sets}
          bossMap={bossMap}
        />

        {/* TODO: enable when review system is ready
        {reviews.length > 0 && (
          <ReviewsSection reviews={reviews} />
        )}
        */}

        {hasVideo && (
          <section id="video">
            <h2 className="mb-4 text-2xl font-bold">{t('page.character.toc.video')}</h2>
            <YouTubeEmbed videoId={character.video!} title={t('page.character.toc.video')} />
          </section>
        )}
      </div>
    </EffectsProvider>
  );
}

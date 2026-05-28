'use client';

import { useMemo, type ReactNode } from 'react';
import type { Character, CharacterProfile, CharacterProsCons, CharacterStats, CharacterSynergies, CharacterVideo } from '@/types/character';
import type { ExclusiveEquipment, ResolvedCharacterReco, BossDisplayMap } from '@/types/equipment';
import type { Weapon, Amulet, Talisman, ArmorSet } from '@/types/equipment';
import type { Item } from '@/types/item';
import type { Effect } from '@/types/effect';
import type { Review } from '@/types/review';
import type { TranslationKey } from '@/i18n/locales/en';
import { useI18n } from '@/lib/contexts/I18nContext';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import QuickToc, { type TocSection } from '@/app/components/character/QuickToc';
import CharacterSectionHeader from '@/app/components/character/CharacterSectionHeader';
import { elementAccent } from '@/app/components/character/characterDetailTheme';
import OverviewSection from '@/app/components/character/OverviewSection';
import type { FullArt } from '@/app/components/character/FullArtCarousel';
import StatsRankingSection from '@/app/components/character/StatsRankingSection';
import EeSection from '@/app/components/character/EeSection';
import SkillsSection from '@/app/components/character/SkillsSection';
import BurstSection from '@/app/components/character/BurstSection';
import ChainDualSection from '@/app/components/character/ChainDualSection';
import GearRecoSection from '@/app/components/character/GearRecoSection';
import ProsConsSection from '@/app/components/character/ProsConsSection';
import SynergiesSection from '@/app/components/character/SynergiesSection';
import CoreFusionBanner from '@/app/components/character/CoreFusionBanner';
import type { CoreFusionLink } from '@/app/components/character/CoreFusionBanner';
import ReviewsSection from '@/app/components/character/ReviewsSection';
import MultiVideoEmbed, { type VideoItem } from '@/app/components/ui/MultiVideoEmbed';
import videoMeta from '@data/generated/video-meta.json';

const VIDEO_META = videoMeta as Record<string, { uploadDate: string; title: string; author: string }>;

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
  fullArts: FullArt[];
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
  reviews: Review[];
  extraVideos: CharacterVideo[];
};

type Sec = { anchor: string; titleKey: TranslationKey; body: ReactNode; row?: string; noHeader?: boolean };

export default function CharacterDetailClient({
  character,
  profile,
  fullArts,
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
  reviews,
  extraVideos,
}: Props) {
  const { t } = useI18n();
  const element = character.Element;
  const { hex } = elementAccent(element);

  const hasProsCons = !!prosCons && (prosCons.pros.length > 0 || prosCons.cons.length > 0);
  const hasEe = !!ee;
  const hasChainPassive = !!character.skills.SKT_CHAIN_PASSIVE;
  const hasSynergies = !!partners && partners.partner.length > 0;
  const hasReviews = reviews.length > 0;
  const hasBurst = !!(['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE'] as const).find(
    (k) => character.skills[k]?.burnEffect && Object.keys(character.skills[k]!.burnEffect!).length > 0
  );

  const videos = useMemo<VideoItem[]>(() => {
    const list: VideoItem[] = [];
    if (character.video) {
      const meta = VIDEO_META[character.video];
      list.push({
        platform: 'youtube',
        id: character.video,
        title: meta?.title ?? t('page.character.toc.video'),
        ...(meta?.author && { author: meta.author }),
      });
    }
    list.push(...extraVideos);
    return list;
  }, [character.video, extraVideos, t]);
  const hasVideo = videos.length > 0;

  // Editorial flow — sections in reading order; conditional ones drop out.
  const secs: Sec[] = [];
  if (hasProsCons && prosCons) {
    secs.push({ anchor: 'pros-cons', titleKey: 'page.character.toc.pros_cons', body: <ProsConsSection prosCons={prosCons} /> });
  }
  secs.push({ anchor: 'stats-ranking', titleKey: 'page.character.toc.stats_ranking', body: <StatsRankingSection character={character} stats={stats} ee={ee} giftItems={giftItems} /> });
  if (hasEe && ee) {
    secs.push({ anchor: 'ee', titleKey: 'page.character.toc.ee', body: <EeSection character={character} ee={ee} />, noHeader: true });
  }
  secs.push({ anchor: 'skills', titleKey: 'page.character.toc.skills', body: <SkillsSection character={character} /> });
  if (hasBurst) {
    secs.push({ anchor: 'burst', titleKey: 'page.character.toc.burst', body: <BurstSection character={character} />, row: 'kit' });
  }
  if (hasChainPassive) {
    secs.push({ anchor: 'chain-dual', titleKey: 'page.character.toc.chain_dual', body: <ChainDualSection character={character} />, row: 'kit' });
  }
  secs.push({ anchor: 'gear', titleKey: 'page.character.toc.gear', body: <GearRecoSection reco={reco ?? {}} weapons={weapons} amulets={amulets} talismans={talismans} sets={sets} bossMap={bossMap} /> });
  if (hasSynergies && partners) {
    secs.push({ anchor: 'synergies', titleKey: 'page.character.toc.synergies', body: <SynergiesSection synergies={partners} /> });
  }
  if (hasReviews) {
    secs.push({ anchor: 'reviews', titleKey: 'page.character.toc.reviews', body: <ReviewsSection reviews={reviews} element={element} /> });
  }
  if (hasVideo) {
    secs.push({ anchor: 'video', titleKey: 'page.character.toc.video', body: <MultiVideoEmbed videos={videos} hashPrefix="video" /> });
  }

  const tocSections: TocSection[] = [
    { id: 'overview', label: t('page.character.toc.overview') },
    ...secs.map((s) => ({ id: s.anchor, label: t(s.titleKey) })),
  ];

  // Group adjacent sections sharing a `row` (e.g. Burst + Chain & Dual) side by side.
  const rows: Sec[][] = [];
  for (const s of secs) {
    const last = rows[rows.length - 1];
    if (s.row && last && last[0].row === s.row) last.push(s);
    else rows.push([s]);
  }

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-16 z-50 rounded bg-black/80 px-3 py-1.5 font-mono text-xs text-white shadow-lg select-all">
          ID: {character.ID}
        </div>
      )}

      <div className="cd-page" style={{ '--cd-el': hex } as React.CSSProperties}>
        <OverviewSection character={character} profile={profile} tags={tags} fullArts={fullArts} />

        {coreFusionLink && (
          <div className="mx-auto max-w-330 px-4 md:px-6 lg:px-8">
            <CoreFusionBanner link={coreFusionLink} />
          </div>
        )}

        <QuickToc sections={tocSections} element={element} />

        <main className="pb-20">
          {rows.map((row) => (
            <div key={row[0].anchor} className="mx-auto w-full max-w-285 px-4 pt-12 lg:px-6 lg:pt-16">
              <div className={row.length > 1 ? 'grid gap-8 lg:grid-cols-2' : undefined}>
                {row.map((s) => (
                  <section key={s.anchor} id={s.anchor} className="min-w-0 scroll-mt-28">
                    {!s.noHeader && <CharacterSectionHeader title={t(s.titleKey)} />}
                    <div className="min-w-0">{s.body}</div>
                  </section>
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    </EffectsProvider>
  );
}

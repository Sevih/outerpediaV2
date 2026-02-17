'use client';

import { useMemo } from 'react';
import type { Character, CharacterProfile } from '@/types/character';
import type { ExclusiveEquipment } from '@/types/equipment';
import type { Weapon, Amulet, Talisman, ArmorSet } from '@/types/equipment';
import { useI18n } from '@/lib/contexts/I18nContext';
import QuickToc, { type TocSection } from '@/app/components/character/QuickToc';
import OverviewSection from '@/app/components/character/OverviewSection';
import SkillsSection from '@/app/components/character/SkillsSection';
import ChainDualSection from '@/app/components/character/ChainDualSection';
import EeTranscendSection from '@/app/components/character/EeTranscendSection';
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
  ee,
  reco,
  tags,
  weapons,
  amulets,
  talismans,
  sets,
}: Props) {
  const { t } = useI18n();

  const hasEeOrTranscend = !!ee || !!character.transcend;
  const hasChainPassive = !!character.skills.SKT_CHAIN_PASSIVE;

  const sections = useMemo<TocSection[]>(() => {
    return [
      { id: 'overview', label: t('page.character.toc.overview') },
      hasEeOrTranscend && { id: 'ee-transcend', label: t('page.character.toc.ee_transcend') },
      { id: 'skills', label: t('page.character.toc.skills') },
      hasChainPassive && { id: 'chain-dual', label: t('page.character.toc.chain_dual') },
      { id: 'gear', label: t('page.character.toc.gear') },
    ].filter(Boolean) as TocSection[];
  }, [t, hasEeOrTranscend, hasChainPassive]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 md:px-6">
      <QuickToc sections={sections} />

      <OverviewSection
        character={character}
        profile={profile}
        tags={tags}
      />

      {hasEeOrTranscend && (
        <EeTranscendSection
          character={character}
          ee={ee}
        />
      )}

      <SkillsSection character={character} />

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

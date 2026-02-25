import type { ComponentType } from 'react';
import type { CategoryViewProps } from './types';
import AdventureList from './AdventureList';
import AdventureLicenseList from './AdventureLicenseList';
import JointChallengeList from './JointChallengeList';
import WorldBossList from './WorldBossList';
import GuildRaidList from './GuildRaidList';
import SpecialRequestList from './SpecialRequestList';
import IrregularExterminationList from './IrregularExterminationList';
import MonadGateList from './MonadGateList';
import SkywardTowerList from './SkywardTowerList';

const categoryViews: Record<string, ComponentType<CategoryViewProps>> = {
  'adventure': AdventureList,
  'adventure-license': AdventureLicenseList,
  'joint-challenge': JointChallengeList,
  'world-boss': WorldBossList,
  'guild-raid': GuildRaidList,
  'special-request': SpecialRequestList,
  'irregular-extermination': IrregularExterminationList,
  'monad-gate': MonadGateList,
  'skyward-tower': SkywardTowerList,
};

export function getCategoryView(category: string): ComponentType<CategoryViewProps> | null {
  return categoryViews[category] ?? null;
}

export type { CategoryViewProps } from './types';

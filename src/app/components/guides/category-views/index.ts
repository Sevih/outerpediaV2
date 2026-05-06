import type { ReactNode } from 'react';
import type { CategoryViewProps } from './types';
import AdventureList from './AdventureList';
import AdventureLicenseList from './AdventureLicenseList';
import JointChallengeList from './JointChallengeList';
import WorldBossList from './WorldBossList';
import DimensionalSingularityList from './DimensionalSingularityList';
import GuildRaidList from './GuildRaidList';
import SpecialRequestList from './SpecialRequestList';
import IrregularExterminationList from './IrregularExterminationList';
import MonadGateList from './MonadGateList';
import SkywardTowerList from './SkywardTowerList';

type CategoryView = (props: CategoryViewProps) => ReactNode | Promise<ReactNode>;

const categoryViews: Record<string, CategoryView> = {
  'adventure': AdventureList,
  'adventure-license': AdventureLicenseList,
  'joint-challenge': JointChallengeList,
  'world-boss': WorldBossList,
  'dimensional-singularity': DimensionalSingularityList,
  'guild-raid': GuildRaidList,
  'special-request': SpecialRequestList,
  'irregular-extermination': IrregularExterminationList,
  'monad-gate': MonadGateList,
  'skyward-tower': SkywardTowerList,
};

export function getCategoryView(category: string): CategoryView | null {
  return categoryViews[category] ?? null;
}

export type { CategoryViewProps } from './types';

import type { ComponentType } from 'react';
import type { CategoryViewProps } from './types';
import AdventureList from './AdventureList';
import AdventureLicenseList from './AdventureLicenseList';
import JointChallengeList from './JointChallengeList';
import WorldBossList from './WorldBossList';
import GuildRaidList from './GuildRaidList';

const categoryViews: Record<string, ComponentType<CategoryViewProps>> = {
  'adventure': AdventureList,
  'adventure-license': AdventureLicenseList,
  'joint-challenge': JointChallengeList,
  'world-boss': WorldBossList,
  'guild-raid': GuildRaidList,
};

export function getCategoryView(category: string): ComponentType<CategoryViewProps> | null {
  return categoryViews[category] ?? null;
}

export type { CategoryViewProps } from './types';

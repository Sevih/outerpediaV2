import type { ComponentType } from 'react';
import type { CategoryViewProps } from './types';
import AdventureList from './AdventureList';
import AdventureLicenseList from './AdventureLicenseList';

const categoryViews: Record<string, ComponentType<CategoryViewProps>> = {
  'adventure': AdventureList,
  'adventure-license': AdventureLicenseList,
};

export function getCategoryView(category: string): ComponentType<CategoryViewProps> | null {
  return categoryViews[category] ?? null;
}

export type { CategoryViewProps } from './types';

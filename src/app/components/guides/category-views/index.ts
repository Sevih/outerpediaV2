import type { ComponentType } from 'react';
import type { CategoryViewProps } from './types';
import AdventureList from './AdventureList';

const categoryViews: Record<string, ComponentType<CategoryViewProps>> = {
  'adventure': AdventureList,
};

export function getCategoryView(category: string): ComponentType<CategoryViewProps> | null {
  return categoryViews[category] ?? null;
}

export type { CategoryViewProps } from './types';

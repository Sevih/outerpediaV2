import type { ComponentType } from 'react';
import type { CategoryViewProps } from './types';

const categoryViews: Record<string, ComponentType<CategoryViewProps>> = {
  // Add custom category views here:
  // 'adventure': AdventureList,
};

export function getCategoryView(category: string): ComponentType<CategoryViewProps> | null {
  return categoryViews[category] ?? null;
}

export type { CategoryViewProps } from './types';

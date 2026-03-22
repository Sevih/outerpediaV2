import type { WithLocalizedFields } from './common';

type BaseEffect = {
  name: string;
  category: string;
  group?: string;
  label: string;
  description: string;
  icon: string;
};

export type Effect = WithLocalizedFields<
  WithLocalizedFields<BaseEffect, 'label'>,
  'description'
>;

export type SkillBuffEntry = {
  type: string;
  debuff: boolean;
  target: string;
};

export type SkillBuffData = Partial<
  Record<'s1' | 's2' | 's3' | 'chain' | 'chain_dual' | 'ee', SkillBuffEntry[]>
>;

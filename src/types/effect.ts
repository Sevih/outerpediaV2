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

import type { WithLocalizedFields } from './common';

type BaseTag = {
  label: string;
  image: string;
  desc: string;
  type: string;
};

export type Tag = WithLocalizedFields<
  WithLocalizedFields<BaseTag, 'label'>,
  'desc'
>;

export type TagMap = Record<string, Tag>;

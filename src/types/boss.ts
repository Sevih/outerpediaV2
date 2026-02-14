import type { LangMap } from './common';
import type { ElementType, ClassType } from './enums';

export type BossSkill = {
  name: LangMap;
  description: LangMap;
  type: string;
  icon: string;
  buff: string[];
  debuff: string[];
};

export type Boss = {
  ID: string;
  name: LangMap;
  element: ElementType;
  class: ClassType;
  skills: BossSkill[];
  BuffImmune: string;
  StatBuffImmune: string;
};

export type BossIndexEntry = {
  bossKey: string;
  modes: Record<string, {
    versions: Array<{
      id: string;
      label?: string;
    }>;
  }>;
};

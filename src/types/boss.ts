import type { LangMap } from './common';
import type { ElementType, ClassType } from './enums';

export type BossSkill = {
  name: LangMap;
  description: LangMap;
  type: string;
  icon: string;
  buff?: string[];
  debuff?: string[];
};

export type Boss = {
  id: string;
  Name: LangMap;
  Surname: LangMap | null;
  IncludeSurname: boolean;
  element: ElementType;
  class: ClassType;
  level: number;
  icons: string;
  skills: BossSkill[];
  BuffImmune: string;
  StatBuffImmune: string;
  location: {
    dungeon: LangMap;
    mode: LangMap;
    area_id: LangMap;
  };
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

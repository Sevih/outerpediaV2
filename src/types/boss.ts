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

export type BossIndexVersion = {
  id: string;
  label: LangMap;
  level: number;
};

export type BossIndexMode = {
  name: LangMap;
  versions: BossIndexVersion[];
};

export type BossIndexEntry = {
  name: LangMap;
  element: ElementType;
  class: ClassType;
  icons: string;
  modes: Record<string, BossIndexMode>;
};

/** Full boss index keyed by English boss name */
export type BossIndex = Record<string, BossIndexEntry>;

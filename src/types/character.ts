import type { WithLocalizedFields } from './common';
import type { ElementType, ClassType, RarityType, RoleType, SkillKey } from './enums';

export type GiftPreference = {
  type: string;
  favor: number;
};

export type SkillData = WithLocalizedFields<{
  name: string;
  description: string;
  CD: number;
  WGR: number;
  buff: string[];
  debuff: string[];
  offensive: boolean;
  target: string;
}, 'name' | 'description'>;

type BaseCharacter = {
  ID: string;
  Fullname: string;
  Rarity: RarityType;
  Element: ElementType;
  Class: ClassType;
  SubClass: string;
  VoiceActor: string;
  limited: boolean;
  tags: string[];
  gift: GiftPreference[];
  skills: Partial<Record<SkillKey, SkillData>>;
  rank: string;
  role: RoleType;
};

export type Character = WithLocalizedFields<
  WithLocalizedFields<BaseCharacter, 'Fullname'>,
  'VoiceActor'
>;

/** Lightweight character entry for indexes/lists */
export type CharacterIndex = WithLocalizedFields<{
  ID: string;
  Fullname: string;
  slug: string;
  Element: ElementType;
  Class: ClassType;
  Rarity: RarityType;
  role: RoleType;
}, 'Fullname'>;

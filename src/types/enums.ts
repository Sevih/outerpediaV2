export type ElementType = 'Fire' | 'Water' | 'Earth' | 'Light' | 'Dark';
export const ELEMENTS: ElementType[] = ['Fire', 'Water', 'Earth', 'Light', 'Dark'];

export type ClassType = 'Striker' | 'Defender' | 'Ranger' | 'Healer' | 'Mage';
export const CLASSES: ClassType[] = ['Striker', 'Defender', 'Ranger', 'Healer', 'Mage'];

export type SubClassType =
  | 'Attacker' | 'Bruiser'
  | 'Sweeper' | 'Phalanx'
  | 'Tactician' | 'Vanguard'
  | 'Sage' | 'Reliever'
  | 'Wizard' | 'Enchanter';

export const SUBCLASSES: Record<ClassType, [SubClassType, SubClassType]> = {
  Striker: ['Attacker', 'Bruiser'],
  Defender: ['Sweeper', 'Phalanx'],
  Ranger: ['Tactician', 'Vanguard'],
  Healer: ['Sage', 'Reliever'],
  Mage: ['Wizard', 'Enchanter'],
};

export type ChainType = 'Start' | 'Join' | 'Finish';
export const CHAIN_TYPES: ChainType[] = ['Start', 'Join', 'Finish'];

export type RarityType = 1 | 2 | 3;
export const RARITIES: RarityType[] = [1, 2, 3];

export type RoleType = 'dps' | 'support' | 'sustain';
export const ROLES: RoleType[] = ['dps', 'support', 'sustain'];

export type SkillKey =
  | 'SKT_FIRST'
  | 'SKT_SECOND'
  | 'SKT_ULTIMATE'
  | 'SKT_CHAIN_PASSIVE'
  | 'DUAL_ATTACK'
  | 'EXCLUSIVE_EQUIP';

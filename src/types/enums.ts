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

export const SKILL_SOURCES: { key: SkillKey; labelKey: string }[] = [
  { key: 'SKT_FIRST', labelKey: 'characters.filters.sources.skill1' },
  { key: 'SKT_SECOND', labelKey: 'characters.filters.sources.skill2' },
  { key: 'SKT_ULTIMATE', labelKey: 'characters.filters.sources.skill3' },
  { key: 'SKT_CHAIN_PASSIVE', labelKey: 'characters.filters.sources.chainPassive' },
  { key: 'DUAL_ATTACK', labelKey: 'characters.filters.sources.dualAttack' },
  { key: 'EXCLUSIVE_EQUIP', labelKey: 'characters.filters.sources.exclusiveEquip' },
];

// ── Chain type labels ──

export const CHAIN_TYPE_LABELS: Record<ChainType, string> = {
  Start: 'Starter',
  Join: 'Companion',
  Finish: 'Finisher',
};

// ── Gifts ──

export type GiftType = 'Science' | 'Luxury' | 'Magic Tool' | 'Craftwork' | 'Natural Object';
export const GIFTS: GiftType[] = ['Science', 'Luxury', 'Magic Tool', 'Craftwork', 'Natural Object'];

export const GIFT_LABELS: Record<GiftType, string> = {
  Science: 'science',
  Luxury: 'luxury',
  'Magic Tool': 'magicTool',
  Craftwork: 'craftwork',
  'Natural Object': 'naturalObject',
};

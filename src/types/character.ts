import type { WithLocalizedFields } from './common';
import type { ElementType, ClassType, RarityType, RoleType, ChainType, SkillKey } from './enums';

// ── Skill types ──

/** Localized description levels (keys: "1"-"5" with _jp/_kr/_zh suffixes) */
type LocalizedLevels = Record<string, string>;

/** Localized enhancement levels (keys: "2"-"5" with _jp/_kr/_zh suffixes, values are string arrays) */
type LocalizedEnhancements = Record<string, string[]>;

export type BurnEffect = {
  effect: string;
  effect_jp?: string;
  effect_kr?: string;
  effect_zh?: string;
  cost: number;
  level: number;
  offensive: boolean;
  target: string;
};

export type SkillData = WithLocalizedFields<{
  name: string;
  NameIDSymbol: string;
  IconName: string;
  SkillType: string;
  true_desc_levels: LocalizedLevels;
  enhancement: LocalizedEnhancements;
  cd: string | null;
  wgr: number;
  wgr_dual?: number;
  buff: string[];
  debuff: string[];
  offensive: boolean;
  target: string;
  burnEffect?: Record<string, BurnEffect>;
  // Dual attack fields (chain passive only)
  dual_offensive?: boolean;
  dual_target?: string;
  dual_buff?: string[];
  dual_debuff?: string[];
}, 'name'>;

// ── Skill priority ──

export type SkillPriority = {
  First?: { prio: number };
  Second?: { prio: number };
  Ultimate?: { prio: number };
};

// ── Transcendence ──

/** Transcendence levels 1-6 with localized descriptions (keys: "1"-"6" with _jp/_kr/_zh suffixes) */
export type Transcendence = Record<string, string | null>;

// ── Character ──

type BaseCharacter = {
  ID: string;
  Fullname: string;
  Rarity: RarityType;
  Element: ElementType;
  Class: ClassType;
  SubClass: string;
  Chain_Type: ChainType;
  rank: string;
  rank_pvp?: string;
  role: RoleType;
  gift: string;
  video?: string;
  VoiceActor: string;
  limited?: boolean;
  tags?: string[];
  skill_priority?: SkillPriority;
  transcend?: Transcendence;
  skills: Partial<Record<SkillKey, SkillData>>;
};

export type Character = WithLocalizedFields<
  WithLocalizedFields<BaseCharacter, 'Fullname'>,
  'VoiceActor'
>;

/** Lightweight character entry (value in the ID-keyed index) */
export type CharacterIndex = WithLocalizedFields<{
  Fullname: string;
  slug: string;
  Element: ElementType;
  Class: ClassType;
  Rarity: RarityType;
  role: RoleType;
  Chain_Type: ChainType;
  tags: string[];
}, 'Fullname'>;

/** ID-keyed character index map */
export type CharacterIndexMap = Record<string, CharacterIndex>;

/** English Fullname → character ID reverse map */
export type CharacterNameToIdMap = Record<string, string>;

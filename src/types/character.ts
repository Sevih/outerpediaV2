import type { WithLocalizedFields, LangMap } from './common';
import type { ElementType, ClassType, RarityType, RoleType, ChainType, SkillKey } from './enums';

// ── Skill types ──

/** Localized description levels (keys: "1"-"5" with  suffixes) */
type LocalizedLevels = Record<string, string>;

/** Localized enhancement levels (keys: "2"-"5" with  suffixes, values are string arrays) */
type LocalizedEnhancements = Record<string, string[]>;

export type BurnEffect = WithLocalizedFields<{
  effect: string;
  cost: number;
  level: number;
  offensive: boolean;
  target: string;
}, 'effect'>;

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

/** Transcendence levels 1-6 with localized descriptions (keys: "1"-"6" with suffixes) */
export type Transcendence = Record<string, string | null>;

// ── Character profile (bio data from character-profiles.json) ──

export type CharacterProfile = {
  fullname: LangMap;
  birthday?: string;
  height?: string;
  weight?: string;
  story?: LangMap;
};

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
  hasCoreFusion?: boolean;
  coreFusionId?: string;
  fusionType?: string;
  originalCharacter?: string;
  fusionRequirements?: {
    transcendence: number;
    material: { id: string; quantity: number };
  };
  fusionLevels?: {
    level: number;
    requireItemID: string;
    skillUpgrades: Record<string, { value: string; level: string | null }>;
  }[];
};

export type Character = WithLocalizedFields<
  WithLocalizedFields<BaseCharacter, 'Fullname'>,
  'VoiceActor'
>;

// ── Character stats (from generated/character-stats.json) ──

export type StatsStep = {
  ATK: number;
  DEF: number;
  HP: number;
  SPD: number;
  EFF: number;
  RES: number;
  CHC: number;
  CHD: number;
  DMG_RED: number;
  DMG_INC: number;
  premium_value: number;
};

export type StatsPremium = {
  skill_23: string;
  buffID: string;
  stat: string;
  applyingType: 'OAT_RATE' | 'OAT_ADD';
  rawValue: number;
};

export type CharacterStats = {
  info: {
    id: string;
    class: string;
    subclass: string;
    element: string;
    star: string;
  };
  premium: StatsPremium;
  steps: Record<string, StatsStep>;
};

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

/** Pros & cons editorial data for a character */
export type CharacterProsCons = {
  pros: LangMap[];
  cons: LangMap[];
};

/** A synergy partner group (shared reason for 1+ heroes) */
export type CharacterPartner = {
  hero: string[];
  reason: LangMap;
};

/** Synergy / partner data for a character */
export type CharacterSynergies = {
  partner: CharacterPartner[];
};

/** Enriched character entry for the list page (includes filter data) */
export type CharacterListEntry = WithLocalizedFields<{
  ID: string;
  Fullname: string;
  slug: string;
  Element: ElementType;
  Class: ClassType;
  SubClass: string;
  Rarity: RarityType;
  role: RoleType;
  rank: string;
  rank_pvp?: string;
  rank_by_transcend?: Record<string, string>;
  role_by_transcend?: Record<string, string>;
  Chain_Type: ChainType;
  gift: string;
  tags: string[];
  buff: string[];
  debuff: string[];
  effectsBySource: Partial<Record<SkillKey, { buff: string[]; debuff: string[] }>>;
}, 'Fullname'>;

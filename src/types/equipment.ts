import type { WithLocalizedFields, LangMap } from './common';
import type { ClassType } from './enums';
import type { ItemRarity } from '@/lib/theme';

// ── Weapon / Amulet ──

type BaseEquipGear = {
  /** ItemID from the game (`ItemTemplet.ID`). Disambiguates items that share the same name + rarity but have different base stats. */
  id?: string;
  name: string;
  type: string;
  rarity: ItemRarity;
  image: string;
  effect_name: string | null;
  effect_desc1: string | null;
  effect_desc4: string | null;
  effect_icon: string | null;
  class: ClassType | null;
  mainStats: string[] | null;
  source?: string;
  boss?: string | string[];
  level: number;
};

export type Weapon = WithLocalizedFields<
  WithLocalizedFields<
    WithLocalizedFields<BaseEquipGear, 'name'>,
    'effect_name'
  >,
  'effect_desc1' | 'effect_desc4'
>;

export type Amulet = Weapon;

// ── Talisman ──

type BaseTalisman = {
  name: string;
  type: string;
  rarity: ItemRarity;
  image: string;
  effect_name: string;
  effect_desc1: string;
  effect_desc4: string;
  effect_icon: string;
  level: number;
  source?: string;
  boss?: string | string[];
};

export type Talisman = WithLocalizedFields<
  WithLocalizedFields<
    WithLocalizedFields<BaseTalisman, 'name'>,
    'effect_name'
  >,
  'effect_desc1' | 'effect_desc4'
>;

// ── Armor Set ──

type BaseArmorSet = {
  /** Set group id (game) — matches the solver's `setId` / `armorSetId`. */
  id: string;
  name: string;
  rarity: ItemRarity;
  set_icon: string;
  effect_2_1: string;
  effect_4_1: string;
  effect_2_4: string;
  effect_4_4: string;
  class: ClassType | null;
  source?: string;
  boss?: string | string[];
  image_prefix: string;
};

export type ArmorSet = WithLocalizedFields<
  BaseArmorSet,
  'name' | 'effect_2_1' | 'effect_4_1' | 'effect_2_4' | 'effect_4_4'
>;

// ── Exclusive Equipment ──

type BaseExclusiveEquipment = {
  name: string;
  mainStat: string;
  effect: string;
  effect10: string;
  icon_effect?: string;
  rank: string;
  rank10: string;
  buff: string[];
  debuff: string[];
};

export type ExclusiveEquipment = WithLocalizedFields<
  BaseExclusiveEquipment,
  'name' | 'mainStat' | 'effect' | 'effect10'
>;

// ── Source / Drop ──

export type EquipmentCategory = 'weapon' | 'amulet' | 'set' | 'talisman';

export type SourceDropInfo = {
  source: string | null;
  boss: string | string[] | null;
  sourceLabel: string;
};

/** Lightweight boss info for equipment source display (keyed by EN boss name) */
export type BossDisplayInfo = {
  name: LangMap;
  icons: string;
  element: string;
  source: LangMap;
  /** Path to boss guide (e.g. "/guides/special-request/amadeus"), if a guide exists */
  guidePath?: string;
};

export type BossDisplayMap = Record<string, BossDisplayInfo>;

/** Source filter option for equipment list page (computed server-side from actual data) */
export type SourceFilterOption = {
  key: string;
  bossKeys: string[];
  i18nKey?: string;
};

export type EquipmentDropEntry = {
  name: string;
  category: EquipmentCategory;
  class: ClassType | null;
  rarity: ItemRarity;
};

// ── Gear Recommendations ──

export type RecoGearEntry = { name: string; mainStat?: string };
export type RecoSetEntry = { name: string; count: number };

export type RecoBuild = WithLocalizedFields<{
  Weapon?: RecoGearEntry[];
  Amulet?: RecoGearEntry[];
  Set?: (RecoSetEntry[] | string)[];
  Talisman?: string[] | string;
  SubstatPrio?: string;
  Note?: string;
}, 'Note'>;

export type CharacterReco = Record<string, RecoBuild>;

export type ResolvedRecoBuild = WithLocalizedFields<{
  Weapon?: RecoGearEntry[];
  Amulet?: RecoGearEntry[];
  Set?: RecoSetEntry[][];
  Talisman?: string[];
  SubstatPrio?: string;
  Note?: string;
}, 'Note'>;

export type ResolvedCharacterReco = Record<string, ResolvedRecoBuild>;

export type RecoPresets = {
  talismans: Record<string, string[]>;
  sets: Record<string, RecoSetEntry[]>;
  substats: Record<string, string>;
};

/** A recommended gear piece, resolved to the shared game identifiers the solver consumes. */
export type RecoGearStat = {
  name: string;
  /** ItemTemplet.ID — matches the solver's `GearPiece.itemId`. Null if the name didn't resolve. */
  itemId: number | null;
  /** Icon filename for display. Null if unresolved. */
  effectIcon: string | null;
  /** Canonical engine stat keys (atkPct, pen, critDmg…), alternatives split out. */
  mainStat: string[];
};

/** A recommended set, resolved to the shared game set id the solver consumes. */
export type RecoSetStat = {
  name: string;
  /** sets.json id — matches the solver's `setId` / `armorSetId`. Null if unresolved. */
  setId: string | null;
  count: number;
};

/**
 * A single build, fully structured and aligned to the solver's game vocabulary.
 * - Weapon/Amulet: recommended gear pieces with itemId, icon and canonical main stats.
 * - Set: each entry is a set combo (one or two sets with their required count + setId).
 * - SubstatPrio: ordered tiers of canonical stat keys, each tier a list of tied stats.
 */
export type StructuredRecoBuild = {
  Weapon?: RecoGearStat[];
  Amulet?: RecoGearStat[];
  Set?: RecoSetStat[][];
  SubstatPrio?: string[][];
};

/** Structured recos for a character, keyed by build name. */
export type StructuredCharacterReco = {
  id: string;
  builds: Record<string, StructuredRecoBuild>;
};

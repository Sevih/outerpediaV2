import type { WithLocalizedFields } from './common';
import type { ClassType } from './enums';
import type { ItemRarity } from '@/lib/theme';

// ── Weapon / Amulet ──

type BaseEquipGear = {
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
  boss?: string;
  mode: string | null;
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
  level: string;
  source: string | null;
  boss: string | null;
  mode: string | null;
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
  name: string;
  rarity: ItemRarity;
  set_icon: string;
  effect_2_1: string;
  effect_4_1: string;
  effect_2_4: string;
  effect_4_4: string;
  class: ClassType | null;
  source: string;
  boss: string;
  mode: string | null;
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
  icon_effect: string;
  rank: string;
  buff: string[];
  debuff: string[];
};

export type ExclusiveEquipment = WithLocalizedFields<
  BaseExclusiveEquipment,
  'name' | 'mainStat' | 'effect' | 'effect10'
>;

// ── Gear Recommendations ──

export type RecoGearEntry = { name: string; mainStat?: string };
export type RecoSetEntry = { name: string; count: number };

export type RecoBuild = {
  Weapon?: RecoGearEntry[];
  Amulet?: RecoGearEntry[];
  Set?: (RecoSetEntry[] | string)[];
  Talisman?: string[] | string;
  SubstatPrio?: string;
  Note?: string;
};

export type CharacterReco = Record<string, RecoBuild>;

export type ResolvedRecoBuild = {
  Weapon?: RecoGearEntry[];
  Amulet?: RecoGearEntry[];
  Set?: RecoSetEntry[][];
  Talisman?: string[];
  SubstatPrio?: string;
  Note?: string;
};

export type ResolvedCharacterReco = Record<string, ResolvedRecoBuild>;

export type RecoPresets = {
  talismans: Record<string, string[]>;
  sets: Record<string, RecoSetEntry[]>;
};

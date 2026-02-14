import type { WithLocalizedFields } from './common';

type BaseEquipment = {
  ID: string;
  name: string;
  description: string;
  rarity: string;
  icon: string;
};

export type Weapon = WithLocalizedFields<
  WithLocalizedFields<BaseEquipment, 'name'>,
  'description'
>;

export type Amulet = WithLocalizedFields<
  WithLocalizedFields<BaseEquipment, 'name'>,
  'description'
>;

export type Talisman = WithLocalizedFields<
  WithLocalizedFields<BaseEquipment, 'name'>,
  'description'
>;

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
  WithLocalizedFields<BaseExclusiveEquipment, 'name'>,
  'effect'
>;

export type ArmorSet = WithLocalizedFields<{
  name: string;
  set2: string;
  set4: string;
  icon: string;
}, 'name' | 'set2' | 'set4'>;

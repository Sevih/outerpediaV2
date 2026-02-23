import type { LangMap } from './common';
import type { ElementType, ClassType } from './enums';

/** Lightweight boss info embedded in tower data (no skills) */
export type TowerBossInfo = {
  id: string;
  name: LangMap;
  element: ElementType;
  class: ClassType;
  icons: string;
};

/** A fixed floor (elemental, normal, hard towers + fixed VH floors) */
export type TowerFloorFixed = {
  floor: number;
  boss: TowerBossInfo;
  restrictions: LangMap[];
};

/** A random floor (VH tower — multiple possible boss+restriction sets) */
export type TowerFloorRandom = {
  floor: number;
  random: true;
  sets: {
    boss: TowerBossInfo;
    restrictions: LangMap[];
  }[];
};

export type TowerFloor = TowerFloorFixed | TowerFloorRandom;

/** Full tower data (one JSON per tower) */
export type TowerData = {
  floors: TowerFloor[];
  disclaimer?: LangMap;
};

/** Type guard for random floors */
export function isRandomFloor(floor: TowerFloor): floor is TowerFloorRandom {
  return 'random' in floor && floor.random === true;
}

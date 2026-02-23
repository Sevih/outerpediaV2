import type { LangMap } from './common';

/** A fixed floor (elemental, normal, hard towers + fixed VH floors) */
export type TowerFloorFixed = {
  floor: number;
  boss_id: string;
  minions?: string[];
  restrictions: string[];
  recommended?: string[];
};

/** A random floor (VH tower — multiple possible boss+restriction sets) */
export type TowerFloorRandom = {
  floor: number;
  random: true;
  sets: {
    boss_id: string;
    minions?: string[];
    restrictions: string[];
    recommended?: string[];
  }[];
};

/** Restriction index: maps restriction IDs to localized labels */
export type TowerRestrictionMap = Record<string, LangMap>;

export type TowerFloor = TowerFloorFixed | TowerFloorRandom;

/** One restriction+recommendation combo for a pool boss */
export type TowerRestrictionSet = {
  restrictions: string[];
  recommended?: string[];
};

/** A boss+restrictions entry in a shared random pool (VH tower) */
export type TowerPoolEntry = {
  boss_id: string;
  minions?: string[];
  restrictionSets: TowerRestrictionSet[];
};

/** Full tower data (one JSON per tower) */
export type TowerData = {
  floors: TowerFloor[];
  disclaimer?: LangMap;
  /** Pool of bosses randomly assigned across floors (VH only) */
  randomPool?: TowerPoolEntry[];
};

/** Type guard for random floors */
export function isRandomFloor(floor: TowerFloor): floor is TowerFloorRandom {
  return 'random' in floor && floor.random === true;
}

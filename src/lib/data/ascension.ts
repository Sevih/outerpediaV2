import ascensionView from '@data/equipment/ascension-view.json';
import type { LangMap } from '@/types/common';

// ── Types (mirror the legacy `helpers.tsx` exports for drop-in replacement) ──

export type Grade = 'C' | 'B' | 'A' | 'S' | 'S+';
export const GRADES: readonly Grade[] = ['C', 'B', 'A', 'S', 'S+'];

export type AscensionStep = {
  from: number;
  to: number;
  gold: number;
  chip: number;
  hammer: number;
  success: number;
  factor: number;
  /** Main-stat gain at this step, expressed as a fraction of the +10 stat value. */
  mainStatPct: number;
  unlocksBonus?: boolean;
};

export type AscensionInit = {
  gold: number;
  chip: number;
  hammer: number;
  successRate: number;
  factorOP: number;
  addMaxLevel: number;
  addReforgeCount: number;
};

export type AscensionReroll = {
  gold: number;
  cartridge: number;
  successRate: number;
};

export type GradeRow = {
  range: string;
  rangeAlt?: string;
  /** Percentage of total weight (0-100). */
  rate: number;
};

export type BonusEffect = {
  key: string;
  /** Total weight out of 10000. */
  rate: number;
  name: LangMap;
  grades: Record<Grade, GradeRow>;
  splitLabels?: { primary: string; alt: string };
};

type AscensionView = {
  totalRate: number;
  grades: readonly Grade[];
  init: AscensionInit;
  steps: readonly AscensionStep[];
  reroll: AscensionReroll;
  activation: { mainStatPct: number; totalMainStatPct: number };
  groupBySlot: Record<string, string>;
  options: Record<string, readonly BonusEffect[]>;
};

const data = ascensionView as unknown as AscensionView;

// ── Public exports (match the legacy names from helpers.tsx) ──

export const ASCENSION_TOTAL_RATE: number = data.totalRate;
export const ASCENSION_INIT: AscensionInit = data.init;
export const ASCENSION_STEPS: readonly AscensionStep[] = data.steps;
export const ASCENSION_REROLL: AscensionReroll = data.reroll;
export const ASCENSION_ACTIVATION_MAIN_STAT_PCT: number = data.activation.mainStatPct;
export const ASCENSION_TOTAL_MAIN_STAT_PCT: number = data.activation.totalMainStatPct;

/** Group 30000 — Weapon + Accessory bonus options. */
export const ASCENSION_BONUS_OFFENSIVE: readonly BonusEffect[] = data.options['30000'];
/** Group 31000 — Helmet + Armor + Gloves + Shoes bonus options. */
export const ASCENSION_BONUS_DEFENSIVE: readonly BonusEffect[] = data.options['31000'];

/** Pick the right bonus pool for an equipment slot key (`weapons`, `Helmet`, …). */
export function getBonusEffectsForSlot(slot: string): readonly BonusEffect[] {
  const groupID = data.groupBySlot[slot];
  return groupID ? data.options[groupID] ?? [] : [];
}

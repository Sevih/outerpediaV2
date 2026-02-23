import type { WithLocalizedFields } from './common';
import type { SuffixLang } from '@/lib/i18n/config';

export type NoteEntry =
  | { type: 'p'; string: string }
  | { type: 'ul'; items: string[] }
  | { type: 'turn-order'; order: { character: string; speed: number }[]; note?: string };

export type RequirementEquipment = {
  weapon?: string[];
  amulet?: string[];
  talisman?: string[];
  set?: string[];
  ee?: string[];
};

export type RequirementStats = {
  spd?: string;
  eff?: string;
  atk?: string;
  def?: string;
  hp?: string;
  chc?: string;
  chd?: string;
  trans?: string;
};

type BaseRequirementEntry = {
  character: string;
  items?: string[];
  stats?: RequirementStats;
  equipment?: RequirementEquipment;
  prio?: string[];
  notes?: string[];
};

export type RequirementEntry = WithLocalizedFields<BaseRequirementEntry, 'notes'>;

type BaseRequirementsData = {
  entries: RequirementEntry[];
  note?: string;
};

export type RequirementsData = WithLocalizedFields<BaseRequirementsData, 'note'>;

type BaseStageData = {
  team: string[][];
  note?: NoteEntry[];
  requirements?: RequirementsData;
  icon?: string;
};

export type StageData = BaseStageData & {
  [P in `note_${SuffixLang}`]?: NoteEntry[];
};

export type TeamData = {
  [key: string]: StageData;
};

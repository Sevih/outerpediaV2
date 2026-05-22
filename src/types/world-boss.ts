import type { LangMap } from './common';

export type WorldBossMode = 'Normal' | 'Hard' | 'Very Hard' | 'Extreme';

/** Multi-mode boss reference: two boss columns, each mapping difficulty → boss id */
export type WorldBossConfig = {
  boss1Key: string;
  boss2Key: string;
  boss1Ids: Partial<Record<WorldBossMode, string>>;
  boss2Ids: Partial<Record<WorldBossMode, string>>;
};

/** Default world boss config (root config.json): the multi-mode boss reference */
export type WorldBossDefaultConfig = {
  boss: WorldBossConfig;
};

/** Boss snapshot reference for one guide version:
 *  `version` selects archived files `${id}-${version}.json` for every mode id
 *  (omit / null for the latest, suffix-less files). */
export type WorldBossVersionBossRef = {
  version?: number;
};

/** Per-version override (version config.json): label + optional boss snapshot */
export type WorldBossVersionOverride = {
  label: LangMap;
  boss?: WorldBossVersionBossRef;
};

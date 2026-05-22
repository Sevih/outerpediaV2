import type { LangMap } from './common';

/** Default joint challenge config (root config.json): the base boss id */
export type JointChallengeDefaultConfig = {
  boss: { id: string };
};

/** Boss reference for one guide version.
 *  - `version` selects an archived snapshot file `${id}-${version}.json`
 *    (omit / null for the latest, suffix-less file).
 *  - `id` optionally overrides the default boss id (rare). */
export type JointChallengeBossRef = {
  id?: string;
  version?: number;
};

/** Per-version override (version config.json): label + optional boss ref */
export type JointChallengeVersionOverride = {
  label: LangMap;
  boss?: JointChallengeBossRef;
};

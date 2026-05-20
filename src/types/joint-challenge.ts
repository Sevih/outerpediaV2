import type { LangMap } from './common';

/** Default joint challenge config: just the boss reference */
export type JointChallengeDefaultConfig = {
  boss: { id: string };
};

/** Per-version override: label is required, boss optionally overrides the default.
 *  bossSuffix (e.g. "-1") loads legacy snapshot files: `${id}${suffix}.json`. */
export type JointChallengeVersionOverride = {
  label: LangMap;
  bossSuffix?: string;
} & Partial<JointChallengeDefaultConfig>;

/** Resolved config after merging default + version override */
export type JointChallengeVersionConfig = {
  label: LangMap;
  bossSuffix?: string;
} & JointChallengeDefaultConfig;

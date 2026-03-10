import type { LangMap } from './common';
import type { SuffixLang } from '@/lib/i18n/config';
import type { NoteEntry, RequirementsData } from './team';

/** A single Geas entry from the global pool */
export type Geas = {
  IconName: string;
  text: LangMap;
  ratio: string;
  level: 1 | 2 | 3;
};

/** Geas pool keyed by string ID */
export type GeasPool = Record<string, Geas>;

/** One kill level unlocks one bonus geas and one malus geas */
export type GeasUnlock = {
  bonus: number;
  malus: number;
};

/** Default raid config: boss references + geas unlock tables */
export type GuildRaidDefaultConfig = {
  bossA: { id: string };
  bossB: { id: string };
  main: { id: string };
  geas: {
    bossA: Record<string, GeasUnlock>;
    bossB: Record<string, GeasUnlock>;
  };
};

/** Per-version override: label is required, everything else overrides defaults */
export type GuildRaidVersionOverride = {
  label: LangMap;
} & Partial<GuildRaidDefaultConfig>;

/** Resolved config after merging default + version override */
export type GuildRaidVersionConfig = {
  label: LangMap;
} & GuildRaidDefaultConfig;

/** Geas activation config for a Phase 2 team */
export type GeasActiveConfig = {
  bonus: number[];
  malus: number[];
};

/** Video reference */
export type GuildRaidVideo = {
  videoId: string;
  title: string;
  author?: string;
};

/** Phase 1 boss editorial data (per version) */
export type Phase1BossData = {
  recommended: { names: string[]; reason: LangMap }[];
  team: string[][];
  video?: GuildRaidVideo;
};

/** Phase 1 editorial data (per version) */
export type Phase1Data = {
  bossA: Phase1BossData;
  bossB: Phase1BossData;
};

/** Phase 2 team entry */
type BaseGuildRaidTeamEntry = {
  icon?: string;
  team: string[][];
  geasActive?: GeasActiveConfig;
  note?: NoteEntry[];
  video?: GuildRaidVideo;
  requirements?: RequirementsData;
};

export type GuildRaidTeamEntry = BaseGuildRaidTeamEntry & {
  [P in `note_${SuffixLang}`]?: NoteEntry[];
};

/** Phase 2 teams keyed by team label */
export type GuildRaidPhase2Data = Record<string, GuildRaidTeamEntry>;

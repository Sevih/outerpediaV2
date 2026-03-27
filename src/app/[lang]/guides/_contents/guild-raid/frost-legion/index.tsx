'use client';

import { GuildRaidGuide, type GuildRaidVersionData } from '@/app/components/guides/guild-raid';
import type { Boss } from '@/types/boss';
import type { LangMap } from '@/types/common';
import type {
  GeasPool,
  GuildRaidDefaultConfig,
  GuildRaidVersionConfig,
  GuildRaidVersionOverride,
  Phase1Data,
  GuildRaidPhase2Data,
} from '@/types/guild-raid';

/* -- Shared data ---------------------------------------------- */
import strings from './strings.json';
import defaultConfig from './config.json';
import geasPool from '@data/geas.json';

/* -- Version: 11-2025 ----------------------------------------- */
import v11_2025Override from './versions/11-2025/config.json';
import v11_2025Phase1 from './versions/11-2025/phase1.json';
import v11_2025Phase2 from './versions/11-2025/phase2.json';

/* -- Version: 05-2025 ----------------------------------------- */
import v05_2025Override from './versions/05-2025/config.json';
import v05_2025Phase1 from './versions/05-2025/phase1.json';
import v05_2025Phase2 from './versions/05-2025/phase2.json';

/* -- Typed JSON casts (JSON imports have literal types) -------- */
function loadBoss(id: string): Boss {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`@data/boss/${id}.json`) as Boss;
}
const defaults = defaultConfig as GuildRaidDefaultConfig;
const pool = geasPool as unknown as GeasPool;
const str = strings as Record<string, LangMap>;

/* -- Config merge + resolve ----------------------------------- */

function mergeConfig(override: GuildRaidVersionOverride): GuildRaidVersionConfig {
  return {
    label: override.label,
    bossA: override.bossA ?? defaults.bossA,
    bossB: override.bossB ?? defaults.bossB,
    main: override.main ?? defaults.main,
    geas: override.geas ?? defaults.geas,
  };
}

function resolve(
  override: GuildRaidVersionOverride,
  phase1: Phase1Data,
  phase2: GuildRaidPhase2Data,
): GuildRaidVersionData {
  const config = mergeConfig(override);
  return {
    label: config.label,
    bossA: loadBoss(config.bossA.id),
    bossB: loadBoss(config.bossB.id),
    bossMain: loadBoss(config.main.id),
    geasA: config.geas.bossA,
    geasB: config.geas.bossB,
    phase1,
    phase2,
  };
}

/* -- Main component ------------------------------------------- */

export default function FrostLegionGuide() {
  return (
    <GuildRaidGuide
      title={str.title}
      introduction={str.intro}
      pool={pool}
      defaultVersion="nov2025"
      versions={{
        nov2025: resolve(
          v11_2025Override as GuildRaidVersionOverride,
          v11_2025Phase1 as unknown as Phase1Data,
          v11_2025Phase2 as unknown as GuildRaidPhase2Data,
        ),
        may2025: resolve(
          v05_2025Override as GuildRaidVersionOverride,
          v05_2025Phase1 as unknown as Phase1Data,
          v05_2025Phase2 as unknown as GuildRaidPhase2Data,
        ),
      }}
    />
  );
}

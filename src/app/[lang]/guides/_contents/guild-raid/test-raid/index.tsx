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

/* -- Boss imports --------------------------------------------- */
import miniBossA from '@data/boss/440500174-9-1.json';
import miniBossB from '@data/boss/440500274-10-1.json';
import mainBoss from '@data/boss/440500079-B-1.json';
import geasPool from '@data/geas.json';

/* -- Version: 01-2026 ----------------------------------------- */
import v01_2026Override from './versions/01-2026/config.json';
import v01_2026Phase1 from './versions/01-2026/phase1.json';
import v01_2026Phase2 from './versions/01-2026/phase2.json';

/* -- Version: 07-2025 ----------------------------------------- */
import v07_2025Override from './versions/07-2025/config.json';
import v07_2025Phase1 from './versions/07-2025/phase1.json';
import v07_2025Phase2 from './versions/07-2025/phase2.json';

/* -- Typed JSON casts (JSON imports have literal types) -------- */
const bosses: Record<string, Boss> = {
  '440500174-9-1': miniBossA as unknown as Boss,
  '440500274-10-1': miniBossB as unknown as Boss,
  '440500079-B-1': mainBoss as unknown as Boss,
};
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
    bossA: bosses[config.bossA.id],
    bossB: bosses[config.bossB.id],
    bossMain: bosses[config.main.id],
    geasA: config.geas.bossA,
    geasB: config.geas.bossB,
    phase1,
    phase2,
  };
}

/* -- Main component ------------------------------------------- */

export default function TestRaidGuide() {
  return (
    <GuildRaidGuide
      title={str.title}
      introduction={str.intro}
      pool={pool}
      defaultVersion="jan2026"
      versions={{
        jan2026: resolve(
          v01_2026Override as GuildRaidVersionOverride,
          v01_2026Phase1 as unknown as Phase1Data,
          v01_2026Phase2 as unknown as GuildRaidPhase2Data,
        ),
        jul2025: resolve(
          v07_2025Override as GuildRaidVersionOverride,
          v07_2025Phase1 as unknown as Phase1Data,
          v07_2025Phase2 as unknown as GuildRaidPhase2Data,
        ),
      }}
    />
  );
}

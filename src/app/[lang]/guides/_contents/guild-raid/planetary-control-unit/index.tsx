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
import miniBossA from '@data/boss/440700174-11-1.json';
import miniBossB from '@data/boss/440700274-6-1.json';
import mainBoss from '@data/boss/440700079-B-1.json';
import geasPool from '@data/geas.json';

/* -- Version: 02-2026 ----------------------------------------- */
import v02_2026Override from './versions/02-2026/config.json';
import v02_2026Phase1 from './versions/02-2026/phase1.json';
import v02_2026Phase2 from './versions/02-2026/phase2.json';

/* -- Version: 08-2025 ----------------------------------------- */
import v08_2025Override from './versions/08-2025/config.json';
import v08_2025Phase1 from './versions/08-2025/phase1.json';
import v08_2025Phase2 from './versions/08-2025/phase2.json';

/* -- Typed JSON casts (JSON imports have literal types) -------- */
const bosses: Record<string, Boss> = {
  '440700174-11-1': miniBossA as unknown as Boss,
  '440700274-6-1': miniBossB as unknown as Boss,
  '440700079-B-1': mainBoss as unknown as Boss,
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

export default function PlanetaryControlUnitGuide() {
  return (
    <GuildRaidGuide
      title={str.title}
      introduction={str.intro}
      pool={pool}
      defaultVersion="feb2026"
      versions={{
        feb2026: resolve(
          v02_2026Override as GuildRaidVersionOverride,
          v02_2026Phase1 as unknown as Phase1Data,
          v02_2026Phase2 as unknown as GuildRaidPhase2Data,
        ),
        aug2025: resolve(
          v08_2025Override as GuildRaidVersionOverride,
          v08_2025Phase1 as unknown as Phase1Data,
          v08_2025Phase2 as unknown as GuildRaidPhase2Data,
        ),
      }}
    />
  );
}

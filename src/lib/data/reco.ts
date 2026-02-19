import type { CharacterReco, RecoBuild, RecoPresets, RecoSetEntry, ResolvedCharacterReco, ResolvedRecoBuild } from '@/types/equipment';

/** Resolve preset references in a CharacterReco into inline values */
export function resolveRecoPresets(
  reco: CharacterReco,
  presets: RecoPresets
): ResolvedCharacterReco {
  const resolved: ResolvedCharacterReco = {};
  for (const [buildName, build] of Object.entries(reco)) {
    resolved[buildName] = resolveBuild(build, presets);
  }
  return resolved;
}

function resolveBuild(build: RecoBuild, presets: RecoPresets): ResolvedRecoBuild {
  return {
    ...build,
    Talisman: resolveTalismans(build.Talisman, presets),
    Set: resolveSets(build.Set, presets),
  };
}

function resolveTalismans(
  val: string[] | string | undefined,
  presets: RecoPresets
): string[] | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') {
    const key = val.startsWith('$') ? val.slice(1) : val;
    return presets.talismans[key];
  }
  return val;
}

function resolveSets(
  val: (RecoSetEntry[] | string)[] | undefined,
  presets: RecoPresets
): RecoSetEntry[][] | undefined {
  if (!val) return undefined;
  return val.map(combo => {
    if (typeof combo === 'string') {
      return presets.sets[combo] ?? [];
    }
    return combo;
  });
}

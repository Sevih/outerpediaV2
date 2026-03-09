'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { EquipmentIcon } from '@/app/components/equipment';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { FilterPill } from '@/app/components/ui/FilterPills';
import Tabs from '@/app/components/ui/Tabs';
import type { Weapon, Amulet, ArmorSet } from '@/types/equipment';
import type { CharacterListEntry } from '@/types/character';
import type { TranslationKey } from '@/i18n/locales/en';
import type { GearFinderBuild } from '@/lib/data/equipment';

// ── Constants ──

const EQUIP_TYPES = ['weapon', 'amulet', 'set'] as const;
type EquipType = typeof EQUIP_TYPES[number];

const TYPE_I18N: Record<EquipType, TranslationKey> = {
  weapon: 'page.character.gear.weapon',
  amulet: 'page.character.gear.amulet',
  set: 'page.character.gear.set',
};

type Mode = 'reco' | 'free';
const MODES: Mode[] = ['reco', 'free'];
const MODE_I18N: Record<Mode, TranslationKey> = {
  reco: 'tools.gear-usage-finder.mode_reco' as TranslationKey,
  free: 'tools.gear-usage-finder.mode_free' as TranslationKey,
};
const MODE_DESC_I18N: Record<Mode, TranslationKey> = {
  reco: 'tools.gear-usage-finder.mode_reco.desc' as TranslationKey,
  free: 'tools.gear-usage-finder.mode_free.desc' as TranslationKey,
};

const WEAPON_MAIN_STATS = ['ATK%', 'HP%', 'DEF%'] as const;
const AMULET_MAIN_STATS = ['PEN%', 'SPD', 'ATK%', 'HP%', 'DEF%', 'EFF', 'DMG RED%', 'CHC', 'CHD', 'DMG UP%', 'RES', 'CDMG RED%'] as const;
const SUBSTATS = ['ATK', 'HP', 'DEF', 'SPD', 'CHC', 'CHD', 'EFF', 'RES', 'DMG UP%', 'DMG RED%', 'CDMG RED%'] as const;
const CLASSES = ['Striker', 'Defender', 'Ranger', 'Healer', 'Mage'] as const;

// ── Types ──

type MatchResult = {
  characterId: string;
  buildCount: number;
  score: number;
  mainStatMatch: boolean;
  matchedSubCount: number;
};

type Props = {
  weapons: Weapon[];
  amulets: Amulet[];
  sets: ArmorSet[];
  builds: GearFinderBuild[];
  characters: CharacterListEntry[];
};

// ── Gear card (same visual as MiniCards) ──

function GearCard({ name, image, rarity, effectIcon, classType }: {
  name: string; image: string; rarity: string;
  effectIcon?: string | null; classType?: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <EquipmentIcon src={image} rarity={rarity as never} alt={name} effectIcon={effectIcon} classType={classType} />
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-200">{name}</p>
    </div>
  );
}

export default function GearUsageFinderClient({
  weapons, amulets, sets, builds, characters,
}: Props) {
  const { lang, t, href } = useI18n();

  // ── State ──
  const [mode, setMode] = useState<Mode>('reco');
  const [equipType, setEquipType] = useState<EquipType>('weapon');
  const [classFilter, setClassFilter] = useState<string>(CLASSES[0]);
  const [selectedGear, setSelectedGear] = useState<string | null>(null);
  const [mainStat, setMainStat] = useState<string | null>(null);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);

  const charById = useMemo(() => {
    const map = new Map<string, CharacterListEntry>();
    for (const c of characters) map.set(c.ID, c);
    return map;
  }, [characters]);

  // ── Handlers ──
  const handleModeChange = (m: Mode) => {
    setMode(m);
    setSelectedGear(null);
    setMainStat(null);
    setSelectedSubs([]);
  };

  const handleTypeChange = (type: EquipType) => {
    setEquipType(type);
    setClassFilter(CLASSES[0]);
    setSelectedGear(null);
    setMainStat(null);
    setSelectedSubs([]);
  };

  const handleClassChange = (cls: string) => {
    setClassFilter(cls);
    setSelectedGear(null);
    setMainStat(null);
    setSelectedSubs([]);
  };

  const handleGearSelect = (name: string | null) => {
    setSelectedGear(name);
    setMainStat(null);
    setSelectedSubs([]);
  };

  const toggleSub = (sub: string) => {
    setSelectedSubs(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  // ── Names used in at least one build (reco mode only) ──
  const usedNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of builds) {
      for (const w of b.weapons) names.add(w.name);
      for (const a of b.amulets) names.add(a.name);
      for (const s of b.sets) names.add(s);
    }
    return names;
  }, [builds]);

  // ── Filtered gear (weapons/amulets by class; reco = only used in builds) ──
  const filteredGear = useMemo(() => {
    const source = equipType === 'weapon' ? weapons : equipType === 'amulet' ? amulets : [];
    return source.filter(g => g.class === classFilter && (mode === 'free' || usedNames.has(g.name)));
  }, [equipType, weapons, amulets, classFilter, usedNames, mode]);

  // ── Filtered sets (reco = only used in builds) ──
  const filteredSets = useMemo(() =>
    sets
      .filter(s => mode === 'free' || usedNames.has(s.name))
      .sort((a, b) => l(a, 'name', lang).localeCompare(l(b, 'name', lang))),
    [sets, usedNames, lang, mode],
  );

  // ── Available main stats for selected weapon/amulet ──
  const availableMainStats = useMemo(() => {
    if (!selectedGear || (equipType !== 'weapon' && equipType !== 'amulet')) return [];

    if (mode === 'free') {
      if (equipType === 'weapon') return [...WEAPON_MAIN_STATS];
      const amulet = amulets.find(a => a.name === selectedGear);
      return amulet?.mainStats ?? [...AMULET_MAIN_STATS];
    }

    // Reco mode: only stats actually used in builds
    const statsSet = new Set<string>();
    const field = equipType === 'weapon' ? 'weapons' : 'amulets';

    for (const build of builds) {
      for (const g of build[field]) {
        if (g.name === selectedGear) {
          for (const s of g.mainStats) statsSet.add(s);
        }
      }
    }

    const canonical = equipType === 'weapon' ? WEAPON_MAIN_STATS : AMULET_MAIN_STATS;
    return canonical.filter(s => statsSet.has(s));
  }, [selectedGear, equipType, builds, mode, amulets]);

  // ── Matching logic ──
  // Score: main stat match = 4 pts, each substat match = 1 pt
  const results = useMemo((): MatchResult[] => {
    const byChar = new Map<string, { score: number; mainStatMatch: boolean; subMatched: number; count: number }>();

    for (const build of builds) {
      const char = charById.get(build.characterId);
      if (!char) continue;

      let hasMainStatMatch = false;

      if (equipType === 'weapon' || equipType === 'amulet') {
        if (!selectedGear) continue;
        if (char.Class !== classFilter) continue;

        const field = equipType === 'weapon' ? 'weapons' : 'amulets';
        const gear = build[field].find(g => g.name === selectedGear);
        if (!gear) continue;

        if (mode === 'reco') {
          if (!mainStat || !gear.mainStats.includes(mainStat)) continue;
          hasMainStatMatch = true;
        } else if (mainStat) {
          hasMainStatMatch = gear.mainStats.includes(mainStat);
        }
      } else if (equipType === 'set') {
        if (!selectedGear) continue;
        if (!build.sets.includes(selectedGear)) continue;
      }

      let subMatched = 0;
      if (selectedSubs.length > 0 && build.substatPrio.length > 0) {
        for (const sub of selectedSubs) {
          if (build.substatPrio.includes(sub)) subMatched++;
        }
      }

      const score = (hasMainStatMatch ? 4 : 0) + subMatched;

      const prev = byChar.get(build.characterId);
      if (!prev || score > prev.score) {
        byChar.set(build.characterId, {
          score,
          mainStatMatch: hasMainStatMatch,
          subMatched,
          count: (prev?.count ?? 0) + 1,
        });
      } else {
        prev.count++;
      }
    }

    const matches: MatchResult[] = [];
    for (const [characterId, { score, mainStatMatch, subMatched, count }] of byChar) {
      matches.push({ characterId, buildCount: count, score, mainStatMatch, matchedSubCount: subMatched });
    }

    matches.sort((a, b) => b.score - a.score);
    return matches;
  }, [builds, charById, equipType, selectedGear, mainStat, classFilter, selectedSubs, mode]);

  // In reco mode, weapon/amulet needs gear + mainStat; in free mode, just gear
  const hasSelection = mode === 'reco'
    ? (equipType === 'weapon' || equipType === 'amulet' ? selectedGear !== null && mainStat !== null : selectedGear !== null)
    : selectedGear !== null;

  // In free mode, show substats after gear selection (no need for main stat first)
  const showSubstats = mode === 'reco'
    ? (equipType === 'set' ? selectedGear !== null : mainStat !== null)
    : selectedGear !== null;

  return (
    <div className="mx-auto max-w-250 space-y-5">
      {/* Mode selector */}
      <div className="space-y-2">
        <Tabs
          items={MODES}
          labels={MODES.map(m => t(MODE_I18N[m]))}
          value={mode}
          onChange={(v) => handleModeChange(v as Mode)}
          className="justify-center"
        />
        <p className="text-center text-xs text-zinc-400">
          {t(MODE_DESC_I18N[mode])}
        </p>
      </div>

      {/* Equipment type */}
      <div>
        <p className="mb-2 text-center text-xs uppercase tracking-wide text-zinc-300">
          {t('tools.gear-usage-finder.step_type' as TranslationKey)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {EQUIP_TYPES.map(type => (
            <FilterPill
              key={type}
              active={equipType === type}
              onClick={() => handleTypeChange(type)}
              className="h-9 px-4"
            >
              {t(TYPE_I18N[type])}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* ── Weapon / Amulet flow ── */}
      {(equipType === 'weapon' || equipType === 'amulet') && (
        <>
          {/* Class filter */}
          <div>
            <p className="mb-2 text-center text-xs uppercase tracking-wide text-zinc-300">
              {t('tools.gear-usage-finder.step_class' as TranslationKey)}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {CLASSES.map(cls => (
                <FilterPill
                  key={cls}
                  active={classFilter === cls}
                  onClick={() => handleClassChange(cls)}
                  className="h-9 w-9 px-0"
                  title={cls}
                >
                  <img
                    src={`/images/ui/class/CM_Class_${cls}.webp`}
                    alt={cls}
                    className="h-6 w-6 object-contain"
                  />
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Gear selection grid */}
          <div>
            <p className="mb-2 text-center text-xs uppercase tracking-wide text-zinc-300">
              {t(TYPE_I18N[equipType])}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-1.5">
              {filteredGear.map(g => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => handleGearSelect(selectedGear === g.name ? null : g.name)}
                  className={[
                    'rounded-lg p-1.5 transition cursor-pointer',
                    selectedGear === g.name
                      ? 'bg-sky-500/20 ring-1 ring-sky-500'
                      : 'hover:bg-zinc-800/60',
                  ].join(' ')}
                >
                  <GearCard
                    name={l(g, 'name', lang)}
                    image={`equipment/${g.image}`}
                    rarity={g.rarity}
                    effectIcon={g.effect_icon}
                    classType={g.class}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Main stat */}
          {selectedGear && availableMainStats.length > 0 && (
            <div>
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-zinc-300">
                {t('tools.gear-usage-finder.step_mainstat' as TranslationKey)}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {availableMainStats.map(stat => (
                  <FilterPill
                    key={stat}
                    active={mainStat === stat}
                    onClick={() => setMainStat(mainStat === stat ? null : stat)}
                    className="h-8 px-3"
                  >
                    {stat}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}

          {/* Substats */}
          {showSubstats && (
            <div>
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-zinc-300">
                {t('tools.gear-usage-finder.step_substats' as TranslationKey)}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUBSTATS.map(sub => (
                  <FilterPill
                    key={sub}
                    active={selectedSubs.includes(sub)}
                    onClick={() => toggleSub(sub)}
                    className="h-8 px-3"
                  >
                    {sub}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Set flow ── */}
      {equipType === 'set' && (
        <>
          <div>
            <p className="mb-2 text-center text-xs uppercase tracking-wide text-zinc-300">
              {t('tools.gear-usage-finder.step_set' as TranslationKey)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-1.5">
              {filteredSets.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => handleGearSelect(selectedGear === s.name ? null : s.name)}
                  className={[
                    'rounded-lg p-1.5 transition cursor-pointer',
                    selectedGear === s.name
                      ? 'bg-sky-500/20 ring-1 ring-sky-500'
                      : 'hover:bg-zinc-800/60',
                  ].join(' ')}
                >
                  <GearCard
                    name={l(s, 'name', lang)}
                    image={`equipment/TI_Equipment_Armor_${s.image_prefix}`}
                    rarity={s.rarity}
                    effectIcon={s.set_icon}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Substats for sets */}
          {selectedGear && (
            <div>
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-zinc-300">
                {t('tools.gear-usage-finder.step_substats' as TranslationKey)}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUBSTATS.map(sub => (
                  <FilterPill
                    key={sub}
                    active={selectedSubs.includes(sub)}
                    onClick={() => toggleSub(sub)}
                    className="h-8 px-3"
                  >
                    {sub}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Results ── */}
      {hasSelection && (
        <div className="mt-2 space-y-3">
          <p className="text-center text-sm text-zinc-400">
            {results.length > 0
              ? `${results.length} ${t('tools.gear-usage-finder.matches' as TranslationKey)}`
              : t('tools.gear-usage-finder.no_users' as TranslationKey)
            }
          </p>

          {results.length > 0 && (() => {
            const showMainLine = mode === 'free' && mainStat && (equipType === 'weapon' || equipType === 'amulet');
            const maxScore = (mainStat && (equipType === 'weapon' || equipType === 'amulet') ? 4 : 0) + selectedSubs.length;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {results.map(({ characterId, buildCount, score, mainStatMatch, matchedSubCount }) => {
                  const char = charById.get(characterId);
                  if (!char) return null;
                  const displayName = l(char, 'Fullname', lang);

                  return (
                    <Link
                      key={characterId}
                      href={href(`/characters/${char.slug}`) as never}
                      className="card-interactive relative flex items-center gap-3 p-2"
                    >
                      {maxScore > 0 && (
                        <span className={`absolute top-1.5 right-2 text-xs font-medium ${score === maxScore ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          {score}/{maxScore}
                        </span>
                      )}
                      <CharacterPortrait id={characterId} size="md" showIcons />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">{displayName}</p>
                        {showMainLine && mainStatMatch && (
                          <p className="text-xs text-emerald-400">{mainStat} match</p>
                        )}
                        {selectedSubs.length > 0 && (
                          <p className="text-xs text-zinc-400">
                            Subs: <span className={matchedSubCount === selectedSubs.length ? 'text-emerald-400' : 'text-zinc-300'}>{matchedSubCount}/{selectedSubs.length}</span>
                          </p>
                        )}
                        {buildCount > 1 && (
                          <p className="text-[10px] text-zinc-500">{buildCount} builds</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

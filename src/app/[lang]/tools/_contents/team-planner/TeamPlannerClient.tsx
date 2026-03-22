'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import LZString from 'lz-string';
import type { CharacterListEntry } from '@/types/character';
import type { Effect, SkillBuffData } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { ELEMENTS, CLASSES } from '@/types/enums';
import type { TranslationKey } from '@/i18n/locales/en';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import { EffectsProvider } from '@/app/components/character/BuffDebuffDisplay';
import BuffDebuffDisplay from '@/app/components/character/BuffDebuffDisplay';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { FilterSearch } from '@/app/components/ui/FilterPills';

// ── Types ──

type TeamSlot = CharacterListEntry | null;

type Props = {
  characters: CharacterListEntry[];
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
  skillBuffs: Record<string, SkillBuffData>;
};

// ── Helpers ──

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim();
}

function getSearchableNames(char: CharacterListEntry, langs: Lang[]): string[] {
  return [
    ...langs.map(lang => norm(l(char, 'Fullname', lang))).filter(Boolean),
    norm(char.ID),
    norm(char.slug),
  ];
}

const SELF_TARGETS = new Set(['ME']);
const TEAM_TARGETS = new Set([
  'MY_TEAM', 'MY_TEAM_WITHOUT_ME', 'MY_TEAM_ONE', 'MY_TEAM_ONE_RANDOM',
  'MY_TEAM_ATTACKER', 'MY_TEAM_DEAD_ALL', 'MY_TEAM_HIGHEST_ATK',
  'MY_TEAM_HIGHEST_MAXHP', 'MY_TEAM_HIGHEST_SPD', 'MY_TEAM_LOWEST_HP_RATE',
  'MY_TEAM_MAGE', 'NEXT_CHAIN_STRIKER',
]);
const SKILL_KEYS = ['s1', 's2', 's3', 'ee'] as const;

const HIDDEN_CATEGORIES = new Set(['hidden', 'unique']);

/** Extract unique buff/debuff names from skill-buffs data for a character, filtered by target set and optionally by burst.
 *  Excludes effects with hidden/unique categories. */
function extractEffects(
  data: SkillBuffData | undefined,
  keys: readonly (keyof SkillBuffData)[],
  targets: Set<string>,
  isDebuff: boolean,
  effectMap: Record<string, Effect>,
  burst?: boolean,
): string[] {
  if (!data) return [];
  const seen = new Set<string>();
  for (const key of keys) {
    const entries = data[key];
    if (!entries) continue;
    for (const e of entries) {
      if (e.debuff === isDebuff && targets.has(e.target)) {
        if (burst !== undefined && !!e.burst !== burst) continue;
        const effect = effectMap[e.type];
        if (effect && HIDDEN_CATEGORIES.has(effect.category)) continue;
        seen.add(e.type);
      }
    }
  }
  return [...seen];
}

// ── Character Picker Modal ──

function CharacterPicker({
  characters,
  excludeIds,
  lang,
  onPick,
  onClose,
}: {
  characters: CharacterListEntry[];
  excludeIds: Set<string>;
  lang: Lang;
  onPick: (char: CharacterListEntry) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [elementFilter, setElementFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const indexed = useMemo(() =>
    characters.map(char => ({
      ...char,
      searchNames: getSearchableNames(char, LANGS),
      displayName: l(char, 'Fullname', lang),
    })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
  [characters, lang]);

  const filtered = useMemo(() => {
    const q = norm(query);
    return indexed.filter(char => {
      if (excludeIds.has(char.ID)) return false;
      if (q && !char.searchNames.some(name => name.includes(q))) return false;
      if (elementFilter && char.Element !== elementFilter) return false;
      if (classFilter && char.Class !== classFilter) return false;
      return true;
    });
  }, [indexed, query, elementFilter, classFilter, excludeIds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-8 md:pt-16 overflow-y-auto"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-4xl rounded-xl bg-zinc-900 p-4 md:p-6 shadow-2xl mx-2 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-100">
            {t('tools.team-planner.pick_character' as TranslationKey)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <FilterSearch value={query} onChange={setQuery} placeholder={t('common.search')} />

        {/* Element filter */}
        <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
          <button
            type="button"
            onClick={() => setElementFilter(null)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${!elementFilter ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            {t('common.all')}
          </button>
          {ELEMENTS.map(el => (
            <button
              key={el}
              type="button"
              onClick={() => setElementFilter(prev => prev === el ? null : el)}
              className={`rounded-md p-1.5 transition ${elementFilter === el ? 'bg-zinc-600 ring-1 ring-zinc-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            >
              <Image src={`/images/ui/elem/CM_Element_${el}.webp`} alt={el} width={20} height={20} />
            </button>
          ))}
        </div>

        {/* Class filter */}
        <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
          {CLASSES.map(cl => (
            <button
              key={cl}
              type="button"
              onClick={() => setClassFilter(prev => prev === cl ? null : cl)}
              className={`rounded-md p-1.5 transition ${classFilter === cl ? 'bg-zinc-600 ring-1 ring-zinc-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
            >
              <Image src={`/images/ui/class/CM_Class_${cl}.webp`} alt={cl} width={20} height={20} />
            </button>
          ))}
        </div>

        {/* Character grid */}
        <div className="mt-4 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map(char => (
            <button
              key={char.ID}
              type="button"
              onClick={() => onPick(char)}
              className="flex flex-col items-center gap-0.5 hover:opacity-80 transition rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <CharacterPortrait
                id={char.ID}
                name={char.displayName}
                element={char.Element}
                classType={char.Class}
                size={{ base: 'sm', md: 'md' }}
                showIcons
              />
              <span className="text-[9px] md:text-[11px] text-zinc-400 truncate max-w-12 md:max-w-16 leading-tight">{char.displayName}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-500 py-8">No characters found.</p>
        )}
      </div>
    </div>
  );
}

// ── Slot ──

const SLOT_SIZE = 'w-18 h-18 sm:w-22 sm:h-22';

function TeamSlotContent({
  char,
  lang,
  selfBuffs,
  isTop,
  onRemove,
  onClick,
}: {
  char: CharacterListEntry | null;
  lang: Lang;
  selfBuffs: string[];
  isTop?: boolean;
  onRemove: () => void;
  onClick: () => void;
}) {
  const buffsEl = selfBuffs.length > 0 ? (
    <div className="absolute left-1/2 -translate-x-1/2 z-30 [&>div]:flex-nowrap" style={isTop ? { bottom: '100%', marginBottom: 2 } : { top: '100%', marginTop: 2 }}>
      <BuffDebuffDisplay buffs={selfBuffs} debuffs={[]} iconOnly />
    </div>
  ) : null;

  return (
    <div className="relative group">
      <button type="button" onClick={onClick} className={`relative ${SLOT_SIZE} hover:opacity-80 transition`}>
        {char ? (
          <CharacterPortrait
            id={char.ID}
            name={l(char, 'Fullname', lang)}
            element={char.Element}
            classType={char.Class}
            size="mld"
            showIcons
            showStars
          />
        ) : (
          <Image
            src="/images/ui/skillchain/TI_Slot_Empty.webp"
            alt="Empty slot"
            fill
            className="object-contain"
          />
        )}
      </button>
      {/* Remove button */}
      {char && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1 -right-1 z-20 rounded-full bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {buffsEl}
    </div>
  );
}

// ── Cross Layout ──

function TeamCross({
  team,
  lang,
  skillBuffs,
  buffMap,
  onSlotClick,
  onRemove,
}: {
  team: TeamSlot[];
  lang: Lang;
  skillBuffs: Record<string, SkillBuffData>;
  buffMap: Record<string, Effect>;
  onSlotClick: (idx: number) => void;
  onRemove: (idx: number) => void;
}) {
  const renderSlot = (idx: number) => {
    const char = team[idx];
    const selfBuffs = char ? extractEffects(skillBuffs[char.ID], SKILL_KEYS, SELF_TARGETS, false, buffMap, false) : [];
    return (
      <TeamSlotContent
        char={char}
        lang={lang}
        selfBuffs={selfBuffs}
        isTop={idx === 0}
        onRemove={() => onRemove(idx)}
        onClick={() => onSlotClick(idx)}
      />
    );
  };

  return (
    <div className="relative w-fit mx-auto">
      {/* Background circle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-52 h-52 sm:w-64 sm:h-64">
          <Image
            src="/images/ui/skillchain/T_Tame_Select.webp"
            alt=""
            fill
            className="object-contain opacity-30"
          />
        </div>
      </div>
      {/* Cross grid */}
      <div className="relative grid grid-cols-3 grid-rows-3 place-items-center gap-5 sm:gap-6 p-4">
        <div />
        <div className="-mt-2">{renderSlot(0)}</div>
        <div />
        <div className="-ml-2">{renderSlot(1)}</div>
        <div />
        <div className="-mr-2">{renderSlot(2)}</div>
        <div />
        <div className="-mb-2">{renderSlot(3)}</div>
        <div />
      </div>
    </div>
  );
}

// ── Chain Effect Icons ──

function ChainEffectIcons({
  buffs,
  debuffs,
  isDisabled,
  buffMap,
  debuffMap,
}: {
  buffs: string[];
  debuffs: string[];
  isDisabled: boolean;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
}) {
  const effects = [
    ...buffs.map(name => ({ ...buffMap[name], effectType: 'buff' as const })).filter(e => e.icon),
    ...debuffs.map(name => ({ ...debuffMap[name], effectType: 'debuff' as const })).filter(e => e.icon),
  ];

  if (effects.length === 0) return null;

  return (
    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 flex gap-0.5">
      {effects.slice(0, 3).map((effect, idx) => {
        const bgImage = isDisabled
          ? '/images/ui/skillchain/SC_Whole_Disable.webp'
          : effect.effectType === 'buff'
          ? '/images/ui/skillchain/SC_Whole_Blue_Bg.webp'
          : '/images/ui/skillchain/SC_Whole_Red_Bg.webp';

        return (
          <div key={`${effect.effectType}-${effect.name}-${idx}`} className="relative h-7 w-7 sm:h-9 sm:w-9 flex items-center justify-center">
            <Image src={bgImage} alt="" fill className="object-contain" />
            <div className={`relative z-10 ${isDisabled ? 'grayscale opacity-50' : ''}`}>
              <Image
                src={`/images/ui/effect/${effect.icon}.webp`}
                alt={effect.name}
                width={18}
                height={18}
                className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 object-contain"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Chain Order Section ──

function ChainOrderSection({
  team,
  chainOrder,
  selectedChainIndex,
  onChainSlotClick,
  lang,
  skillBuffs,
  buffMap,
  debuffMap,
}: {
  team: TeamSlot[];
  chainOrder: number[];
  selectedChainIndex: number | null;
  onChainSlotClick: (chainIndex: number) => void;
  lang: Lang;
  skillBuffs: Record<string, SkillBuffData>;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
}) {
  const { t } = useI18n();
  // Chain attack requires all 4 slots filled
  const memberCount = team.filter(c => c !== null).length;
  if (memberCount < 4) return null;

  const isValidPosition = (chainType: string | undefined, pos: number) => {
    if (!chainType) return true;
    if (chainType === 'Join') return true;
    if (chainType === 'Start') return pos === 0;
    if (chainType === 'Finish') return pos === 3;
    return false;
  };

  // Compute active chain effects based on valid positions
  const activeChainEffects = (() => {
    const seenBuffs = new Set<string>();
    const seenDebuffs = new Set<string>();
    const buffs: string[] = [];
    const debuffs: string[] = [];

    chainOrder.forEach((slotIdx, pos) => {
      const char = team[slotIdx];
      if (!char) return;
      if (!isValidPosition(char.Chain_Type, pos)) return;

      const data = skillBuffs[char.ID];
      for (const e of data?.chain || []) {
        const eff = e.debuff ? debuffMap[e.type] : buffMap[e.type];
        if (eff && HIDDEN_CATEGORIES.has(eff.category)) continue;
        if (!e.debuff && !seenBuffs.has(e.type)) { seenBuffs.add(e.type); buffs.push(e.type); }
        if (e.debuff && !seenDebuffs.has(e.type)) { seenDebuffs.add(e.type); debuffs.push(e.type); }
      }
    });

    return { buffs, debuffs };
  })();

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
      <h3 className="text-sm font-bold text-zinc-200 mb-1 text-center">
        {t('tools.team-planner.chain_order' as TranslationKey)}
      </h3>
      <p className="text-xs text-zinc-500 mb-4 text-center">
        {t('tools.team-planner.chain_order.desc' as TranslationKey)}
      </p>

      <div className="flex gap-2 sm:gap-3 justify-center">
        {chainOrder.map((slotIdx, chainIndex) => {
          const char = team[slotIdx];
          if (!char) return null;

          const isSelected = selectedChainIndex === chainIndex;
          const isValid = isValidPosition(char.Chain_Type, chainIndex);

          // Get chain buffs/debuffs for this character
          const data = skillBuffs[char.ID];
          const chainBuffNames = (data?.chain?.filter(e => !e.debuff).map(e => e.type) || []).filter(n => { const eff = buffMap[n]; return !eff || !HIDDEN_CATEGORIES.has(eff.category); });
          const chainDebuffNames = (data?.chain?.filter(e => e.debuff).map(e => e.type) || []).filter(n => { const eff = debuffMap[n]; return !eff || !HIDDEN_CATEGORIES.has(eff.category); });

          return (
            <div key={`chain-${chainIndex}-${slotIdx}`} className="flex flex-col items-center gap-1">
              <div
                className={`relative w-12 h-36 sm:w-16 sm:h-44 cursor-pointer hover:scale-105 transition-all ${isSelected ? 'ring-2 ring-cyan-500 rounded-lg' : ''}`}
                onClick={() => onChainSlotClick(chainIndex)}
              >
                {/* Background mask */}
                <Image
                  src="/images/ui/skillchain/T_FX_SkillChain_Mask.webp"
                  alt=""
                  fill
                  className="object-contain opacity-20"
                />

                {/* Character portrait zoomed */}
                <div className="absolute inset-0 z-10 overflow-hidden rounded-lg">
                  <div className="relative w-full h-full" style={{ transform: 'scale(1.7)', transformOrigin: 'center center' }}>
                    <Image
                      src={`/images/characters/portrait/CT_${char.ID}.webp`}
                      alt={l(char, 'Fullname', lang)}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>

                {/* Chain effect icons at top */}
                <ChainEffectIcons
                  buffs={chainBuffNames}
                  debuffs={chainDebuffNames}
                  isDisabled={!isValid}
                  buffMap={buffMap}
                  debuffMap={debuffMap}
                />

                {/* Chain type label at bottom */}
                {char.Chain_Type && (
                  <div className={`absolute bottom-0 left-0 right-0 z-20 px-0.5 py-0.5 rounded-b text-[8px] sm:text-[10px] font-semibold text-center leading-tight whitespace-pre-line ${
                    isValid
                      ? 'bg-blue-600/80 text-white'
                      : 'bg-zinc-700/80 text-zinc-300'
                  }`}>
                    {char.Chain_Type === 'Start'
                      ? t('characters.chains.starter' as TranslationKey)
                      : char.Chain_Type === 'Finish'
                      ? t('characters.chains.finisher' as TranslationKey)
                      : t('characters.chains.companion' as TranslationKey)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active chain effects summary */}
      {activeChainEffects.buffs.length > 0 || activeChainEffects.debuffs.length > 0 ? (
        <div className="mt-4">
          <BuffDebuffDisplay buffs={activeChainEffects.buffs} debuffs={activeChainEffects.debuffs} />
        </div>
      ) : null}
    </div>
  );
}

// ── Team Effects Summary ──

/** Per-character effect row: portrait + buff/debuff icons */
function CharacterEffectRow({
  char,
  buffs,
  debuffs,
  lang,
}: {
  char: CharacterListEntry;
  buffs: string[];
  debuffs: string[];
  lang: Lang;
}) {
  if (buffs.length === 0 && debuffs.length === 0) return null;
  const displayName = l(char, 'Fullname', lang);

  return (
    <div className="flex items-start gap-2">
      <div className="row-span-2 self-center shrink-0">
        <CharacterPortrait
          id={char.ID}
          name={displayName}
          element={char.Element}
          classType={char.Class}
          size="sm"
          showIcons
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {buffs.length > 0 && <BuffDebuffDisplay buffs={buffs} debuffs={[]} />}
        {debuffs.length > 0 && <BuffDebuffDisplay buffs={[]} debuffs={debuffs} />}
      </div>
    </div>
  );
}

/** Render a section with per-character effect rows. Returns null if no character has effects. */
function EffectSection({
  title,
  titleColor,
  members,
  getBuffs,
  getDebuffs,
  lang,
}: {
  title: string;
  titleColor: string;
  members: CharacterListEntry[];
  getBuffs: (char: CharacterListEntry) => string[];
  getDebuffs: (char: CharacterListEntry) => string[];
  lang: Lang;
}) {
  const activeMembers = members.filter(m => getBuffs(m).length > 0 || getDebuffs(m).length > 0);
  if (activeMembers.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
      <h3 className={`text-sm font-bold ${titleColor} mb-2`}>{title}</h3>
      <div className={`flex flex-col gap-3 ${activeMembers.length >= 2 ? 'sm:grid sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3' : ''}`}>
        {activeMembers.map((char, i) => (
          <div key={char.ID} className={`${i > 0 ? 'border-t border-zinc-700/50 pt-3 sm:border-t-0 sm:pt-0' : ''} ${activeMembers.length >= 2 && i % 2 === 1 ? 'sm:border-l sm:border-zinc-700/50 sm:pl-4' : ''}`}>
            <CharacterEffectRow
              char={char}
              buffs={getBuffs(char)}
              debuffs={getDebuffs(char)}
              lang={lang}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamEffectsSummary({
  team,
  skillBuffs,
  buffMap,
  debuffMap,
}: {
  team: TeamSlot[];
  skillBuffs: Record<string, SkillBuffData>;
  buffMap: Record<string, Effect>;
  debuffMap: Record<string, Effect>;
}) {
  const { t, lang } = useI18n();
  const members = team.filter((c): c is CharacterListEntry => c !== null);

  if (members.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500 py-4">
        {t('tools.team-planner.no_effects' as TranslationKey)}
      </p>
    );
  }

  const ENEMY_TARGETS = new Set([
    'ENEMY', 'ENEMY_SKILL_TARGET', 'ENEMY_TEAM',
    'ENEMY_TEAM_HIGHEST_ATK', 'ENEMY_TEAM_HIGHEST_SPD',
    'ENEMY_TEAM_MAGE', 'ENEMY_TEAM_PRIEST',
  ]);

  const fullTeam = members.length === 4;

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-4">
        <EffectSection
          title={t('tools.team-planner.team_buffs' as TranslationKey)}
          titleColor="text-cyan-400"
          members={members}
          getBuffs={char => extractEffects(skillBuffs[char.ID], SKILL_KEYS, TEAM_TARGETS, false, buffMap, false)}
          getDebuffs={() => []}
          lang={lang}
        />

        <EffectSection
          title={t('tools.team-planner.team_debuffs' as TranslationKey)}
          titleColor="text-red-400"
          members={members}
          getBuffs={() => []}
          getDebuffs={char => extractEffects(skillBuffs[char.ID], SKILL_KEYS, ENEMY_TARGETS, true, debuffMap, false)}
          lang={lang}
        />

        <EffectSection
          title={t('tools.team-planner.burst_effects' as TranslationKey)}
          titleColor="text-orange-400"
          members={members}
          getBuffs={char => extractEffects(skillBuffs[char.ID], SKILL_KEYS, new Set([...SELF_TARGETS, ...TEAM_TARGETS]), false, buffMap, true)}
          getDebuffs={char => extractEffects(skillBuffs[char.ID], SKILL_KEYS, ENEMY_TARGETS, true, debuffMap, true)}
          lang={lang}
        />

        {fullTeam && (
          <EffectSection
            title={t('tools.team-planner.dual_attack_effects' as TranslationKey)}
            titleColor="text-purple-400"
            members={members}
            getBuffs={char => {
              const data = skillBuffs[char.ID];
              return (data?.chain_dual?.filter(e => !e.debuff).map(e => e.type) || []).filter(n => { const eff = buffMap[n]; return eff && !HIDDEN_CATEGORIES.has(eff.category); });
            }}
            getDebuffs={char => {
              const data = skillBuffs[char.ID];
              return (data?.chain_dual?.filter(e => e.debuff).map(e => e.type) || []).filter(n => { const eff = debuffMap[n]; return eff && !HIDDEN_CATEGORIES.has(eff.category); });
            }}
            lang={lang}
          />
        )}
      </div>
    </EffectsProvider>
  );
}

// ── Main Component ──

export default function TeamPlannerClient({ characters, buffMap, debuffMap, skillBuffs }: Props) {
  const { t, lang } = useI18n();
  const [team, setTeam] = useState<TeamSlot[]>([null, null, null, null]);
  const [chainOrder, setChainOrder] = useState<number[]>([0, 1, 2, 3]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [selectedChainIndex, setSelectedChainIndex] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [copied, setCopied] = useState(false);

  const excludeIds = useMemo(
    () => new Set(team.filter((c): c is CharacterListEntry => c !== null).map(c => c.ID)),
    [team],
  );

  const handlePick = useCallback((char: CharacterListEntry) => {
    if (pickerSlot === null) return;
    setTeam(prev => {
      const next = [...prev];
      next[pickerSlot] = char;
      return next;
    });
    setPickerSlot(null);
  }, [pickerSlot]);

  const handleRemove = useCallback((slotIdx: number) => {
    setTeam(prev => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setTeam([null, null, null, null]);
    setChainOrder([0, 1, 2, 3]);
    setTeamName('');
  }, []);

  const handleShare = useCallback(() => {
    const compact: Record<string, unknown> = {};
    const ids = team.map(c => c?.ID ?? '');
    if (ids.some(Boolean)) compact.t = ids;
    const order = chainOrder.join('');
    if (order !== '0123') compact.o = order;
    if (teamName) compact.n = teamName;

    const z = LZString.compressToEncodedURIComponent(JSON.stringify(compact));
    const url = `${window.location.pathname}?z=${z}`;
    window.history.replaceState(null, '', url);
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [team, chainOrder, teamName]);

  // Hydrate from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const z = params.get('z');

    // Legacy format support
    const tParam = params.get('t');
    if (!z && tParam) {
      const ids = tParam.split(',');
      const charMap = new Map(characters.map(c => [c.ID, c]));
      const loaded: TeamSlot[] = ids.slice(0, 4).map(id => charMap.get(id) ?? null);
      while (loaded.length < 4) loaded.push(null);
      setTeam(loaded);
      const oParam = params.get('o');
      if (oParam && /^[0-3]{4}$/.test(oParam)) setChainOrder(oParam.split('').map(Number));
      const nParam = params.get('n');
      if (nParam) setTeamName(nParam);
      return;
    }

    if (!z) return;
    try {
      const raw = JSON.parse(LZString.decompressFromEncodedURIComponent(z) || '{}') as { t?: string[]; o?: string; n?: string };
      if (raw.t) {
        const charMap = new Map(characters.map(c => [c.ID, c]));
        const loaded: TeamSlot[] = raw.t.slice(0, 4).map(id => charMap.get(id) ?? null);
        while (loaded.length < 4) loaded.push(null);
        setTeam(loaded);
      }
      if (raw.o && /^[0-3]{4}$/.test(raw.o)) setChainOrder(raw.o.split('').map(Number));
      if (raw.n) setTeamName(raw.n);
    } catch { /* invalid data, ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* WIP disclaimer */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-300">
          {t('tools.team-planner.wip' as TranslationKey)}
        </div>

        {/* Team name */}
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder={t('tools.team-planner.team_name.placeholder' as TranslationKey)}
          maxLength={100}
          suppressHydrationWarning
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />

        {/* Team Slots — cross layout */}
        <TeamCross
          team={team}
          lang={lang}
          skillBuffs={skillBuffs}
          buffMap={buffMap}
          onSlotClick={setPickerSlot}
          onRemove={handleRemove}
        />

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition"
          >
            {t('tools.team-planner.reset' as TranslationKey)}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition"
          >
            {copied ? t('common.copied') : t('tools.team-planner.share' as TranslationKey)}
          </button>
        </div>

        {/* Chain Order */}
        <ChainOrderSection
          team={team}
          chainOrder={chainOrder}
          selectedChainIndex={selectedChainIndex}
          onChainSlotClick={(chainIndex) => {
            if (selectedChainIndex === null) {
              setSelectedChainIndex(chainIndex);
            } else {
              const next = [...chainOrder];
              [next[selectedChainIndex], next[chainIndex]] = [next[chainIndex], next[selectedChainIndex]];
              setChainOrder(next);
              setSelectedChainIndex(null);
            }
          }}
          lang={lang}
          skillBuffs={skillBuffs}
          buffMap={buffMap}
          debuffMap={debuffMap}
        />

        {/* Team Effects Summary */}
        <TeamEffectsSummary
          team={team}
          skillBuffs={skillBuffs}
          buffMap={buffMap}
          debuffMap={debuffMap}
        />

        {/* Character Picker Modal */}
        {pickerSlot !== null && (
          <CharacterPicker
            characters={characters}
            excludeIds={excludeIds}
            lang={lang}
            onPick={handlePick}
            onClose={() => setPickerSlot(null)}
          />
        )}
      </div>
    </EffectsProvider>
  );
}

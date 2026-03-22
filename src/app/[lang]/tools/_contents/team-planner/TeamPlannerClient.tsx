'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { CharacterListEntry } from '@/types/character';
import type { Effect, SkillBuffData } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import { ELEMENTS, CLASSES, CHAIN_TYPE_LABELS } from '@/types/enums';
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

/** Extract unique buff/debuff names from skill-buffs data for a character, filtered by target set */
function extractEffects(
  data: SkillBuffData | undefined,
  keys: readonly (keyof SkillBuffData)[],
  targets: Set<string>,
  isDebuff: boolean,
): string[] {
  if (!data) return [];
  const seen = new Set<string>();
  for (const key of keys) {
    const entries = data[key];
    if (!entries) continue;
    for (const e of entries) {
      if (e.debuff === isDebuff && targets.has(e.target)) seen.add(e.type);
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
                size="sm"
                showIcons
              />
              <span className="text-[9px] text-zinc-400 truncate max-w-12 leading-tight">{char.displayName}</span>
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

// ── Slot (CharacterPortrait-based) ──

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800 transition h-16 w-16 md:h-24 md:w-24"
    >
      <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </button>
  );
}

function FilledSlot({
  char,
  lang,
  selfBuffs,
  onRemove,
  onClick,
}: {
  char: CharacterListEntry;
  lang: Lang;
  selfBuffs: string[];
  onRemove: () => void;
  onClick: () => void;
}) {
  const displayName = l(char, 'Fullname', lang);

  return (
    <div className="relative group flex flex-col items-center">
      <button type="button" onClick={onClick} className="hover:opacity-80 transition">
        <CharacterPortrait
          id={char.ID}
          name={displayName}
          element={char.Element}
          classType={char.Class}
          rarity={char.Rarity}
          size={'md'}
          showIcons
          showStars
        />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -top-1 -right-1 z-10 rounded-full bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="mt-1 text-center text-[10px] font-medium text-zinc-300 truncate max-w-16 md:max-w-24">{displayName}</p>
      {selfBuffs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 max-w-20 md:max-w-28">
          <BuffDebuffDisplay buffs={selfBuffs} debuffs={[]} iconOnly />
        </div>
      )}
    </div>
  );
}

// ── Cross Layout ──

function TeamCross({
  team,
  lang,
  skillBuffs,
  onSlotClick,
  onRemove,
}: {
  team: TeamSlot[];
  lang: Lang;
  skillBuffs: Record<string, SkillBuffData>;
  onSlotClick: (idx: number) => void;
  onRemove: (idx: number) => void;
}) {
  const renderSlot = (idx: number) => {
    const char = team[idx];
    if (!char) return <EmptySlot onClick={() => onSlotClick(idx)} />;
    const selfBuffs = extractEffects(skillBuffs[char.ID], SKILL_KEYS, SELF_TARGETS, false);
    return (
      <FilledSlot char={char} lang={lang} selfBuffs={selfBuffs} onRemove={() => onRemove(idx)} onClick={() => onSlotClick(idx)} />
    );
  };

  return (
    <div className="grid grid-cols-3 grid-rows-3 place-items-center gap-1 w-fit mx-auto">
      {/* Row 1: top slot (index 0) centered */}
      <div />
      <div>{renderSlot(0)}</div>
      <div />
      {/* Row 2: left (1) + center empty + right (2) */}
      <div>{renderSlot(1)}</div>
      <div />
      <div>{renderSlot(2)}</div>
      {/* Row 3: bottom slot (3) centered */}
      <div />
      <div>{renderSlot(3)}</div>
      <div />
    </div>
  );
}

// ── Chain Order Section ──

function ChainOrderSection({
  team,
  chainOrder,
  onReorder,
  lang,
}: {
  team: TeamSlot[];
  chainOrder: number[];
  onReorder: (newOrder: number[]) => void;
  lang: Lang;
}) {
  const { t } = useI18n();
  const activeIndices = chainOrder.filter(idx => team[idx] !== null);

  if (activeIndices.length < 2) return null;

  const moveUp = (pos: number) => {
    if (pos === 0) return;
    const next = [...chainOrder];
    [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
    onReorder(next);
  };

  const moveDown = (pos: number) => {
    if (pos >= chainOrder.length - 1) return;
    const next = [...chainOrder];
    [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
    onReorder(next);
  };

  const activeMembers = activeIndices.map(idx => team[idx]!);

  // Chain effect activation rules:
  // - Starter: effect activates only if placed first
  // - Companion (Join): effect always activates
  // - Finisher: effect activates only if placed last
  const getEffectActive = (char: CharacterListEntry, pos: number, total: number) => {
    if (char.Chain_Type === 'Join') return true;
    if (char.Chain_Type === 'Start') return pos === 0;
    if (char.Chain_Type === 'Finish') return pos === total - 1;
    return false;
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
      <h3 className="text-sm font-bold text-zinc-200 mb-1">
        {t('tools.team-planner.chain_order' as TranslationKey)}
      </h3>
      <p className="text-xs text-zinc-500 mb-3">
        {t('tools.team-planner.chain_order.desc' as TranslationKey)}
      </p>

      <div className="flex flex-col gap-2">
        {chainOrder.map((slotIdx, pos) => {
          const char = team[slotIdx];
          if (!char) return null;
          const displayName = l(char, 'Fullname', lang);
          const isActive = getEffectActive(char, pos, activeMembers.length);

          return (
            <div key={char.ID} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${isActive ? 'bg-zinc-800/60' : 'bg-zinc-800/20 opacity-60'}`}>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveUp(pos)}
                  disabled={pos === 0}
                  className="rounded p-0.5 text-zinc-500 hover:text-white disabled:opacity-20 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(pos)}
                  disabled={pos >= chainOrder.length - 1}
                  className="rounded p-0.5 text-zinc-500 hover:text-white disabled:opacity-20 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <CharacterPortrait
                id={char.ID}
                name={displayName}
                element={char.Element}
                classType={char.Class}
                size="sm"
                showIcons
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{displayName}</p>
                <p className="text-xs text-zinc-500">
                  {t(`characters.chains.${CHAIN_TYPE_LABELS[char.Chain_Type].toLowerCase()}` as TranslationKey)}
                </p>
              </div>

              <Image
                src={`/images/characters/chain/Skill_ChainPassive_${char.Element}_${char.Chain_Type}.webp`}
                alt={char.Chain_Type}
                width={28}
                height={28}
              />

              {/* Effect active indicator */}
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? 'bg-green-900/40 text-green-400' : 'bg-zinc-700/40 text-zinc-500'}`}>
                {isActive ? 'ON' : 'OFF'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Team Effects Summary ──

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
  const { t } = useI18n();
  const members = team.filter((c): c is CharacterListEntry => c !== null);

  if (members.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500 py-4">
        {t('tools.team-planner.no_effects' as TranslationKey)}
      </p>
    );
  }

  // Team buffs: only buffs targeting allies (MY_TEAM*) from skills s1/s2/s3
  const teamBuffs = [...new Set(members.flatMap(m =>
    extractEffects(skillBuffs[m.ID], SKILL_KEYS, TEAM_TARGETS, false)
  ))];

  // Team debuffs: debuffs from skills s1/s2/s3 targeting enemies
  const ENEMY_TARGETS = new Set([
    'ENEMY', 'ENEMY_SKILL_TARGET', 'ENEMY_TEAM',
    'ENEMY_TEAM_HIGHEST_ATK', 'ENEMY_TEAM_HIGHEST_SPD',
    'ENEMY_TEAM_MAGE', 'ENEMY_TEAM_PRIEST',
  ]);
  const teamDebuffs = [...new Set(members.flatMap(m =>
    extractEffects(skillBuffs[m.ID], SKILL_KEYS, ENEMY_TARGETS, true)
  ))];

  // Chain passive: only 'chain' key (buffs + debuffs)
  const chainBuffs = [...new Set(members.flatMap(m => {
    const data = skillBuffs[m.ID];
    return data?.chain?.filter(e => !e.debuff).map(e => e.type) || [];
  }))];
  const chainDebuffs = [...new Set(members.flatMap(m => {
    const data = skillBuffs[m.ID];
    return data?.chain?.filter(e => e.debuff).map(e => e.type) || [];
  }))];

  // Dual attack: only 'chain_dual' key
  const dualBuffs = [...new Set(members.flatMap(m => {
    const data = skillBuffs[m.ID];
    return data?.chain_dual?.filter(e => !e.debuff).map(e => e.type) || [];
  }))];
  const dualDebuffs = [...new Set(members.flatMap(m => {
    const data = skillBuffs[m.ID];
    return data?.chain_dual?.filter(e => e.debuff).map(e => e.type) || [];
  }))];

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="space-y-4">
        {teamBuffs.length > 0 && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
            <h3 className="text-sm font-bold text-cyan-400 mb-2">
              {t('tools.team-planner.team_buffs' as TranslationKey)}
            </h3>
            <BuffDebuffDisplay buffs={teamBuffs} debuffs={[]} />
          </div>
        )}

        {teamDebuffs.length > 0 && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
            <h3 className="text-sm font-bold text-red-400 mb-2">
              {t('tools.team-planner.team_debuffs' as TranslationKey)}
            </h3>
            <BuffDebuffDisplay buffs={[]} debuffs={teamDebuffs} />
          </div>
        )}

        {(chainBuffs.length > 0 || chainDebuffs.length > 0) && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-2">
              {t('tools.team-planner.chain_effects' as TranslationKey)}
            </h3>
            <BuffDebuffDisplay buffs={chainBuffs} debuffs={chainDebuffs} />
          </div>
        )}

        {(dualBuffs.length > 0 || dualDebuffs.length > 0) && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
            <h3 className="text-sm font-bold text-purple-400 mb-2">
              {t('tools.team-planner.dual_attack_effects' as TranslationKey)}
            </h3>
            <BuffDebuffDisplay buffs={dualBuffs} debuffs={dualDebuffs} />
          </div>
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
  }, []);

  const handleShare = useCallback(() => {
    const ids = team.map(c => c?.ID ?? '').join(',');
    const order = chainOrder.join('');
    const params = new URLSearchParams();
    if (ids.replace(/,/g, '')) params.set('t', ids);
    if (order !== '0123') params.set('o', order);
    const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', url);
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [team, chainOrder]);

  // Hydrate from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tParam = params.get('t');
    const oParam = params.get('o');

    if (tParam) {
      const ids = tParam.split(',');
      const charMap = new Map(characters.map(c => [c.ID, c]));
      const loaded: TeamSlot[] = ids.slice(0, 4).map(id => charMap.get(id) ?? null);
      while (loaded.length < 4) loaded.push(null);
      setTeam(loaded);
    }

    if (oParam && /^[0-3]{4}$/.test(oParam)) {
      setChainOrder(oParam.split('').map(Number));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <EffectsProvider buffMap={buffMap} debuffMap={debuffMap}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Team Slots — cross layout */}
        <TeamCross
          team={team}
          lang={lang}
          skillBuffs={skillBuffs}
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
          onReorder={setChainOrder}
          lang={lang}
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

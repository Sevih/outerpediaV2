'use client';

import { useEffect, useState, useMemo, useRef, useDeferredValue } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import LZString from 'lz-string';
import effectsIndex from '@data/generated/effectsIndex.json';
import type { CharacterListEntry } from '@/types/character';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import {
  type RoleType, type SkillKey, type RarityType,
  ELEMENTS, CLASSES, CHAIN_TYPES, RARITIES, ROLES, GIFTS, GIFT_LABELS, CHAIN_TYPE_LABELS, SKILL_SOURCES,
} from '@/types/enums';
import type { TranslationKey } from '@/i18n/locales/en';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import type { WithLocalizedFields } from '@/types/common';
import ResponsiveCharacterCard from '@/app/components/character/ResponsiveCharacterCard';
import EffectIcon from '@/app/components/character/EffectIcon';
import { splitCharacterName } from '@/lib/character-name';
import { FILTER } from '@/lib/theme';
import { FilterSearch, FilterPill, IconFilterGroup, TextFilterGroup } from '@/app/components/ui/FilterPills';

// ── URL encoding maps ──

// Bitfield maps: value → bit position (0-indexed)
const ELEM_BIT: Record<string, number> = { Fire: 0, Water: 1, Earth: 2, Light: 3, Dark: 4 };
const CLASS_BIT: Record<string, number> = { Striker: 0, Defender: 1, Ranger: 2, Healer: 3, Mage: 4 };
const CHAIN_BIT: Record<string, number> = { Start: 0, Join: 1, Finish: 2 };
const GIFT_BIT: Record<string, number> = { Science: 0, Luxury: 1, 'Magic Tool': 2, Craftwork: 3, 'Natural Object': 4 };
const RARITY_BIT: Record<number, number> = { 1: 0, 2: 1, 3: 2 };
const ROLE_BIT: Record<string, number> = { dps: 0, support: 1, sustain: 2 };
const SRC_BIT: Record<string, number> = { SKT_FIRST: 0, SKT_SECOND: 1, SKT_ULTIMATE: 2, SKT_CHAIN_PASSIVE: 3, DUAL_ATTACK: 4 };

// Inverse maps: bit position → value
const ELEM_INV = Object.fromEntries(Object.entries(ELEM_BIT).map(([k, v]) => [v, k]));
const CLASS_INV = Object.fromEntries(Object.entries(CLASS_BIT).map(([k, v]) => [v, k]));
const CHAIN_INV = Object.fromEntries(Object.entries(CHAIN_BIT).map(([k, v]) => [v, k]));
const GIFT_INV = Object.fromEntries(Object.entries(GIFT_BIT).map(([k, v]) => [v, k]));
const RARITY_INV = Object.fromEntries(Object.entries(RARITY_BIT).map(([k, v]) => [v, Number(k)]));
const ROLE_INV = Object.fromEntries(Object.entries(ROLE_BIT).map(([k, v]) => [v, k]));
const SRC_INV = Object.fromEntries(Object.entries(SRC_BIT).map(([k, v]) => [v, k]));

// Bitfield helpers
function toBitfield<T extends string | number>(arr: T[], map: Record<T, number>): number {
  let bits = 0;
  for (const v of arr) if (v in map) bits |= 1 << map[v];
  return bits;
}
function fromBitfield<T>(bits: number, inv: Record<number, T>, count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) if (bits & (1 << i)) out.push(inv[i]);
  return out;
}

// Index-based maps for buffs/debuffs/tags
const BUFF_ID: Record<string, number> = effectsIndex.buffs;
const DEBUFF_ID: Record<string, number> = effectsIndex.debuffs;
const TAG_ID: Record<string, number> = (effectsIndex as Record<string, Record<string, number>>).tags ?? {};
const BUFF_INV = Object.fromEntries(Object.entries(BUFF_ID).map(([k, v]) => [v, k]));
const DEBUFF_INV = Object.fromEntries(Object.entries(DEBUFF_ID).map(([k, v]) => [v, k]));
const TAG_INV = Object.fromEntries(Object.entries(TAG_ID).map(([k, v]) => [v, k]));

// ── Tag types ──

type BaseTagMeta = { label: string; image: string; desc: string; type: string };
type TagMeta = WithLocalizedFields<WithLocalizedFields<BaseTagMeta, 'label'>, 'desc'>;

// ── URL payload types ──

type Payload = {
  el?: string[]; cl?: string[]; r?: number[]; chain?: string[]; gift?: string[];
  buffs?: string[]; debuffs?: string[];
  logic?: 'AND' | 'OR'; q?: string; role?: string[];
  tags?: string[]; tagLogic?: 'AND' | 'OR';
  sources?: SkillKey[];
  uniq?: boolean;
};

type ZPayload = {
  e?: number; c?: number; r?: number; ch?: number; g?: number;
  b?: number[]; d?: number[];
  l?: 0 | 1; q?: string;
  r2?: number; t?: number[]; tl?: 0 | 1;
  src?: number; u?: 0 | 1;
};

// ── Helpers ──

const isArr = <T,>(v: T[] | undefined): v is T[] => Array.isArray(v) && v.length > 0;

function norm(s: unknown): string {
  return (typeof s === 'string' ? s : '').normalize('NFKC').toLowerCase().trim();
}

function getSearchableNames(char: CharacterListEntry, langs: Lang[]): string[] {
  return [
    ...langs.map(lang => norm(l(char, 'Fullname', lang))).filter(Boolean),
    norm(char.ID),
    norm(char.slug),
  ];
}

function charHasEffect(
  char: CharacterListEntry, filterEffect: string, type: 'buff' | 'debuff',
): boolean {
  return (char[type] || []).includes(filterEffect);
}

function charHasEffectFromSources(
  char: CharacterListEntry, filterEffect: string, type: 'buff' | 'debuff',
  sources: SkillKey[],
): boolean {
  if (sources.length === 0) return charHasEffect(char, filterEffect, type);
  if (!char.effectsBySource) return charHasEffect(char, filterEffect, type);

  for (const source of sources) {
    const sourceEffects = char.effectsBySource[source]?.[type] || [];
    if (sourceEffects.includes(filterEffect)) return true;
  }
  return false;
}

// ── URL encoding ──

function encodeStateToZ(p: Payload): string {
  const eBits = isArr(p.el) ? toBitfield(p.el!, ELEM_BIT) : undefined;
  const cBits = isArr(p.cl) ? toBitfield(p.cl!, CLASS_BIT) : undefined;
  const rBits = isArr(p.r) ? toBitfield(p.r!, RARITY_BIT) : undefined;
  const chBits = isArr(p.chain) ? toBitfield(p.chain!, CHAIN_BIT) : undefined;
  const gBits = isArr(p.gift) ? toBitfield(p.gift!, GIFT_BIT) : undefined;
  const r2Bits = isArr(p.role) ? toBitfield(p.role!, ROLE_BIT) : undefined;
  const srcBits = isArr(p.sources) ? toBitfield(p.sources!, SRC_BIT) : undefined;

  const compact: ZPayload = {
    e: eBits || undefined,
    c: cBits || undefined,
    r: rBits || undefined,
    ch: chBits || undefined,
    g: gBits || undefined,
    b: isArr(p.buffs) ? p.buffs!.map(x => BUFF_ID[x]).filter(Boolean) : undefined,
    d: isArr(p.debuffs) ? p.debuffs!.map(x => DEBUFF_ID[x]).filter(Boolean) : undefined,
    r2: r2Bits || undefined,
    t: isArr(p.tags) ? p.tags!.map(x => TAG_ID[x]).filter(Boolean) : undefined,
    l: p.logic === 'AND' ? 1 : undefined,
    q: p.q || undefined,
    u: p.uniq ? 1 : undefined,
    tl: p.tagLogic === 'AND' ? 1 : undefined,
    src: srcBits || undefined,
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(compact));
}

function decodeZToState(z?: string): Partial<Payload> | null {
  if (!z) return null;
  try {
    const raw = JSON.parse(LZString.decompressFromEncodedURIComponent(z) || '{}') as ZPayload;
    return {
      el: raw.e ? fromBitfield(raw.e, ELEM_INV, 5) : [],
      cl: raw.c ? fromBitfield(raw.c, CLASS_INV, 5) : [],
      r: raw.r ? fromBitfield(raw.r, RARITY_INV, 3) : [],
      chain: raw.ch ? fromBitfield(raw.ch, CHAIN_INV, 3) : [],
      gift: raw.g ? fromBitfield(raw.g, GIFT_INV, 5) : [],
      buffs: raw.b?.map(id => BUFF_INV[id]).filter(Boolean) ?? [],
      debuffs: raw.d?.map(id => DEBUFF_INV[id]).filter(Boolean) ?? [],
      role: raw.r2 ? fromBitfield(raw.r2, ROLE_INV, 3) : [],
      tags: raw.t?.map(id => TAG_INV[id]).filter(Boolean) ?? [],
      logic: raw.l === 1 ? 'AND' : 'OR',
      q: raw.q,
      uniq: raw.u === 1,
      tagLogic: raw.tl === 1 ? 'AND' : 'OR',
      sources: raw.src ? fromBitfield(raw.src, SRC_INV, 5) as SkillKey[] : [],
    };
  } catch {
    return null;
  }
}

// ── Effect grouping ──

const BUFF_CATEGORY_ORDER = ['statBoosts', 'supporting', 'utility', 'unique'];
const DEBUFF_CATEGORY_ORDER = ['statReduction', 'cc', 'dot', 'utility', 'unique'];

function groupEffectsByCategory(
  effectNames: string[], allEffects: Effect[], type: 'buff' | 'debuff', showUnique: boolean
): { title: string; effects: string[] }[] {
  const effectMap = new Map(allEffects.map(e => [e.name, e]));
  const groups = new Map<string, string[]>();
  const seen = new Set<string>();

  for (const name of effectNames) {
    const effect = effectMap.get(name);
    if (!effect) continue;
    const canonical = effect.group || name;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const canonicalEffect = effectMap.get(canonical) || effect;
    const category = canonicalEffect.category || 'unique';
    if (category === 'hidden') continue;
    if (!showUnique && category === 'unique') continue;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(canonical);
  }

  const categoryOrder = type === 'buff' ? BUFF_CATEGORY_ORDER : DEBUFF_CATEGORY_ORDER;
  const sortedCategories = [...groups.keys()].sort(
    (a, b) => (categoryOrder.indexOf(a) === -1 ? 999 : categoryOrder.indexOf(a))
           - (categoryOrder.indexOf(b) === -1 ? 999 : categoryOrder.indexOf(b))
  );

  return sortedCategories.map(category => ({
    title: `characters.effectsGroups.${type}.${category}`,
    effects: groups.get(category)!,
  }));
}

function splitIntoRows<T>(arr: T[], rows = 2): T[][] {
  if (rows <= 1) return [arr];
  const perRow = Math.ceil(arr.length / rows);
  const out: T[][] = [];
  for (let i = 0; i < rows; i++) out.push(arr.slice(i * perRow, (i + 1) * perRow));
  return out;
}

function CheckboxSelect({
  title, effects, effectsMap, selected, type, lang, onToggle,
}: {
  title: string;
  effects: string[];
  effectsMap: Map<string, Effect>;
  selected: string[];
  type: 'buff' | 'debuff';
  lang: Lang;
  onToggle: (effectKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = effects.filter(k => selected.includes(k)).length;
  const border = type === 'buff' ? 'ring-cyan-500/50' : 'ring-red-500/50';
  const accent = type === 'buff' ? 'accent-cyan-500' : 'accent-red-500';
  const color = type === 'buff' ? 'text-cyan-300' : 'text-red-300';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm ring-1 ${open ? border : 'ring-zinc-700'}`}
      >
        <span className={`font-semibold ${color}`}>{title}</span>
        <span className="flex items-center gap-1.5">
          {count > 0 && (
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${type === 'buff' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-red-500/30 text-red-300'}`}>
              {count}
            </span>
          )}
          <svg className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full max-h-60 overflow-y-auto rounded-lg bg-zinc-800 ring-1 ring-zinc-600 shadow-xl">
          {effects.map(effectKey => {
            const effect = effectsMap.get(effectKey);
            if (!effect) return null;
            const effectLabel = l(effect, 'label', lang);
            const isIrremovable = effect.icon.includes('Interruption');
            const imageFilter = isIrremovable ? '' : `${type}-icon`;
            const checked = selected.includes(effectKey);
            return (
              <label
                key={effectKey}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none transition ${checked ? 'bg-zinc-700/60' : 'hover:bg-zinc-700/30'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(effectKey)}
                  className={`${accent} w-4 h-4 shrink-0`}
                />
                <span className="relative h-5 w-5 shrink-0 rounded bg-black">
                  <Image
                    src={`/images/ui/effect/${effect.icon}.webp`}
                    alt=""
                    fill
                    sizes="20px"
                    className={`object-contain ${imageFilter}`}
                  />
                </span>
                <span className="text-xs text-zinc-200">{effectLabel}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EffectGroupGrid({
  groups, effectsMap, selected, type, lang, onToggle, className,
}: {
  groups: { title: string; effects: string[] }[];
  effectsMap: Map<string, Effect>;
  selected: string[];
  type: 'buff' | 'debuff';
  lang: Lang;
  onToggle: (effectKey: string) => void;
  className: string;
}) {
  const { t } = useI18n();
  const color = type === 'buff' ? 'text-cyan-300' : 'text-red-300';
  return (
    <>
      {/* Desktop: icon grid */}
      <div className={`hidden md:grid ${className}`}>
        {groups.map((group, i) => (
          <div key={`${type}-${i}`} className="rounded-xl bg-zinc-800/40 ring-1 ring-zinc-700 p-2">
            <p className={`text-center ${color} font-semibold mb-2`}>
              {t(group.title as TranslationKey)}
            </p>
            <div className="grid grid-cols-7 gap-1 justify-items-center">
              {group.effects.map(effectKey => {
                const effect = effectsMap.get(effectKey);
                if (!effect) return null;
                return (
                  <EffectIcon
                    key={effectKey}
                    effect={effect}
                    type={type}
                    lang={lang}
                    selected={selected.includes(effectKey)}
                    onClick={() => onToggle(effectKey)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: checkbox select dropdowns */}
      <div className="md:hidden space-y-1.5">
        {groups.map((group, i) => (
          <CheckboxSelect
            key={`${type}-m-${i}`}
            title={t(group.title as TranslationKey)}
            effects={group.effects}
            effectsMap={effectsMap}
            selected={selected}
            type={type}
            lang={lang}
            onToggle={onToggle}
          />
        ))}
      </div>
    </>
  );
}

// ── Main component ──

type ClientProps = {
  characters: CharacterListEntry[];
  lang: Lang;
};

type IndexedCharacter = CharacterListEntry & {
  searchNames: string[];
  displayName: string;
  prefix: string | null;
};

export default function CharactersPageClient({ characters, lang }: ClientProps) {
  const { t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  // Filter state
  const [elementFilter, setElementFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [chainFilter, setChainFilter] = useState<string[]>([]);
  const [giftFilter, setGiftFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleType[]>([]);
  const [selectedBuffs, setSelectedBuffs] = useState<string[]>([]);
  const [selectedDebuffs, setSelectedDebuffs] = useState<string[]>([]);
  const [effectLogic, setEffectLogic] = useState<'AND' | 'OR'>('OR');
  const [showUniqueEffects, setShowUniqueEffects] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SkillKey[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagLogic, setTagLogic] = useState<'AND' | 'OR'>('OR');
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lazy-loaded data
  const [buffsMetadata, setBuffsMetadata] = useState<Effect[]>([]);
  const [debuffsMetadata, setDebuffsMetadata] = useState<Effect[]>([]);
  const [tagsData, setTagsData] = useState<Record<string, TagMeta> | null>(null);

  // Refs
  const lastSerializedRef = useRef('');
  const didHydrateFromURL = useRef(false);

  // ── Toggle helper (auto-resets to [] when all values selected) ──

  const toggleArray = <T,>(
    setter: React.Dispatch<React.SetStateAction<T[]>>, value: T, allValues?: readonly T[],
  ) => {
    setter(prev => {
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
      return allValues && next.length === allValues.length ? [] : next;
    });
  };

  // ── Derived UI arrays ──

  const ELEMENTS_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...ELEMENTS.map(v => ({ name: v, value: v })),
  ], [t]);

  const CLASSES_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...CLASSES.map(v => ({ name: v, value: v })),
  ], [t]);

  const CHAINS_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...CHAIN_TYPES.map(v => ({
      name: t(`characters.chains.${CHAIN_TYPE_LABELS[v].toLowerCase()}` as TranslationKey),
      value: v,
    })),
  ], [t]);

  const GIFTS_UI = useMemo(() => [
    { name: t('common.all'), value: null as string | null },
    ...GIFTS.map(v => ({ name: t(`characters.gifts.${GIFT_LABELS[v]}` as TranslationKey), value: v })),
  ], [t]);

  const ROLES_UI = useMemo(() => [
    { name: t('common.all'), value: null as RoleType | null },
    ...ROLES.map(v => ({ name: t(`filters.roles.${v}`), value: v })),
  ], [t]);

  // ── All effects from characters ──

  const allBuffs = useMemo(() =>
    [...new Set(characters.flatMap(c => c.buff || []))].sort(), [characters]);
  const allDebuffs = useMemo(() =>
    [...new Set(characters.flatMap(c => c.debuff || []))].sort(), [characters]);

  // ── Effect groups ──

  const buffGroups = useMemo(() => {
    if (buffsMetadata.length === 0) return [];
    return groupEffectsByCategory(allBuffs, buffsMetadata, 'buff', showUniqueEffects);
  }, [allBuffs, buffsMetadata, showUniqueEffects]);

  const debuffGroups = useMemo(() => {
    if (debuffsMetadata.length === 0) return [];
    return groupEffectsByCategory(allDebuffs, debuffsMetadata, 'debuff', showUniqueEffects);
  }, [allDebuffs, debuffsMetadata, showUniqueEffects]);

  const buffsMap = useMemo(() =>
    new Map(buffsMetadata.map(e => [e.name, e])), [buffsMetadata]);
  const debuffsMap = useMemo(() =>
    new Map(debuffsMetadata.map(e => [e.name, e])), [debuffsMetadata]);

  // ── Tag groups ──

  type TagGroup = { type: string; items: { key: string; meta: TagMeta }[] };
  const TAG_GROUPS = useMemo<TagGroup[]>(() => {
    if (!tagsData) return [];
    const mapByType: Record<string, { key: string; meta: TagMeta }[]> = {};
    for (const [key, meta] of Object.entries(tagsData)) {
      (mapByType[meta.type] ||= []).push({ key, meta });
    }
    return Object.entries(mapByType).map(([type, items]) => ({ type, items }));
  }, [tagsData]);

  // ── Payload ──

  const payload = useMemo<Payload>(() => ({
    el: elementFilter.length ? elementFilter : undefined,
    cl: classFilter.length ? classFilter : undefined,
    r: rarityFilter.length ? rarityFilter : undefined,
    chain: chainFilter.length ? chainFilter : undefined,
    gift: giftFilter.length ? giftFilter : undefined,
    buffs: selectedBuffs.length ? selectedBuffs : undefined,
    debuffs: selectedDebuffs.length ? selectedDebuffs : undefined,
    logic: effectLogic !== 'OR' ? effectLogic : undefined,
    q: rawQuery.trim() || undefined,
    uniq: showUniqueEffects || undefined,
    role: roleFilter.length ? roleFilter : undefined,
    tags: tagFilter.length ? tagFilter : undefined,
    tagLogic: tagLogic !== 'OR' ? tagLogic : undefined,
    sources: sourceFilter.length ? sourceFilter : undefined,
  }), [elementFilter, classFilter, rarityFilter, chainFilter, giftFilter,
    selectedBuffs, selectedDebuffs, effectLogic, rawQuery, showUniqueEffects,
    roleFilter, tagFilter, tagLogic, sourceFilter]);

  const applyPayload = (p: Partial<Payload>) => {
    setElementFilter(p.el ?? []);
    setClassFilter(p.cl ?? []);
    setRarityFilter((p.r ?? []) as RarityType[]);
    setChainFilter(p.chain ?? []);
    setGiftFilter(p.gift ?? []);
    setSelectedBuffs(p.buffs ?? []);
    setSelectedDebuffs(p.debuffs ?? []);
    setRawQuery(p.q ?? '');
    setEffectLogic(p.logic === 'AND' ? 'AND' : 'OR');
    setShowUniqueEffects(Boolean(p.uniq));
    setRoleFilter((p.role ?? []).filter((v): v is RoleType => ROLES.includes(v as RoleType)));
    setTagFilter(p.tags ?? []);
    setTagLogic(p.tagLogic === 'AND' ? 'AND' : 'OR');
    setSourceFilter(p.sources ?? []);
  };

  // ── Pre-indexed characters (with pre-computed display name & prefix) ──

  const indexedCharacters = useMemo<IndexedCharacter[]>(() =>
    characters.map(char => {
      const displayName = l(char, 'Fullname', lang);
      const nameParts = splitCharacterName(char.ID, displayName, lang);
      return {
        ...char,
        searchNames: getSearchableNames(char, LANGS),
        displayName,
        prefix: nameParts.prefix,
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName)), [characters, lang]);

  // ── Filtered characters (Set-based lookups) ──

  const filtered = useMemo(() => {
    const q = norm(query);
    const elemSet = new Set(elementFilter);
    const classSet = new Set(classFilter);
    const raritySet = new Set(rarityFilter);
    const chainSet = new Set(chainFilter);
    const giftSet = new Set(giftFilter);
    const roleSet = new Set(roleFilter);

    return indexedCharacters.filter(char => {
      if (q && !char.searchNames.some(name => name.includes(q))) return false;
      if (elemSet.size && !elemSet.has(char.Element)) return false;
      if (classSet.size && !classSet.has(char.Class)) return false;
      if (raritySet.size && !raritySet.has(char.Rarity)) return false;
      if (chainSet.size && !chainSet.has(char.Chain_Type)) return false;
      if (giftSet.size && !giftSet.has(char.gift)) return false;
      if (roleSet.size && !roleSet.has(char.role)) return false;

      // Effect matching (effects are pre-canonicalized in the pipeline)
      if (selectedBuffs.length || selectedDebuffs.length) {
        const hasBuffs = selectedBuffs.length > 0
          ? (effectLogic === 'AND'
            ? selectedBuffs.every(b => charHasEffectFromSources(char, b, 'buff', sourceFilter))
            : selectedBuffs.some(b => charHasEffectFromSources(char, b, 'buff', sourceFilter)))
          : true;
        const hasDebuffs = selectedDebuffs.length > 0
          ? (effectLogic === 'AND'
            ? selectedDebuffs.every(d => charHasEffectFromSources(char, d, 'debuff', sourceFilter))
            : selectedDebuffs.some(d => charHasEffectFromSources(char, d, 'debuff', sourceFilter)))
          : true;

        const effectMatch = (selectedBuffs.length > 0 && selectedDebuffs.length > 0)
          ? (effectLogic === 'AND' ? hasBuffs && hasDebuffs : hasBuffs || hasDebuffs)
          : (selectedBuffs.length > 0 ? hasBuffs : hasDebuffs);

        if (!effectMatch) return false;
      }

      // Tag matching
      if (tagFilter.length) {
        const tagMatch = tagLogic === 'AND'
          ? tagFilter.every(t => char.tags?.includes(t))
          : tagFilter.some(t => char.tags?.includes(t));
        if (!tagMatch) return false;
      }

      return true;
    });
  }, [indexedCharacters, query, elementFilter, classFilter, chainFilter,
    giftFilter, rarityFilter, selectedBuffs, selectedDebuffs, effectLogic,
    roleFilter, tagFilter, tagLogic, sourceFilter]);

  // ── Effects ──

  // Hydrate from URL
  useEffect(() => {
    if (didHydrateFromURL.current) return;
    didHydrateFromURL.current = true;
    const z = new URLSearchParams(window.location.search).get('z');
    const decoded = decodeZToState(z || undefined);
    if (decoded) {
      applyPayload(decoded);
      if ((decoded.buffs?.length || 0) + (decoded.debuffs?.length || 0) > 0) setShowFilters(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy load buffs/debuffs metadata
  useEffect(() => {
    if (showFilters && buffsMetadata.length === 0) {
      Promise.all([
        import('@data/effects/buffs.json'),
        import('@data/effects/debuffs.json'),
      ]).then(([buffsModule, debuffsModule]) => {
        setBuffsMetadata(buffsModule.default as Effect[]);
        setDebuffsMetadata(debuffsModule.default as Effect[]);
      });
    }
  }, [showFilters, buffsMetadata.length]);

  // Lazy load tags
  useEffect(() => {
    if (showTagsPanel && !tagsData) {
      import('@data/tags.json').then(module => {
        setTagsData(module.default as Record<string, TagMeta>);
      });
    }
  }, [showTagsPanel, tagsData]);

  // Sync filters → URL
  useEffect(() => {
    const handle = setTimeout(() => {
      const isEmpty = !payload.el && !payload.cl && !payload.r && !payload.chain
        && !payload.gift && !payload.buffs && !payload.debuffs && !payload.role
        && !payload.tags && !payload.logic && !payload.q && !payload.uniq;
      const serialized = isEmpty ? pathname : `${pathname}?z=${encodeStateToZ(payload)}`;
      if (lastSerializedRef.current !== serialized) {
        lastSerializedRef.current = serialized;
        router.replace(serialized as never, { scroll: false });
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [pathname, router, payload]);

  // ── Actions ──

  const copyShareUrl = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const resetAll = () => {
    setElementFilter([]);
    setClassFilter([]);
    setRarityFilter([]);
    setChainFilter([]);
    setGiftFilter([]);
    setSelectedBuffs([]);
    setSelectedDebuffs([]);
    setEffectLogic('OR');
    setRawQuery('');
    setRoleFilter([]);
    setTagFilter([]);
    setTagLogic('OR');
    setShowUniqueEffects(false);
    setSourceFilter([]);
    setShowFilters(false);
    setShowTagsPanel(false);
    lastSerializedRef.current = pathname;
    router.replace(pathname as never, { scroll: false });
  };

  const hasActiveFilters = Boolean(
    payload.el || payload.cl || payload.r || payload.chain || payload.gift
    || payload.role || payload.tags || payload.buffs || payload.debuffs
  );

  // ── Render ──

  return (
    <div className="mx-auto max-w-350 px-2 md:px-4 space-y-3">
      {/* Search */}
      <FilterSearch value={rawQuery} onChange={setRawQuery} placeholder={t('search.placeholder')} />

      {/* Match count */}
      {hasActiveFilters && (
        <div className="flex justify-center">
          <span className="text-xs text-zinc-400">
            {t('characters.common.matches', { count: filtered.length })}
          </span>
        </div>
      )}

      {/* Rarity */}
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300">{t('filters.rarity')}</p>
      <div className="flex justify-center gap-2">
        <FilterPill
          active={rarityFilter.length === 0}
          onClick={() => setRarityFilter([])}
          className="h-8 px-3"
        >
          {t('common.all')}
        </FilterPill>
        {RARITIES.map(r => (
          <FilterPill
            key={r}
            active={rarityFilter.includes(r)}
            onClick={() => toggleArray(setRarityFilter, r, RARITIES)}
            className="h-8 px-3"
          >
            <div className="flex items-center -space-x-1">
              {Array.from({ length: r }, (_, i) => (
                <Image key={i} src="/images/ui/star/CM_icon_star_y.webp" alt="star" width={16} height={16} style={{ width: 16, height: 16 }} />
              ))}
            </div>
          </FilterPill>
        ))}
      </div>

      {/* Elements + Classes */}
      <div className="mx-auto max-w-205 grid grid-cols-1 md:grid-cols-2 gap-y-2 md:gap-x-6 place-items-center">
        <IconFilterGroup
          label={t('filters.elements')}
          items={ELEMENTS_UI}
          filter={elementFilter}
          onToggle={v => toggleArray(setElementFilter, v, ELEMENTS)}
          onReset={() => setElementFilter([])}
          imagePath={v => `/images/ui/elem/CM_Element_${v}.webp`}
        />
        <IconFilterGroup
          label={t('filters.classes')}
          items={CLASSES_UI}
          filter={classFilter}
          onToggle={v => toggleArray(setClassFilter, v, CLASSES)}
          onReset={() => setClassFilter([])}
          imagePath={v => `/images/ui/class/CM_Class_${v}.webp`}
        />
      </div>

      {/* Chains + Roles */}
      <div className="mx-auto max-w-205 grid grid-cols-1 md:grid-cols-2 gap-y-2 md:gap-x-6 place-items-center">
        <TextFilterGroup
          label={t('characters.filters.chains')}
          items={CHAINS_UI}
          filter={chainFilter}
          onToggle={v => toggleArray(setChainFilter, v, CHAIN_TYPES)}
          onReset={() => setChainFilter([])}
        />
        <TextFilterGroup
          label={t('characters.filters.roles')}
          items={ROLES_UI}
          filter={roleFilter}
          onToggle={v => toggleArray(setRoleFilter, v, ROLES)}
          onReset={() => setRoleFilter([])}
        />
      </div>

      {/* Gifts */}
      <TextFilterGroup
        label={t('characters.filters.gifts')}
        items={GIFTS_UI}
        filter={giftFilter}
        onToggle={v => toggleArray(setGiftFilter, v, GIFTS)}
        onReset={() => setGiftFilter([])}
      />

      {/* Toggle Buff/Debuff filters */}
      <div className="text-center mt-4">
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => setShowFilters(s => !s)}
            className={`rounded ${FILTER.bg} px-4 py-2 text-sm text-white ${FILTER.hover} transition`}
          >
            {showFilters ? t('characters.filters.hideBuffs') : t('characters.filters.showBuffs')}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-col items-center gap-2 w-full mt-3 mb-2">
            {/* Header controls */}
            <div className="flex justify-center gap-3 items-center">
              <label htmlFor="show-unique" className={`inline-flex items-center gap-2 h-9 px-3 rounded text-sm text-white cursor-pointer select-none ${FILTER.bg} ${FILTER.hover} transition`}>
                <input type="checkbox" id="show-unique" checked={showUniqueEffects} onChange={() => setShowUniqueEffects(v => !v)} className="accent-cyan-500 w-4 h-4" />
                {t('characters.filters.unique')}
              </label>

              <div className={`inline-grid grid-cols-2 rounded ${FILTER.bg} text-xs`}>
                <button type="button" className={`px-2 py-1 rounded-l ${effectLogic === 'AND' ? FILTER.active : ''}`} onClick={() => setEffectLogic('AND')}>{t('characters.filters.and')}</button>
                <button type="button" className={`px-2 py-1 rounded-r ${effectLogic === 'OR' ? FILTER.active : ''}`} onClick={() => setEffectLogic('OR')}>{t('characters.filters.or')}</button>
              </div>
            </div>

            {/* Source filter */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-zinc-300">{t('characters.filters.sources.filterBySource')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SKILL_SOURCES.map(source => (
                  <FilterPill
                    key={source.key}
                    active={sourceFilter.includes(source.key)}
                    onClick={() => toggleArray(setSourceFilter, source.key)}
                    className="h-8 px-2.5 text-xs"
                  >
                    {t(source.labelKey as TranslationKey)}
                  </FilterPill>
                ))}
              </div>
            </div>

            {/* Buffs/Debuffs grid */}
            <div className="mx-auto max-w-5xl w-full rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4">
              <p className="text-center text-xs uppercase tracking-wide text-cyan-300 mb-2">{t('characters.filters.buffs')}</p>
              <EffectGroupGrid
                groups={buffGroups}
                effectsMap={buffsMap}
                selected={selectedBuffs}
                type="buff"
                lang={lang}
                onToggle={key => toggleArray(setSelectedBuffs, key)}
                className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
              />

              <div className="my-4 border-t border-zinc-700" />

              <p className="text-center text-xs uppercase tracking-wide text-red-300 mb-2">{t('characters.filters.debuffs')}</p>
              <EffectGroupGrid
                groups={debuffGroups}
                effectsMap={debuffsMap}
                selected={selectedDebuffs}
                type="debuff"
                lang={lang}
                onToggle={key => toggleArray(setSelectedDebuffs, key)}
                className="grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3"
              />
            </div>
          </div>
        )}

        {/* Tags toggle */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowTagsPanel(s => !s)}
            className={`rounded ${FILTER.bg} px-4 py-2 text-sm text-white ${FILTER.hover} transition`}
          >
            {showTagsPanel ? t('characters.filters.hideTags') : t('characters.filters.showTags')}
          </button>
        </div>

        {showTagsPanel && (
          <div className="w-full mt-2">
            <div className="flex justify-center gap-3 items-center mb-2">
              <div className={`inline-grid grid-cols-2 rounded ${FILTER.bg} text-xs`}>
                <button type="button" className={`px-2 py-1 rounded-l ${tagLogic === 'AND' ? FILTER.active : ''}`} onClick={() => setTagLogic('AND')}>{t('characters.filters.and')}</button>
                <button type="button" className={`px-2 py-1 rounded-r ${tagLogic === 'OR' ? FILTER.active : ''}`} onClick={() => setTagLogic('OR')}>{t('characters.filters.or')}</button>
              </div>
            </div>
            <div className="mx-auto max-w-5xl rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4">
              <div className="grid md:grid-cols-2 gap-6">
                {TAG_GROUPS.map(group => (
                  <div key={group.type}>
                    <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-2">
                      {t(`characters.tags.types.${group.type}` as TranslationKey)}
                    </p>
                    <div className="space-y-2">
                      {splitIntoRows(group.items, 2).map((row, ridx) => (
                        <div
                          key={`row-${group.type}-${ridx}`}
                          className="grid grid-cols-[repeat(auto-fit,minmax(120px,max-content))] gap-2 justify-center justify-items-center"
                        >
                          {row.map(({ key, meta }) => (
                            <FilterPill
                              key={key}
                              title={l(meta, 'desc', lang)}
                              active={tagFilter.includes(key)}
                              onClick={() => toggleArray(setTagFilter, key)}
                              className="w-auto min-w-30 h-8 px-2 text-[11px] gap-1 justify-center"
                            >
                              <div className="flex items-center gap-1.5">
                                {meta.image && (
                                  <div className="relative h-4 w-4 shrink-0">
                                    <Image src={meta.image} alt="" fill sizes="16px" className="object-contain" />
                                  </div>
                                )}
                                <span>{l(meta, 'label', lang)}</span>
                              </div>
                            </FilterPill>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 mb-4 flex flex-wrap justify-center gap-4">
          <button type="button" onClick={resetAll} className={`rounded ${FILTER.bg} px-4 py-1 text-sm text-white hover:bg-red-700 transition`}>
            {t('characters.filters.reset')}
          </button>
          <button type="button" onClick={copyShareUrl} className={`rounded ${FILTER.bg} px-4 py-1 text-sm text-white ${FILTER.hover} transition`}>
            {copied ? t('common.copied') : t('characters.filters.copy')}
          </button>
        </div>
      </div>

      {/* Character grid */}
      <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
        {filtered.map((char, index) => (
          <ResponsiveCharacterCard
            key={char.ID}
            id={char.ID}
            name={char.displayName}
            prefix={char.prefix}
            element={char.Element}
            classType={char.Class}
            rarity={char.Rarity}
            tags={char.tags}
            href={href(`/characters/${char.slug}`)}
            priority={index <= 5}
          />
        ))}
      </div>
    </div>
  );
}

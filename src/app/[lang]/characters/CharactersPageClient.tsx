'use client';

import { use, useEffect, useState, useMemo, useRef, useDeferredValue } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import LZString from 'lz-string';
type EffectsIndex = {
  buffs: Record<string, number>;
  debuffs: Record<string, number>;
  tags?: Record<string, number>;
};
const effectsIndexPromise = import('@data/generated/effectsIndex.json').then(m => m.default as EffectsIndex);
type StatEntry = { label: string; icon: string };
const statsPromise = import('@data/stats.json').then(m => m.default as Record<string, StatEntry>);
import type { CharacterListEntry } from '@/types/character';
import type { Effect } from '@/types/effect';
import type { Lang } from '@/lib/i18n/config';
import { LANGS } from '@/lib/i18n/config';
import {
  type RoleType, type SkillKey, type RarityType, type ElementType, type ChainType, type GiftType,
  ELEMENTS, CLASSES, CHAIN_TYPES, RARITIES, ROLES, GIFTS,
  GIFT_LABELS, CHAIN_TYPE_LABELS, SKILL_SOURCES,
} from '@/types/enums';
import type { TranslationKey } from '@/i18n/locales/en';
import { useI18n } from '@/lib/contexts/I18nContext';
import { l } from '@/lib/i18n/localize';
import type { WithLocalizedFields } from '@/types/common';
import ResponsiveCharacterCard from '@/app/components/character/ResponsiveCharacterCard';
import { splitCharacterName } from '@/lib/character-name';
import type { FilterSelectOption } from '@/app/components/ui/FilterPills';
import CharactersFiltersBar from '@/app/components/characters/filters/CharactersFiltersBar';
import CharactersFiltersDrawer from '@/app/components/characters/filters/CharactersFiltersDrawer';
import type { DrawerTagGroup } from '@/app/components/characters/filters/CharactersFiltersDrawer';
import ActiveFiltersStrip, { type ActiveChipItem } from '@/app/components/characters/filters/ActiveFiltersStrip';
import { ELEMENT_HEX, ROLE_HEX, RARITY_HEX, TONE } from '@/app/components/characters/filters/FilterAtoms';

// ── URL encoding maps ──

// Bitfield maps: value → bit position (0-indexed)
const ELEM_BIT: Record<string, number> = { Fire: 0, Water: 1, Earth: 2, Light: 3, Dark: 4 };
const CLASS_BIT: Record<string, number> = { Striker: 0, Defender: 1, Ranger: 2, Healer: 3, Mage: 4 };
const CHAIN_BIT: Record<string, number> = { Start: 0, Join: 1, Finish: 2 };
const GIFT_BIT: Record<string, number> = { Science: 0, Luxury: 1, 'Magic Tool': 2, Craftwork: 3, 'Natural Object': 4 };
const RARITY_BIT: Record<number, number> = { 1: 0, 2: 1, 3: 2 };
const ROLE_BIT: Record<string, number> = { dps: 0, support: 1, sustain: 2 };
const SRC_BIT: Record<string, number> = { SKT_FIRST: 0, SKT_SECOND: 1, SKT_ULTIMATE: 2, SKT_CHAIN_PASSIVE: 3, DUAL_ATTACK: 4, EXCLUSIVE_EQUIP: 5, SKT_FUSION_PASSIVE: 6 };
// Team bonus stat keys — derived at runtime from character data, but bitfield
// encoding needs stable indices. We use a fixed ordering of known stat keys.
const TB_KEYS = ['SPD', 'ATK', 'HP', 'DEF', 'CHD', 'CHC', 'DMG UP%', 'DMG RED%', 'CDMG RED%', 'PEN%', 'EFF', 'RES', 'LS'] as const;
const TB_BIT: Record<string, number> = Object.fromEntries(TB_KEYS.map((v, i) => [v, i]));
const TB_INV: Record<number, string> = Object.fromEntries(TB_KEYS.map((v, i) => [i, v]));

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

// Index-based maps for buffs/debuffs/tags — derived lazily from the promise
type EffectMaps = {
  BUFF_ID: Record<string, number>;
  DEBUFF_ID: Record<string, number>;
  TAG_ID: Record<string, number>;
  BUFF_INV: Record<number, string>;
  DEBUFF_INV: Record<number, string>;
  TAG_INV: Record<number, string>;
};

function buildEffectMaps(idx: EffectsIndex): EffectMaps {
  const BUFF_ID = idx.buffs;
  const DEBUFF_ID = idx.debuffs;
  const TAG_ID = idx.tags ?? {};
  return {
    BUFF_ID,
    DEBUFF_ID,
    TAG_ID,
    BUFF_INV: Object.fromEntries(Object.entries(BUFF_ID).map(([k, v]) => [v, k])),
    DEBUFF_INV: Object.fromEntries(Object.entries(DEBUFF_ID).map(([k, v]) => [v, k])),
    TAG_INV: Object.fromEntries(Object.entries(TAG_ID).map(([k, v]) => [v, k])),
  };
}

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
  tb?: string[];
};

type ZPayload = {
  e?: number; c?: number; r?: number; ch?: number; g?: number;
  b?: number[]; d?: number[];
  l?: 0 | 1; q?: string;
  r2?: number; t?: number[]; tl?: 0 | 1;
  src?: number; u?: 0 | 1;
  tb?: number;
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

function encodeStateToZ(p: Payload, maps: EffectMaps): string {
  const eBits = isArr(p.el) ? toBitfield(p.el!, ELEM_BIT) : undefined;
  const cBits = isArr(p.cl) ? toBitfield(p.cl!, CLASS_BIT) : undefined;
  const rBits = isArr(p.r) ? toBitfield(p.r!, RARITY_BIT) : undefined;
  const chBits = isArr(p.chain) ? toBitfield(p.chain!, CHAIN_BIT) : undefined;
  const gBits = isArr(p.gift) ? toBitfield(p.gift!, GIFT_BIT) : undefined;
  const r2Bits = isArr(p.role) ? toBitfield(p.role!, ROLE_BIT) : undefined;
  const srcBits = isArr(p.sources) ? toBitfield(p.sources!, SRC_BIT) : undefined;
  const tbBits = isArr(p.tb) ? toBitfield(p.tb!, TB_BIT) : undefined;

  const compact: ZPayload = {
    e: eBits || undefined,
    c: cBits || undefined,
    r: rBits || undefined,
    ch: chBits || undefined,
    g: gBits || undefined,
    b: isArr(p.buffs) ? p.buffs!.map(x => maps.BUFF_ID[x]).filter(Boolean) : undefined,
    d: isArr(p.debuffs) ? p.debuffs!.map(x => maps.DEBUFF_ID[x]).filter(Boolean) : undefined,
    r2: r2Bits || undefined,
    t: isArr(p.tags) ? p.tags!.map(x => maps.TAG_ID[x]).filter(Boolean) : undefined,
    l: p.logic === 'AND' ? 1 : undefined,
    q: p.q || undefined,
    u: p.uniq ? 1 : undefined,
    tl: p.tagLogic === 'AND' ? 1 : undefined,
    src: srcBits || undefined,
    tb: tbBits || undefined,
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(compact));
}

function decodeZToState(z: string | undefined, maps: EffectMaps): Partial<Payload> | null {
  if (!z) return null;
  try {
    const raw = JSON.parse(LZString.decompressFromEncodedURIComponent(z) || '{}') as ZPayload;
    return {
      el: raw.e ? fromBitfield(raw.e, ELEM_INV, 5) : [],
      cl: raw.c ? fromBitfield(raw.c, CLASS_INV, 5) : [],
      r: raw.r ? fromBitfield(raw.r, RARITY_INV, 3) : [],
      chain: raw.ch ? fromBitfield(raw.ch, CHAIN_INV, 3) : [],
      gift: raw.g ? fromBitfield(raw.g, GIFT_INV, 5) : [],
      buffs: raw.b?.map(id => maps.BUFF_INV[id]).filter(Boolean) ?? [],
      debuffs: raw.d?.map(id => maps.DEBUFF_INV[id]).filter(Boolean) ?? [],
      role: raw.r2 ? fromBitfield(raw.r2, ROLE_INV, 3) : [],
      tags: raw.t?.map(id => maps.TAG_INV[id]).filter(Boolean) ?? [],
      logic: raw.l === 1 ? 'AND' : 'OR',
      q: raw.q,
      uniq: raw.u === 1,
      tagLogic: raw.tl === 1 ? 'AND' : 'OR',
      sources: raw.src ? fromBitfield(raw.src, SRC_INV, 7) as SkillKey[] : [],
      tb: raw.tb ? fromBitfield(raw.tb, TB_INV, TB_KEYS.length) : [],
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
  const effectsIndex = use(effectsIndexPromise);
  const statsData = use(statsPromise);
  const effectMaps = useMemo(() => buildEffectMaps(effectsIndex), [effectsIndex]);
  const { t, href } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  // Filter state
  const [elementFilter, setElementFilter] = useState<ElementType[]>([]);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [chainFilter, setChainFilter] = useState<ChainType[]>([]);
  const [giftFilter, setGiftFilter] = useState<GiftType[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleType[]>([]);
  const [selectedBuffs, setSelectedBuffs] = useState<string[]>([]);
  const [selectedDebuffs, setSelectedDebuffs] = useState<string[]>([]);
  const [effectLogic, setEffectLogic] = useState<'AND' | 'OR'>('OR');
  const [showUniqueEffects, setShowUniqueEffects] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SkillKey[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagLogic, setTagLogic] = useState<'AND' | 'OR'>('OR');
  const [teamBonusFilter, setTeamBonusFilter] = useState<string[]>([]);
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);

  // UI state
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // ── Team bonus UI items (derived from characters + stats.json) ──

  const TEAM_BONUSES_UI = useMemo<FilterSelectOption[]>(() => {
    const bonusKeys = [...new Set(characters.flatMap(c => c.teamBonuses ?? []))];
    bonusKeys.sort((a, b) => {
      const ia = TB_KEYS.indexOf(a as typeof TB_KEYS[number]);
      const ib = TB_KEYS.indexOf(b as typeof TB_KEYS[number]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return bonusKeys.map(key => ({
      value: key,
      label: statsData[key]?.label ?? key,
      image: statsData[key]?.icon ? `/images/ui/effect/${statsData[key].icon}` : undefined,
    }));
  }, [characters, statsData]);

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
    tb: teamBonusFilter.length ? teamBonusFilter : undefined,
  }), [elementFilter, classFilter, rarityFilter, chainFilter, giftFilter,
    selectedBuffs, selectedDebuffs, effectLogic, rawQuery, showUniqueEffects,
    roleFilter, tagFilter, tagLogic, sourceFilter, teamBonusFilter]);

  const applyPayload = (p: Partial<Payload>) => {
    setElementFilter((p.el ?? []) as ElementType[]);
    setClassFilter(p.cl ?? []);
    setRarityFilter((p.r ?? []) as RarityType[]);
    setChainFilter((p.chain ?? []) as ChainType[]);
    setGiftFilter((p.gift ?? []) as GiftType[]);
    setSelectedBuffs(p.buffs ?? []);
    setSelectedDebuffs(p.debuffs ?? []);
    setRawQuery(p.q ?? '');
    setEffectLogic(p.logic === 'AND' ? 'AND' : 'OR');
    setShowUniqueEffects(Boolean(p.uniq));
    setRoleFilter((p.role ?? []).filter((v): v is RoleType => ROLES.includes(v as RoleType)));
    setTagFilter(p.tags ?? []);
    setTagLogic(p.tagLogic === 'AND' ? 'AND' : 'OR');
    setSourceFilter(p.sources ?? []);
    setTeamBonusFilter(p.tb ?? []);
  };

  // ── Pre-indexed characters (with pre-computed display name & prefix) ──

  const indexedCharacters = useMemo<IndexedCharacter[]>(() =>
    characters.map(char => {
      const displayName = l(char, 'Fullname', lang);
      const nameParts = splitCharacterName(displayName, lang);
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
      if (giftSet.size && !giftSet.has(char.gift as GiftType)) return false;
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

      // Team bonus matching
      if (teamBonusFilter.length) {
        if (!char.teamBonuses?.some(tb => teamBonusFilter.includes(tb))) return false;
      }

      return true;
    });
  }, [indexedCharacters, query, elementFilter, classFilter, chainFilter,
    giftFilter, rarityFilter, selectedBuffs, selectedDebuffs, effectLogic,
    roleFilter, tagFilter, tagLogic, sourceFilter, teamBonusFilter]);

  // ── Effects ──

  // Hydrate from URL
  useEffect(() => {
    if (didHydrateFromURL.current) return;
    didHydrateFromURL.current = true;
    const z = new URLSearchParams(window.location.search).get('z');
    const decoded = decodeZToState(z || undefined, effectMaps);
    if (decoded) applyPayload(decoded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy load buffs/debuffs metadata when drawer opens or when URL had effects
  const wantsEffectsData =
    drawerOpen || selectedBuffs.length > 0 || selectedDebuffs.length > 0;
  useEffect(() => {
    if (wantsEffectsData && buffsMetadata.length === 0) {
      Promise.all([
        import('@data/effects/buffs.json'),
        import('@data/effects/debuffs.json'),
      ]).then(([buffsModule, debuffsModule]) => {
        setBuffsMetadata(buffsModule.default as Effect[]);
        setDebuffsMetadata(debuffsModule.default as Effect[]);
      });
    }
  }, [wantsEffectsData, buffsMetadata.length]);

  // Lazy load tags when drawer opens or when URL had tag filters
  const wantsTagsData = drawerOpen || tagFilter.length > 0;
  useEffect(() => {
    if (wantsTagsData && !tagsData) {
      import('@data/tags.json').then(module => {
        setTagsData(module.default as Record<string, TagMeta>);
      });
    }
  }, [wantsTagsData, tagsData]);

  // Sync filters → URL
  useEffect(() => {
    const handle = setTimeout(() => {
      const isEmpty = !payload.el && !payload.cl && !payload.r && !payload.chain
        && !payload.gift && !payload.buffs && !payload.debuffs && !payload.role
        && !payload.tags && !payload.logic && !payload.q && !payload.uniq && !payload.tb;
      const serialized = isEmpty ? pathname : `${pathname}?z=${encodeStateToZ(payload, effectMaps)}`;
      if (lastSerializedRef.current !== serialized) {
        lastSerializedRef.current = serialized;
        router.replace(serialized as never, { scroll: false });
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [pathname, router, payload, effectMaps]);

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
    setTeamBonusFilter([]);
    lastSerializedRef.current = pathname;
    router.replace(pathname as never, { scroll: false });
  };

  // ── Active chips (for the strip below the bar) ──

  const tagsMetaIndex = useMemo(() => tagsData ?? {}, [tagsData]);
  const bonusLabelMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const opt of TEAM_BONUSES_UI) m[opt.value] = opt.label;
    return m;
  }, [TEAM_BONUSES_UI]);

  const activeChips: ActiveChipItem[] = useMemo(() => {
    const chips: ActiveChipItem[] = [];
    const q = rawQuery.trim();
    if (q) {
      chips.push({
        key: 's',
        label: `"${q}"`,
        color: TONE.cyan,
        onRemove: () => setRawQuery(''),
      });
    }
    for (const el of elementFilter) {
      chips.push({
        key: `e-${el}`,
        label: el,
        color: ELEMENT_HEX[el as ElementType] ?? TONE.cyan,
        onRemove: () => setElementFilter(prev => prev.filter(v => v !== el)),
      });
    }
    for (const cls of classFilter) {
      chips.push({
        key: `c-${cls}`,
        label: cls,
        color: TONE.cyan,
        onRemove: () => setClassFilter(prev => prev.filter(v => v !== cls)),
      });
    }
    for (const r of rarityFilter) {
      chips.push({
        key: `r-${r}`,
        label: `${r}★`,
        color: RARITY_HEX[r],
        onRemove: () => setRarityFilter(prev => prev.filter(v => v !== r)),
      });
    }
    for (const c of chainFilter) {
      const label = t(`characters.chains.${CHAIN_TYPE_LABELS[c as ChainType]?.toLowerCase() ?? c}` as TranslationKey);
      chips.push({
        key: `ch-${c}`,
        label,
        color: TONE.cyan,
        onRemove: () => setChainFilter(prev => prev.filter(v => v !== c)),
      });
    }
    for (const r of roleFilter) {
      chips.push({
        key: `ro-${r}`,
        label: t(`filters.roles.${r}`),
        color: ROLE_HEX[r],
        onRemove: () => setRoleFilter(prev => prev.filter(v => v !== r)),
      });
    }
    for (const g of giftFilter) {
      const label = t(`characters.gifts.${GIFT_LABELS[g as GiftType] ?? g}` as TranslationKey);
      chips.push({
        key: `g-${g}`,
        label,
        color: TONE.amber,
        onRemove: () => setGiftFilter(prev => prev.filter(v => v !== g)),
      });
    }
    for (const tb of teamBonusFilter) {
      chips.push({
        key: `tb-${tb}`,
        label: bonusLabelMap[tb] ?? tb,
        color: TONE.amber,
        onRemove: () => setTeamBonusFilter(prev => prev.filter(v => v !== tb)),
      });
    }
    for (const src of sourceFilter) {
      const meta = SKILL_SOURCES.find(s => s.key === src);
      chips.push({
        key: `src-${src}`,
        label: meta ? t(meta.labelKey as TranslationKey) : src,
        color: TONE.indigo,
        onRemove: () => setSourceFilter(prev => prev.filter(v => v !== src)),
      });
    }
    if (showUniqueEffects) {
      chips.push({
        key: 'uniq',
        label: t('characters.filters.unique'),
        color: TONE.indigo,
        onRemove: () => setShowUniqueEffects(false),
      });
    }
    for (const b of selectedBuffs) {
      const meta = buffsMap.get(b);
      chips.push({
        key: `b-${b}`,
        label: meta ? l(meta, 'label', lang) : b,
        color: TONE.emerald,
        onRemove: () => setSelectedBuffs(prev => prev.filter(v => v !== b)),
      });
    }
    for (const d of selectedDebuffs) {
      const meta = debuffsMap.get(d);
      chips.push({
        key: `d-${d}`,
        label: meta ? l(meta, 'label', lang) : d,
        color: TONE.rose,
        onRemove: () => setSelectedDebuffs(prev => prev.filter(v => v !== d)),
      });
    }
    for (const tk of tagFilter) {
      const meta = tagsMetaIndex[tk];
      chips.push({
        key: `t-${tk}`,
        label: meta ? l(meta, 'label', lang) : `#${tk}`,
        color: TONE.indigo,
        onRemove: () => setTagFilter(prev => prev.filter(v => v !== tk)),
      });
    }
    return chips;
  }, [
    rawQuery, elementFilter, classFilter, rarityFilter, chainFilter, roleFilter,
    giftFilter, teamBonusFilter, sourceFilter, showUniqueEffects,
    selectedBuffs, selectedDebuffs, tagFilter,
    buffsMap, debuffsMap, tagsMetaIndex, bonusLabelMap, lang, t,
  ]);

  const advancedCount =
    chainFilter.length + roleFilter.length + giftFilter.length
    + selectedBuffs.length + selectedDebuffs.length
    + sourceFilter.length + (showUniqueEffects ? 1 : 0)
    + teamBonusFilter.length + tagFilter.length;

  const drawerTagGroups = TAG_GROUPS as DrawerTagGroup[];

  // ── Render ──

  return (
    <div className="mx-auto max-w-350 space-y-3 px-2 md:px-4">
      {/* Filters bar — top strip on desktop, sticky bar on mobile */}
      <CharactersFiltersBar
        query={rawQuery}
        onQueryChange={setRawQuery}
        elementFilter={elementFilter}
        onToggleElement={v => toggleArray(setElementFilter, v, ELEMENTS)}
        classFilter={classFilter}
        onToggleClass={v => toggleArray(setClassFilter, v, CLASSES)}
        rarityFilter={rarityFilter}
        onToggleRarity={v => toggleArray(setRarityFilter, v, RARITIES)}
        advancedCount={advancedCount}
        onOpenAdvanced={() => setDrawerOpen(true)}
        advancedOpen={drawerOpen}
      />

      {/* Active filters chip strip */}
      <ActiveFiltersStrip
        items={activeChips}
        totalCount={indexedCharacters.length}
        matchCount={filtered.length}
        onResetAll={resetAll}
        onCopyShareUrl={copyShareUrl}
        copied={copied}
      />

      {/* Character grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-zinc-400">{t('characters.filters.no_match')}</p>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-700"
          >
            {t('characters.filters.reset')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
          {filtered.map((char: IndexedCharacter, index: number) => (
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
      )}

      {/* Advanced drawer / bottom sheet */}
      <CharactersFiltersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lang={lang}
        chainFilter={chainFilter}
        onToggleChain={v => toggleArray(setChainFilter, v, CHAIN_TYPES)}
        roleFilter={roleFilter}
        onToggleRole={v => toggleArray(setRoleFilter, v, ROLES)}
        giftFilter={giftFilter}
        onToggleGift={v => toggleArray(setGiftFilter, v, GIFTS)}
        buffGroups={buffGroups}
        debuffGroups={debuffGroups}
        buffsMap={buffsMap}
        debuffsMap={debuffsMap}
        selectedBuffs={selectedBuffs}
        onToggleBuff={key => toggleArray(setSelectedBuffs, key)}
        selectedDebuffs={selectedDebuffs}
        onToggleDebuff={key => toggleArray(setSelectedDebuffs, key)}
        effectLogic={effectLogic}
        onEffectLogicChange={setEffectLogic}
        effectsLoaded={buffsMetadata.length > 0}
        sourceFilter={sourceFilter}
        onToggleSource={v => toggleArray(setSourceFilter, v)}
        showUniqueEffects={showUniqueEffects}
        onToggleShowUnique={() => setShowUniqueEffects(v => !v)}
        teamBonusFilter={teamBonusFilter}
        onSetTeamBonus={setTeamBonusFilter}
        teamBonusOptions={TEAM_BONUSES_UI}
        tagGroups={drawerTagGroups}
        tagFilter={tagFilter}
        onToggleTag={v => toggleArray(setTagFilter, v)}
        tagLogic={tagLogic}
        onTagLogicChange={setTagLogic}
        tagsLoaded={tagsData !== null}
        onResetAll={resetAll}
        matchCount={filtered.length}
        totalCount={indexedCharacters.length}
      />
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo, useRef, useDeferredValue } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import LZString from 'lz-string';
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

// ── URL encoding maps ──

const ELEM_ID: Record<string, number> = { Fire: 1, Water: 2, Earth: 3, Light: 4, Dark: 5 };
const CLASS_ID: Record<string, number> = { Striker: 1, Defender: 2, Ranger: 3, Healer: 4, Mage: 5 };
const CHAIN_ID: Record<string, number> = { Start: 1, Join: 2, Finish: 3 };
const GIFT_ID: Record<string, number> = { Science: 1, Luxury: 2, 'Magic Tool': 3, Craftwork: 4, 'Natural Object': 5 };

const ELEM_INV = Object.fromEntries(Object.entries(ELEM_ID).map(([k, v]) => [v, k]));
const CLASS_INV = Object.fromEntries(Object.entries(CLASS_ID).map(([k, v]) => [v, k]));
const CHAIN_INV = Object.fromEntries(Object.entries(CHAIN_ID).map(([k, v]) => [v, k]));
const GIFT_INV = Object.fromEntries(Object.entries(GIFT_ID).map(([k, v]) => [v, k]));

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
  e?: number[]; c?: number[]; r?: number[]; ch?: number[]; g?: number[];
  b?: string[]; d?: string[];
  l?: 0 | 1; q?: string;
  r2?: string[]; t?: string[]; tl?: 0 | 1;
  src?: string[]; u?: 0 | 1;
};

// ── Helpers ──

const isArr = <T,>(v: T[] | undefined): v is T[] => Array.isArray(v) && v.length > 0;

function norm(s: unknown): string {
  return (typeof s === 'string' ? s : '').normalize('NFKC').toLowerCase().trim();
}

function getSearchableNames(char: CharacterListEntry, langs: Lang[]): string[] {
  return langs.map(lang => norm(l(char, 'Fullname', lang))).filter(Boolean);
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
  const compact: ZPayload = {
    e: isArr(p.el) ? p.el!.map(x => ELEM_ID[x]).filter(Boolean) : undefined,
    c: isArr(p.cl) ? p.cl!.map(x => CLASS_ID[x]).filter(Boolean) : undefined,
    r: isArr(p.r) ? p.r : undefined,
    ch: isArr(p.chain) ? p.chain!.map(x => CHAIN_ID[x]).filter(Boolean) : undefined,
    g: isArr(p.gift) ? p.gift!.map(x => GIFT_ID[x]).filter(Boolean) : undefined,
    b: isArr(p.buffs) ? p.buffs : undefined,
    d: isArr(p.debuffs) ? p.debuffs : undefined,
    r2: isArr(p.role) ? p.role : undefined,
    t: isArr(p.tags) ? p.tags : undefined,
    l: p.logic === 'AND' ? 1 : undefined,
    q: p.q || undefined,
    u: p.uniq ? 1 : undefined,
    tl: p.tagLogic === 'AND' ? 1 : undefined,
    src: isArr(p.sources) ? p.sources : undefined,
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(compact));
}

function decodeZToState(z?: string): Partial<Payload> | null {
  if (!z) return null;
  try {
    const raw = JSON.parse(LZString.decompressFromEncodedURIComponent(z) || '{}') as ZPayload;
    return {
      el: raw.e?.map(id => ELEM_INV[id]).filter(Boolean),
      cl: raw.c?.map(id => CLASS_INV[id]).filter(Boolean),
      r: raw.r,
      chain: raw.ch?.map(id => CHAIN_INV[id]).filter(Boolean),
      gift: raw.g?.map(id => GIFT_INV[id]).filter(Boolean),
      buffs: raw.b ?? [],
      debuffs: raw.d ?? [],
      role: raw.r2 ?? [],
      tags: raw.t ?? [],
      logic: raw.l === 1 ? 'AND' : 'OR',
      q: raw.q,
      uniq: raw.u === 1,
      tagLogic: raw.tl === 1 ? 'AND' : 'OR',
      sources: (raw.src ?? []) as SkillKey[],
    };
  } catch {
    return null;
  }
}

// ── Effect grouping ──

function groupEffectsByCategory(
  effectNames: string[], allEffects: Effect[], type: 'buff' | 'debuff', showUnique: boolean
): { title: string; effects: string[] }[] {
  const effectMap = new Map(allEffects.map(e => [e.name, e]));
  const groups = new Map<string, string[]>();
  const order: string[] = [];
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
    if (!groups.has(category)) {
      groups.set(category, []);
      order.push(category);
    }
    groups.get(category)!.push(canonical);
  }

  return order.map(category => ({
    title: `characters.effectsGroups.${type}.${category}`,
    effects: groups.get(category)!,
  }));
}

// ── FilterPill ──

function FilterPill({
  active, children, onClick, className, title,
}: {
  active: boolean; children: React.ReactNode; onClick: () => void; title?: string; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'inline-flex items-center justify-center rounded cursor-pointer select-none transition',
        active ? 'bg-cyan-500/25 text-white ring-1 ring-cyan-400' : 'bg-zinc-700/60 text-zinc-200 hover:bg-cyan-700',
        'text-xs leading-none',
        '**:leading-none [&_img]:align-middle [&_img]:block',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

function splitIntoRows<T>(arr: T[], rows = 2): T[][] {
  if (rows <= 1) return [arr];
  const perRow = Math.ceil(arr.length / rows);
  const out: T[][] = [];
  for (let i = 0; i < rows; i++) out.push(arr.slice(i * perRow, (i + 1) * perRow));
  return out;
}

// ── Reusable filter components ──

function IconFilterGroup<T extends string>({
  label, items, filter, onToggle, onReset, imagePath,
}: {
  label: string;
  items: { name: string; value: T | null }[];
  filter: T[];
  onToggle: (value: T) => void;
  onReset: () => void;
  imagePath: (value: T) => string;
}) {
  const { t } = useI18n();
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{label}</p>
      <div className="flex gap-2 justify-center">
        {items.map(item => (
          <FilterPill
            key={item.name}
            title={item.name}
            active={item.value === null ? filter.length === 0 : filter.includes(item.value)}
            onClick={() => item.value ? onToggle(item.value) : onReset()}
            className="w-9 h-9 px-0"
          >
            {item.value ? (
              <div className="relative h-7 w-7">
                <Image src={imagePath(item.value)} alt={item.value} fill sizes="28px" className="object-contain" />
              </div>
            ) : (
              <span className="text-[11px]">{t('common.all')}</span>
            )}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}

function TextFilterGroup<T extends string>({
  label, items, filter, onToggle, onReset,
}: {
  label: string;
  items: { name: string; value: T | null }[];
  filter: T[];
  onToggle: (value: T) => void;
  onReset: () => void;
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-center text-xs uppercase tracking-wide text-zinc-300 mb-1">{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {items.map(item => (
          <FilterPill
            key={item.name}
            active={item.value === null ? filter.length === 0 : filter.includes(item.value)}
            onClick={() => item.value ? onToggle(item.value) : onReset()}
            className="h-8 px-2.5"
          >
            {item.name}
          </FilterPill>
        ))}
      </div>
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
    <div className={className}>
      {groups.map((group, i) => (
        <div key={`${type}-${i}`} className="rounded-xl bg-zinc-800/40 ring-1 ring-zinc-700 p-2">
          <p className={`text-center ${color} font-semibold mb-2`}>
            {t(group.title as TranslationKey)}
          </p>
          <div className="grid grid-cols-5 md:grid-cols-6 gap-1.5 justify-items-center">
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
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    const z = searchParams.get('z');
    const decoded = decodeZToState(z || undefined);
    if (decoded) {
      applyPayload(decoded);
      if ((decoded.buffs?.length || 0) + (decoded.debuffs?.length || 0) > 0) setShowFilters(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      <div className="relative mx-auto max-w-md">
        <input
          type="text"
          value={rawQuery}
          onChange={e => setRawQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={() => setRawQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            &times;
          </button>
        )}
      </div>

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
            className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-cyan-600 transition"
          >
            {showFilters ? t('characters.filters.hideBuffs') : t('characters.filters.showBuffs')}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-col items-center gap-2 w-full mt-3 mb-2">
            {/* Header controls */}
            <div className="flex justify-center gap-3 items-center">
              <label htmlFor="show-unique" className="inline-flex items-center gap-2 h-9 px-3 rounded text-sm text-white cursor-pointer select-none bg-zinc-700 hover:bg-cyan-600 transition">
                <input type="checkbox" id="show-unique" checked={showUniqueEffects} onChange={() => setShowUniqueEffects(v => !v)} className="accent-cyan-500 w-4 h-4" />
                {t('characters.filters.unique')}
              </label>

              <div className="inline-grid grid-cols-2 rounded bg-zinc-700 text-xs">
                <button type="button" className={`px-2 py-1 rounded-l ${effectLogic === 'AND' ? 'bg-cyan-600' : ''}`} onClick={() => setEffectLogic('AND')}>{t('characters.filters.and')}</button>
                <button type="button" className={`px-2 py-1 rounded-r ${effectLogic === 'OR' ? 'bg-cyan-600' : ''}`} onClick={() => setEffectLogic('OR')}>{t('characters.filters.or')}</button>
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
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
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
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3"
              />
            </div>
          </div>
        )}

        {/* Tags toggle */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowTagsPanel(s => !s)}
            className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-cyan-600 transition"
          >
            {showTagsPanel ? t('characters.filters.hideTags') : t('characters.filters.showTags')}
          </button>
        </div>

        {showTagsPanel && (
          <div className="w-full mt-2">
            <div className="flex justify-center gap-3 items-center mb-2">
              <div className="inline-grid grid-cols-2 rounded bg-zinc-700 text-xs">
                <button type="button" className={`px-2 py-1 rounded-l ${tagLogic === 'AND' ? 'bg-cyan-600' : ''}`} onClick={() => setTagLogic('AND')}>{t('characters.filters.and')}</button>
                <button type="button" className={`px-2 py-1 rounded-r ${tagLogic === 'OR' ? 'bg-cyan-600' : ''}`} onClick={() => setTagLogic('OR')}>{t('characters.filters.or')}</button>
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
          <button type="button" onClick={resetAll} className="rounded bg-zinc-700 px-4 py-1 text-sm text-white hover:bg-red-700 transition">
            {t('characters.filters.reset')}
          </button>
          <button type="button" onClick={copyShareUrl} className="rounded bg-zinc-700 px-4 py-1 text-sm text-white hover:bg-cyan-600 transition">
            {copied ? t('characters.filters.copied') : t('characters.filters.copy')}
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
            href={`/${lang}/characters/${char.slug}`}
            priority={index <= 5}
          />
        ))}
      </div>
    </div>
  );
}

'use client';

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaPlus, FaTrash, FaChevronUp, FaChevronDown, FaXmark,
  FaImage, FaLink, FaArrowRotateLeft, FaCheck, FaGear, FaFileExport, FaFileImport, FaGripVertical,
} from 'react-icons/fa6';
import type { LangMap } from '@/types/common';
import type { ElementType, ClassType, RarityType } from '@/types/enums';
import { ELEMENTS, CLASSES, RARITIES } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { FilterSearch, FilterPill } from '@/app/components/ui/FilterPills';
import { ElementIcon, ClassIcon, StarsRow } from '@/app/components/character/PortraitOverlays';
import CharacterCard from '@/app/components/character/CharacterCard';

// ── Types ──

export type TierSourceItem = {
  key: string;
  name: LangMap;
  img: string;
  element?: string;
  cls?: string;
  rarity?: number;
  tags?: string[];
  isSkin?: boolean;
  /** For a costume: the base character's key, used to name it as the character. */
  baseKey?: string;
  /** Per-language short display name (abbreviation) for cramped labels. */
  short?: LangMap;
  /** Tall character card URL (`portrait/CT_*`) — set for items that have one
   *  (characters + skins). Used by the ranked grid when "Show cards" is on. */
  card?: string;
};

type Props = {
  characters: TierSourceItem[];
  ee: TierSourceItem[];
  bosses: TierSourceItem[];
};

type Tab = 'characters' | 'ee' | 'bosses';

type Tier = {
  id: string;
  label: string;
  color: string;
  items: string[];
};

// ── Constants ──

const TIER_PALETTE = [
  '#ff7f7f', '#ffbf7f', '#ffdf7f', '#ffff7f', '#bfff7f',
  '#7fffbf', '#7fdfff', '#7f9fff', '#bf7fff', '#ff7fdf',
  '#d4d4d8', '#9ca3af',
];

const DEFAULT_LABELS = ['S', 'A', 'B', 'C', 'D'];

// Default tier IDs must be deterministic — this runs during SSR and client
// hydration, so a random ID here would cause a hydration mismatch.
function makeDefaultTiers(): Tier[] {
  return DEFAULT_LABELS.map((label, i) => ({
    id: `t${i}`,
    label,
    color: TIER_PALETTE[i],
    items: [],
  }));
}

const DRAG_THRESHOLD = 6;
const TOUCH_HOLD_MS = 220;

const SETTINGS_KEY = 'tlm-settings';

type SortKey = 'default' | 'name' | 'rarity' | 'element';
const SORT_KEYS: SortKey[] = ['default', 'name', 'rarity', 'element'];

/** Character tags exposed as pool filters, in display order. */
const FILTER_TAGS = ['limited', 'collab', 'seasonal', 'free', 'premium'] as const;

const ELEMENT_ORDER = ['Fire', 'Water', 'Earth', 'Light', 'Dark'];

// ── URL encode / decode ──
//
// The placement is the bulk of the payload. Items are never stored as keys.
// Each item is a position in a per-type list sorted by numeric ID; that list
// is append-only (new game content always gets a higher ID), so positions
// stay stable across data updates.
//
// For the common single-type list, the placement is encoded as a *selection
// rank*: walking items in display order, each one stores its position among
// the still-available pool entries, using only `ceil(log2(remaining))` bits.
// Early picks cost ~7 bits, the last ones cost 0 — close to the information
// floor, and far cheaper than a fixed-width index per item.
//
// Format of the `z` query param:
//   "1" + b64url(title) + "," + (b64url(label) + "," + colorCode) per tier + "," + b64url(binary)
// Every segment is base64url or a short alphanumeric colour code — no "%" or
// "+" — so the value survives a round-trip through URLSearchParams unchanged.
// Commas separate the segments; the base64url alphabet contains none.

const TYPE_BITS = 2;          // 3 item types + 1 "mixed" marker
const MIXED_COUNT_BITS = 9;   // mixed-mode: items per tier
const MIXED_INDEX_BITS = 9;   // mixed-mode: per-type item index
const POOL_BITS = 12;         // single-type: stored canonical pool size

/** Bits needed to represent the values 0..n-1. */
function bitsFor(n: number): number {
  return n <= 1 ? 0 : 32 - Math.clz32(n - 1);
}

/** Per-type lists ordered by numeric ID (stable) + reverse lookup. */
export type Canon = {
  byType: TierSourceItem[][]; // [characters, ee, bosses]
  index: Map<string, { type: number; idx: number }>;
};

export function buildCanon(characters: TierSourceItem[], ee: TierSourceItem[], bosses: TierSourceItem[]): Canon {
  const numId = (k: string) => Number(k.slice(1)) || 0;
  const byType = [characters, ee, bosses].map((arr) =>
    [...arr].sort((a, b) => numId(a.key) - numId(b.key)),
  );
  const index = new Map<string, { type: number; idx: number }>();
  byType.forEach((list, type) => list.forEach((it, idx) => index.set(it.key, { type, idx })));
  return { byType, index };
}

class BitWriter {
  private bits: number[] = [];
  write(value: number, n: number) {
    for (let i = n - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  toBase64url(): string {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => { if (bit) bytes[i >> 3] |= 1 << (7 - (i & 7)); });
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

class BitReader {
  private pos = 0;
  private bytes: Uint8Array;
  constructor(b64url: string) {
    const pad = b64url.length % 4 ? 4 - (b64url.length % 4) : 0;
    const bin = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad));
    this.bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) this.bytes[i] = bin.charCodeAt(i);
  }
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const bit = ((this.bytes[this.pos >> 3] ?? 0) >> (7 - (this.pos & 7))) & 1;
      v = (v << 1) | bit;
      this.pos++;
    }
    return v;
  }
}

/** UTF-8 text ⇄ base64url — keeps the `z` value free of "%"/"+" so it
 *  survives a round-trip through URLSearchParams unchanged. */
function textToB64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToText(s: string): string {
  try {
    const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/** Colour → compact code: "p<idx>" for a palette colour, "c<hex>" for a custom one. */
function colorToCode(color: string): string {
  const pi = TIER_PALETTE.indexOf(color);
  return pi >= 0 ? `p${pi}` : `c${color.replace('#', '')}`;
}

function codeToColor(code: string, fallback: string): string {
  if (code[0] === 'p') return TIER_PALETTE[Number(code.slice(1))] ?? fallback;
  if (code[0] === 'c' && /^[0-9a-f]{6}$/i.test(code.slice(1))) return `#${code.slice(1)}`;
  return fallback;
}

function encodeState(title: string, tiers: Tier[], canon: Canon): string {
  const parts: string[] = [textToB64url(title)];
  for (const t of tiers) parts.push(textToB64url(t.label), colorToCode(t.color));

  const refs = tiers.flatMap((t) =>
    t.items.map((key) => canon.index.get(key)).filter((r): r is { type: number; idx: number } => !!r),
  );
  const firstType = refs[0]?.type ?? 0;
  const mode = refs.length && refs.every((r) => r.type === firstType) ? firstType : (refs.length ? 3 : 0);

  const w = new BitWriter();
  w.write(mode, TYPE_BITS);

  if (mode === 3) {
    // Mixed types: a plain (type, index) pair per item.
    for (const t of tiers) w.write(t.items.length, MIXED_COUNT_BITS);
    for (const r of refs) { w.write(r.type, TYPE_BITS); w.write(r.idx, MIXED_INDEX_BITS); }
  } else {
    // Single type: selection-rank encoding against the canonical pool.
    const pool = canon.byType[mode].length;
    w.write(pool, POOL_BITS);
    const countBits = bitsFor(pool + 1);
    for (const t of tiers) w.write(t.items.length, countBits);
    const available = Array.from({ length: pool }, (_, i) => i);
    for (const r of refs) {
      const pos = available.indexOf(r.idx);
      w.write(pos, bitsFor(available.length));
      available.splice(pos, 1);
    }
  }
  parts.push(w.toBase64url());
  return `1${parts.join(',')}`;
}

function decodeState(raw: string | null, canon: Canon): { title: string; tiers: Tier[] } | null {
  if (!raw || raw[0] !== '1') return null;
  // parts = [title, (label, color) × T, binary]  →  length is even and ≥ 4
  const parts = raw.slice(1).split(',');
  if (parts.length < 4 || parts.length % 2 !== 0) return null;
  const tierCount = (parts.length - 2) / 2;

  try {
    const r = new BitReader(parts[parts.length - 1]);
    const mode = r.read(TYPE_BITS);
    const perTier: { type: number; idx: number }[][] = [];

    if (mode === 3) {
      const counts: number[] = [];
      for (let i = 0; i < tierCount; i++) counts.push(r.read(MIXED_COUNT_BITS));
      for (const c of counts) {
        const row: { type: number; idx: number }[] = [];
        for (let j = 0; j < c; j++) row.push({ type: r.read(TYPE_BITS), idx: r.read(MIXED_INDEX_BITS) });
        perTier.push(row);
      }
    } else {
      const pool = r.read(POOL_BITS);
      const countBits = bitsFor(pool + 1);
      const counts: number[] = [];
      for (let i = 0; i < tierCount; i++) counts.push(r.read(countBits));
      const available = Array.from({ length: pool }, (_, i) => i);
      for (const c of counts) {
        const row: { type: number; idx: number }[] = [];
        for (let j = 0; j < c; j++) {
          const pos = r.read(bitsFor(available.length));
          const idx = available[pos];
          if (idx === undefined) continue;
          available.splice(pos, 1);
          row.push({ type: mode, idx });
        }
        perTier.push(row);
      }
    }

    const tiers: Tier[] = perTier.map((row, i) => ({
      id: `t${i}-${Math.random().toString(36).slice(2, 7)}`,
      label: b64urlToText(parts[1 + i * 2]),
      color: codeToColor(parts[2 + i * 2] ?? '', TIER_PALETTE[i % TIER_PALETTE.length]),
      items: row.map((rf) => canon.byType[rf.type]?.[rf.idx]?.key).filter((k): k is string => !!k),
    }));
    return { title: b64urlToText(parts[0]), tiers };
  } catch {
    return null;
  }
}

// ── Tier mutation helpers ──

/** Remove a key from every tier, then insert it into `tierId` (before `beforeKey`, or at end). */
function placeKey(tiers: Tier[], key: string, tierId: string, beforeKey: string | null): Tier[] {
  const cleaned = tiers.map((t) => ({ ...t, items: t.items.filter((k) => k !== key) }));
  const idx = cleaned.findIndex((t) => t.id === tierId);
  if (idx < 0) return cleaned;
  const items = [...cleaned[idx].items];
  let pos = items.length;
  if (beforeKey) {
    const bi = items.indexOf(beforeKey);
    if (bi >= 0) pos = bi;
  }
  items.splice(pos, 0, key);
  cleaned[idx] = { ...cleaned[idx], items };
  return cleaned;
}

function removeKey(tiers: Tier[], key: string): Tier[] {
  return tiers.map((t) => ({ ...t, items: t.items.filter((k) => k !== key) }));
}

/** Move `key` into `tierId` at a visual insertion index computed against the
 *  tier's full rendered list (which still includes the dragged item). */
function moveKeyToVisualIndex(tiers: Tier[], key: string, tierId: string, vIndex: number): Tier[] {
  const ti = tiers.findIndex((t) => t.id === tierId);
  const oldPos = ti >= 0 ? tiers[ti].items.indexOf(key) : -1;
  // Removing the key first shifts later positions in the same tier left by one.
  const target = oldPos >= 0 && oldPos < vIndex ? vIndex - 1 : vIndex;
  const cleaned = removeKey(tiers, key);
  const ci = cleaned.findIndex((t) => t.id === tierId);
  if (ci < 0) return cleaned;
  const items = [...cleaned[ci].items];
  items.splice(Math.max(0, Math.min(target, items.length)), 0, key);
  cleaned[ci] = { ...cleaned[ci], items };
  return cleaned;
}

/** Insertion index among the tier rows for a given pointer Y (0..count). */
function rowIndexAtY(y: number): number {
  const rows = Array.from(document.querySelectorAll('[data-tier-id]'));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return rows.length;
}

/** Move the row with `id` to the insertion index `vIndex`; returns the same
 *  array reference when nothing changes (so a live drag doesn't re-render). */
function moveRowToIndex(tiers: Tier[], id: string, vIndex: number): Tier[] {
  const from = tiers.findIndex((t) => t.id === id);
  if (from < 0) return tiers;
  const target = Math.max(0, Math.min(from < vIndex ? vIndex - 1 : vIndex, tiers.length - 1));
  if (target === from) return tiers;
  const next = [...tiers];
  const [row] = next.splice(from, 1);
  next.splice(target, 0, row);
  return next;
}

type DropTarget = { type: 'pool' } | { type: 'tier'; tierId: string; index: number };

/** Resolve what's under the pointer into a drop target. Used for BOTH the live
 *  insertion indicator and the actual drop, so they can never disagree. The
 *  index is the gap position among the tier's items, before the first item the
 *  pointer sits ahead of (earlier row, or left of its centre on the same row). */
function computeDrop(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const zone = el?.closest('[data-drop]');
  if (!zone) return null;
  if (zone.getAttribute('data-drop') === 'pool') return { type: 'pool' };
  const tierId = zone.getAttribute('data-tier-id');
  if (!tierId) return null;
  const box = zone.querySelector('[data-items]');
  const els = box ? Array.from(box.querySelectorAll<HTMLElement>('[data-item-key]')) : [];
  let index = els.length;
  for (let i = 0; i < els.length; i++) {
    const r = els[i].getBoundingClientRect();
    if (y < r.top) { index = i; break; }
    if (y <= r.bottom && x < r.left + r.width / 2) { index = i; break; }
  }
  return { type: 'tier', tierId, index };
}

/** Greedy word-wrap for canvas text; breaks any single over-long word by character. */
function wrapLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  const addChars = (chunk: string) => {
    for (const ch of chunk) {
      if (line && ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; }
      else line += ch;
    }
  };
  text.trim().split(/\s+/).filter(Boolean).forEach((word, i) => {
    if (i > 0) {
      if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) { lines.push(line); line = ''; }
      else if (line) line += ' ';
    }
    addChars(word);
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// ── Item thumbnail ──

type IconSize = 's' | 'm' | 'l';

const ITEM_SIZES: Record<IconSize, { box: string; col: string }> = {
  s: { box: 'h-9 w-9 sm:h-11 sm:w-11', col: 'w-9 sm:w-11' },
  m: { box: 'h-12 w-12 sm:h-14 sm:w-14', col: 'w-12 sm:w-14' },
  l: { box: 'h-16 w-16 sm:h-20 sm:w-20', col: 'w-16 sm:w-20' },
};

/** Card widths for the ranked grid — match CharacterCard's sm/md/lg sizes
 *  (66×128, 100×192, 120×231). Height is derived via the card's portrait
 *  aspect so the drop-preview lines up with a real CharacterCard. */
const CARD_SIZES: Record<IconSize, { w: string; size: 'sm' | 'md' | 'lg' }> = {
  s: { w: 'w-[66px]', size: 'sm' },
  m: { w: 'w-25', size: 'md' },
  l: { w: 'w-30', size: 'lg' },
};
const CARD_ASPECT = 'aspect-[120/231]';

type ItemViewProps = {
  item: TierSourceItem;
  selected: boolean;
  dimmed: boolean;
  label: string;
  shortLabel?: string;
  size: IconSize;
  showName: boolean;
  showElement: boolean;
  showClass: boolean;
  showRarity: boolean;
  onPointerDown: (e: React.PointerEvent, key: string) => void;
};

const ItemView = memo(function ItemView({
  item, selected, dimmed, label, shortLabel, size, showName, showElement, showClass, showRarity, onPointerDown,
}: ItemViewProps) {
  const s = ITEM_SIZES[size];
  return (
    <div
      data-item-key={item.key}
      onPointerDown={(e) => onPointerDown(e, item.key)}
      title={label}
      className={`relative flex shrink-0 cursor-grab touch-none select-none flex-col items-center ${showName ? s.col : ''} ${dimmed ? 'opacity-30' : ''}`}
    >
      <div
        className={[
          s.box,
          'relative rounded-md ring-offset-1 ring-offset-zinc-900 transition',
          selected ? 'ring-2 ring-amber-400' : 'ring-1 ring-zinc-700 hover:ring-zinc-400',
        ].join(' ')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.img}
          alt={label}
          draggable={false}
          loading="lazy"
          className="h-full w-full rounded-md bg-zinc-800 object-cover"
          onError={(e) => { (e.currentTarget.style.visibility = 'hidden'); }}
        />
        {showElement && item.element && <ElementIcon element={item.element} intrinsicPx={18} />}
        {showClass && item.cls && <ClassIcon classType={item.cls} intrinsicPx={14} />}
        {showRarity && item.rarity ? <StarsRow count={item.rarity} intrinsicPx={12} /> : null}
      </div>
      {showName && (
        <span lang="en" className="mt-0.5 w-full text-center text-[10px] leading-tight hyphens-auto text-zinc-300">{shortLabel || label}</span>
      )}
    </div>
  );
});

// ── Full-art card (used in the ranked grid when "Show cards" is on) ──

type CardViewProps = {
  item: TierSourceItem;
  selected: boolean;
  dimmed: boolean;
  /** Base character name — rendered ON the card. */
  label: string;
  /** Skin display name — rendered UNDER the card when set. */
  skinLabel?: string;
  size: IconSize;
  showName: boolean;
  showElement: boolean;
  showClass: boolean;
  showStars: boolean;
  showBadge: boolean;
  onPointerDown: (e: React.PointerEvent, key: string) => void;
};

const CardView = memo(function CardView({
  item, selected, dimmed, label, skinLabel, size, showName, showElement, showClass, showStars, showBadge, onPointerDown,
}: CardViewProps) {
  // Strip the "c"/"e"/"b" type prefix to get the raw character/skin id.
  const id = item.key.slice(1);
  return (
    <div
      data-item-key={item.key}
      onPointerDown={(e) => onPointerDown(e, item.key)}
      title={skinLabel ?? label}
      className={[
        CARD_SIZES[size].w,
        'relative flex shrink-0 cursor-grab touch-none select-none flex-col items-center',
        dimmed ? 'opacity-30' : '',
      ].join(' ')}
    >
      <div className={['rounded ring-offset-1 ring-offset-zinc-900 transition', selected ? 'ring-2 ring-amber-400' : ''].join(' ')}>
        <CharacterCard
          id={id}
          name={label}
          element={item.element as ElementType | undefined}
          classType={item.cls as ClassType | undefined}
          rarity={item.rarity as RarityType | undefined}
          tags={item.tags}
          size={CARD_SIZES[size].size}
          showName={showName}
          showElement={showElement}
          showClass={showClass}
          showStars={showStars}
          showBadge={showBadge}
        />
      </div>
      {skinLabel && (
        <span className="mt-0.5 line-clamp-2 w-full text-center text-[10px] leading-tight text-zinc-400">{skinLabel}</span>
      )}
    </div>
  );
});

// ── Tier label (auto-growing, word-wrapping) ──

function TierLabel({
  value, onChange, onClick,
}: {
  value: string;
  onChange: (value: string) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Resize to fit the content on mount and on every value change (incl. when a
  // shared list is hydrated) — works in every browser.
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      maxLength={60}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
      placeholder="…"
      className="w-full resize-none overflow-hidden wrap-break-word bg-transparent text-center text-base font-bold leading-tight text-zinc-900 placeholder-zinc-700/50 focus:outline-none"
    />
  );
}

/** Faded preview of the dragged item, shown at the insertion point during a drag. */
function DropPreview({ src, size, card }: { src: string | undefined; size: IconSize; card?: boolean }) {
  const sizeCls = card ? `${CARD_SIZES[size].w} ${CARD_ASPECT}` : ITEM_SIZES[size].box;
  return (
    <div className={`${sizeCls} shrink-0 overflow-hidden rounded-md border-2 border-dashed border-amber-400/80 bg-amber-400/10`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className="h-full w-full rounded-md object-cover opacity-40" />
      )}
    </div>
  );
}

// ── Main component ──

export default function TierListMakerClient({ characters, ee, bosses }: Props) {
  const { lang, t } = useI18n();

  // Master lookup of every available item.
  const itemMap = useMemo(() => {
    const m = new Map<string, TierSourceItem>();
    for (const it of characters) m.set(it.key, it);
    for (const it of ee) m.set(it.key, it);
    for (const it of bosses) m.set(it.key, it);
    return m;
  }, [characters, ee, bosses]);

  const sourceByTab = useMemo<Record<Tab, TierSourceItem[]>>(
    () => ({ characters, ee, bosses }),
    [characters, ee, bosses],
  );

  // Stable per-type index used to compact the share URL.
  const canon = useMemo(() => buildCanon(characters, ee, bosses), [characters, ee, bosses]);

  // Board state
  const [title, setTitle] = useState('');
  const [tiers, setTiers] = useState<Tier[]>(makeDefaultTiers);

  // Pool state
  const [tab, setTab] = useState<Tab>('characters');
  const [rawQuery, setRawQuery] = useState('');
  const query = useDeferredValue(rawQuery);
  const [elementFilter, setElementFilter] = useState<ElementType[]>([]);
  const [classFilter, setClassFilter] = useState<ClassType[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityType[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [skinsOnly, setSkinsOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('default');

  // Display settings (persisted in localStorage)
  const [iconSize, setIconSize] = useState<IconSize>('m');
  const [showNames, setShowNames] = useState(false);
  const [showElement, setShowElement] = useState(false);
  const [showClass, setShowClass] = useState(false);
  const [showRarity, setShowRarity] = useState(false);
  const [showSkins, setShowSkins] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [cardSize, setCardSize] = useState<IconSize>('m');
  const [showCardTags, setShowCardTags] = useState(false);
  const [showSkinNames, setShowSkinNames] = useState(true); // skin name vs base character name
  const [showSettings, setShowSettings] = useState(false);

  // Interaction state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; x: number; y: number } | null>(null);
  const [dropAt, setDropAt] = useState<{ tierId: string; index: number } | null>(null);
  const [colorRow, setColorRow] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load + persist display settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.iconSize === 's' || s.iconSize === 'm' || s.iconSize === 'l') setIconSize(s.iconSize);
        if (typeof s.showNames === 'boolean') setShowNames(s.showNames);
        if (typeof s.showElement === 'boolean') setShowElement(s.showElement);
        if (typeof s.showClass === 'boolean') setShowClass(s.showClass);
        if (typeof s.showRarity === 'boolean') setShowRarity(s.showRarity);
        if (typeof s.showSkins === 'boolean') setShowSkins(s.showSkins);
        if (typeof s.showSkinNames === 'boolean') setShowSkinNames(s.showSkinNames);
        if (typeof s.showCards === 'boolean') setShowCards(s.showCards);
        if (s.cardSize === 's' || s.cardSize === 'm' || s.cardSize === 'l') setCardSize(s.cardSize);
        if (typeof s.showCardTags === 'boolean') setShowCardTags(s.showCardTags);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ iconSize, showNames, showElement, showClass, showRarity, showSkins, showSkinNames, showCards, cardSize, showCardTags }));
    } catch { /* ignore */ }
  }, [iconSize, showNames, showElement, showClass, showRarity, showSkins, showSkinNames, showCards, cardSize, showCardTags]);

  const localName = useCallback(
    (key: string) => {
      const it = itemMap.get(key);
      return it ? lRec(it.name, lang) : key;
    },
    [itemMap, lang],
  );

  // Short display name for the current language (abbreviation), if one exists.
  // Missing language ⇒ undefined ⇒ caller falls back to the full localized name.
  const localShort = useCallback(
    (key: string) => itemMap.get(key)?.short?.[lang],
    [itemMap, lang],
  );

  // Which key to name an item by: a costume falls back to its base character's
  // name when "skin names" is off.
  const nameKeyFor = useCallback(
    (key: string) => {
      const it = itemMap.get(key);
      return it?.isSkin && !showSkinNames && it.baseKey ? it.baseKey : key;
    },
    [itemMap, showSkinNames],
  );

  // ── URL hydrate / sync ──
  const didHydrate = useRef(false);
  const lastUrlRef = useRef('');
  // Payload of a list opened via a short "?s=" link — kept until the first
  // edit so the address bar stays on the compact short URL.
  const shareBaselineRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;

    const apply = (z: string | null, fromShortLink = false) => {
      const decoded = decodeState(z, canon);
      if (decoded && decoded.tiers.length) {
        setTitle(decoded.title);
        setTiers(decoded.tiers);
        if (fromShortLink && z) shareBaselineRef.current = z;
      }
    };

    const params = new URLSearchParams(window.location.search);
    const shortId = params.get('s');
    if (shortId) {
      fetch(`/api/tierlist/${encodeURIComponent(shortId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (typeof data?.z === 'string') apply(data.z, true); })
        .catch(() => {})
        .finally(() => setHydrated(true));
    } else {
      apply(params.get('z'));
      setHydrated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      const z = encodeState(title, tiers, canon);
      // Unmodified list still showing its short link → leave the URL alone.
      if (shareBaselineRef.current === z) return;
      const path = window.location.pathname;
      const isPristine = !title && tiers.every((t) => t.items.length === 0);
      const next = isPristine ? path : `${path}?z=${z}`;
      if (lastUrlRef.current !== next) {
        lastUrlRef.current = next;
        // history.replaceState updates the address bar only — no RSC fetch,
        // no re-render, no flicker (unlike router.replace).
        window.history.replaceState(window.history.state, '', next);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [hydrated, title, tiers, canon]);

  // ── Derived: placed keys + pool ──
  const placed = useMemo(() => new Set(tiers.flatMap((t) => t.items)), [tiers]);

  const poolItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sourceByTab[tab].filter((it) => {
      if (placed.has(it.key)) return false;
      // "Skins only" overrides the default skin-hiding so the filter works
      // even when the Settings toggle is off.
      if (skinsOnly) { if (!it.isSkin) return false; }
      else if (it.isSkin && !showSkins) return false;
      if (elementFilter.length && (!it.element || !elementFilter.includes(it.element as ElementType))) return false;
      if (classFilter.length && (!it.cls || !classFilter.includes(it.cls as ClassType))) return false;
      if (rarityFilter.length && (it.rarity === undefined || !rarityFilter.includes(it.rarity as RarityType))) return false;
      if (tagFilter.length && !it.tags?.some((tg) => tagFilter.includes(tg))) return false;
      if (q) {
        const name = Object.values(it.name).join(' ').toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'default') return filtered;
    const arr = [...filtered];
    if (sort === 'name') {
      arr.sort((a, b) => lRec(a.name, lang).localeCompare(lRec(b.name, lang)));
    } else if (sort === 'rarity') {
      arr.sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) || lRec(a.name, lang).localeCompare(lRec(b.name, lang)));
    } else if (sort === 'element') {
      arr.sort((a, b) => ELEMENT_ORDER.indexOf(a.element ?? '') - ELEMENT_ORDER.indexOf(b.element ?? '') || lRec(a.name, lang).localeCompare(lRec(b.name, lang)));
    }
    return arr;
  }, [sourceByTab, tab, placed, query, elementFilter, classFilter, rarityFilter, tagFilter, showSkins, skinsOnly, sort, lang]);

  // ── Drag & drop (pointer events, mouse + touch) ──
  const startRef = useRef<{ x: number; y: number; key: string } | null>(null);
  const armedRef = useRef(false);
  const draggingRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Row reordering by drag handle
  const rowDragId = useRef<string | null>(null);
  const rowDraggingRef = useRef(false);
  const [rowDragActive, setRowDragActive] = useState<string | null>(null);

  // Prevent page scroll while a drag (item or row) is active (touch).
  useEffect(() => {
    const block = (e: TouchEvent) => { if (draggingRef.current || rowDraggingRef.current) e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  const onRowHandlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    rowDragId.current = id;
    rowDraggingRef.current = true;
    setRowDragActive(id);
    const onMove = (ev: PointerEvent) => {
      if (rowDragId.current) setTiers((prev) => moveRowToIndex(prev, rowDragId.current!, rowIndexAtY(ev.clientY)));
    };
    const onEnd = () => {
      rowDragId.current = null;
      rowDraggingRef.current = false;
      setRowDragActive(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }, []);

  const updateDragOver = useCallback((x: number, y: number) => {
    const d = computeDrop(x, y);
    setDropAt(d && d.type === 'tier' ? { tierId: d.tierId, index: d.index } : null);
  }, []);

  const handleDrop = useCallback((key: string, x: number, y: number) => {
    const d = computeDrop(x, y);
    if (!d) return;
    if (d.type === 'pool') setTiers((prev) => removeKey(prev, key));
    else setTiers((prev) => moveKeyToVisualIndex(prev, key, d.tierId, d.index));
  }, []);

  const handleTap = useCallback((key: string) => {
    setSelectedKey((cur) => (cur === key ? null : key));
  }, []);

  const endPointer = useRef<((e: PointerEvent) => void) | null>(null);
  const movePointer = useRef<((e: PointerEvent) => void) | null>(null);

  const cleanupPointer = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (movePointer.current) window.removeEventListener('pointermove', movePointer.current);
    if (endPointer.current) {
      window.removeEventListener('pointerup', endPointer.current);
      window.removeEventListener('pointercancel', endPointer.current);
    }
    startRef.current = null;
    armedRef.current = false;
    draggingRef.current = false;
  }, []);

  const onItemPointerDown = useCallback((e: React.PointerEvent, key: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, key };
    draggingRef.current = false;
    armedRef.current = e.pointerType === 'mouse';

    const onMove = (ev: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dist = Math.hypot(ev.clientX - s.x, ev.clientY - s.y);
      if (!armedRef.current) {
        // Touch/pen before the hold completes: movement means the user is scrolling.
        if (dist > 10) cleanupPointer();
        return;
      }
      if (!draggingRef.current) {
        if (dist < DRAG_THRESHOLD) return;
        draggingRef.current = true;
      }
      setDrag({ key: s.key, x: ev.clientX, y: ev.clientY });
      updateDragOver(ev.clientX, ev.clientY);
    };

    const onEnd = (ev: PointerEvent) => {
      const s = startRef.current;
      const wasDragging = draggingRef.current;
      cleanupPointer();
      setDrag(null);
      setDropAt(null);
      if (!s) return;
      if (wasDragging) handleDrop(s.key, ev.clientX, ev.clientY);
      else handleTap(s.key);
    };

    movePointer.current = onMove;
    endPointer.current = onEnd;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);

    if (e.pointerType !== 'mouse') {
      holdTimer.current = setTimeout(() => {
        armedRef.current = true;
        draggingRef.current = true;
        const s = startRef.current;
        if (s) { setDrag({ key: s.key, x: s.x, y: s.y }); updateDragOver(s.x, s.y); }
      }, TOUCH_HOLD_MS);
    }
  }, [cleanupPointer, handleDrop, handleTap, updateDragOver]);

  useEffect(() => cleanupPointer, [cleanupPointer]);

  // ── Tap-to-place: tapping a tier / pool while an item is selected ──
  const tapZone = useCallback((e: React.MouseEvent, action: 'pool' | string) => {
    if ((e.target as HTMLElement).closest('[data-item-key]')) return; // handled by the item itself
    if (!selectedKey) return;
    if (action === 'pool') setTiers((prev) => removeKey(prev, selectedKey));
    else setTiers((prev) => placeKey(prev, selectedKey, action, null));
    setSelectedKey(null);
  }, [selectedKey]);

  // ── Tier row operations ──
  const updateTier = (id: string, patch: Partial<Tier>) =>
    setTiers((prev) => prev.map((tr) => (tr.id === id ? { ...tr, ...patch } : tr)));

  const addRow = (afterIdx: number) =>
    setTiers((prev) => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, {
        id: `t-${Math.random().toString(36).slice(2, 8)}`,
        label: '',
        color: TIER_PALETTE[next.length % TIER_PALETTE.length],
        items: [],
      });
      return next;
    });

  const deleteRow = (id: string) => {
    if (tiers.length <= 1) return;
    const row = tiers.find((tr) => tr.id === id);
    if (row && row.items.length > 0 && !window.confirm(t('tools.tier-list-maker.confirm_delete_row'))) return;
    setTiers((prev) => prev.filter((tr) => tr.id !== id));
  };

  const moveRow = (idx: number, dir: -1 | 1) =>
    setTiers((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const clearRow = (id: string) => {
    if (!window.confirm(t('tools.tier-list-maker.confirm_clear_row'))) return;
    updateTier(id, { items: [] });
  };

  const resetAll = () => {
    if (!window.confirm(t('tools.tier-list-maker.confirm_reset'))) return;
    setTitle('');
    setTiers(makeDefaultTiers());
    setSelectedKey(null);
    shareBaselineRef.current = null;
  };

  // ── JSON export / import ──
  const importInputRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const data = { title, tiers: tiers.map((tr) => ({ label: tr.label, color: tr.color, items: tr.items })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title.trim() || 'tier-list').replace(/[^\w-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data?.tiers)) throw new Error('bad');
        const next: Tier[] = data.tiers.map((tr: { label?: unknown; color?: unknown; items?: unknown }, i: number) => ({
          id: `t${i}-${Math.random().toString(36).slice(2, 7)}`,
          label: typeof tr.label === 'string' ? tr.label : '',
          color: typeof tr.color === 'string' ? tr.color : TIER_PALETTE[i % TIER_PALETTE.length],
          items: Array.isArray(tr.items) ? tr.items.filter((k: unknown): k is string => typeof k === 'string' && itemMap.has(k)) : [],
        }));
        if (!next.length) throw new Error('empty');
        setTitle(typeof data.title === 'string' ? data.title : '');
        setTiers(next);
        setSelectedKey(null);
        shareBaselineRef.current = null;
      } catch {
        window.alert(t('tools.tier-list-maker.import_error'));
      }
    };
    reader.readAsText(file);
  };

  // ── Share ──
  // Tries to store the list server-side and copy a compact "?s=<id>" link.
  // If storage is unavailable (dev, DB down) it falls back to the long,
  // self-contained "?z=" link so sharing always works.
  const copyLink = async () => {
    const z = encodeState(title, tiers, canon);
    const base = `${window.location.origin}${window.location.pathname}`;
    let url = `${base}?z=${z}`;
    try {
      const res = await fetch('/api/tierlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ z }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.id === 'string') url = `${base}?s=${data.id}`;
      }
    } catch {
      // network error → keep the self-contained long link
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('', url);
    }
  };

  // ── PNG export (mirrors the on-screen display settings) ──
  const exportPng = useCallback(async () => {
    // Cell geometry: square portrait when cards are off, tall card otherwise.
    const ICON = { s: 56, m: 76, l: 100 }[iconSize];
    const CARD_W = { s: 66, m: 100, l: 120 }[cardSize];
    const CARD_H = Math.round(CARD_W * 231 / 120);
    const cellW = showCards ? CARD_W : ICON;
    const cellH = showCards ? CARD_H : ICON;
    const PER_ROW = 12, PAD = 20, LABEL_W = 110;
    const LABEL_PAD = 8, LINE_H = 24, LABEL_FONT = '700 20px system-ui, sans-serif';
    const NAME_PX = Math.max(10, Math.round(cellW * 0.16));
    const NAME_LH = NAME_PX + 2;
    const NAME_FONT = `500 ${NAME_PX}px system-ui, sans-serif`;

    /** Recruit-badge file for a tag set (priority matches CharacterCard). */
    const recruitBadge = (tags?: string[]): string | null => {
      if (!tags) return null;
      const pairs: [string, string][] = [
        ['collab', '/images/ui/recruit/CM_Recruit_Tag_Collab.webp'],
        ['seasonal', '/images/ui/recruit/CM_Recruit_Tag_Seasonal.webp'],
        ['premium', '/images/ui/recruit/CM_Recruit_Tag_Premium.webp'],
        ['free', '/images/ui/recruit/CM_Recruit_Tag_Free.webp'],
        ['limited', '/images/ui/recruit/CM_Recruit_Tag_Fes.webp'],
      ];
      for (const [tag, src] of pairs) if (tags.includes(tag)) return src;
      return null;
    };

    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const im = new Image();
        im.crossOrigin = 'anonymous'; // keep the canvas origin-clean so toBlob works
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = src;
      });

    // Collect every image URL: item thumbnails + the overlays the toggles need.
    const urls = new Set<string>();
    for (const tr of tiers) for (const k of tr.items) {
      const it = itemMap.get(k);
      if (!it) continue;
      urls.add(showCards && it.card ? it.card : it.img);
      if (showElement && it.element) urls.add(`/images/ui/elem/CM_Element_${it.element}.webp`);
      if (showClass && it.cls) urls.add(`/images/ui/class/CM_Class_${it.cls}.webp`);
      if (showCards && showCardTags) {
        const b = recruitBadge(it.tags);
        if (b) urls.add(b);
      }
    }
    if (showRarity) urls.add('/images/ui/star/CM_icon_star_y.webp');
    const img = new Map<string, HTMLImageElement>();
    await Promise.all([...urls].map(async (u) => { const im = await load(u); if (im) img.set(u, im); }));

    const canvas = document.createElement('canvas');
    // willReadFrequently forces a CPU-backed canvas, which both speeds up the
    // readback and dodges broken GPU-canvas drivers that render nothing.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Pre-wrap names so each tier's row height fits the longest name(s).
    // Card mode renders TWO names below the cell: base character (when
    // showNames) and the skin's own name (always, when it's a costume).
    ctx.font = NAME_FONT;
    const baseNameLines = new Map<string, string[]>();
    const skinNameLines = new Map<string, string[]>();
    for (const tr of tiers) for (const k of tr.items) {
      const it = itemMap.get(k);
      if (!it) continue;
      if (showCards) {
        if (showNames) {
          const baseIt = it.isSkin && it.baseKey ? itemMap.get(it.baseKey) ?? it : it;
          baseNameLines.set(k, wrapLabel(ctx, baseIt.short?.[lang] ?? lRec(baseIt.name, lang), cellW - 2));
        }
        if (it.isSkin) {
          skinNameLines.set(k, wrapLabel(ctx, it.short?.[lang] ?? lRec(it.name, lang), cellW - 2));
        }
      } else if (showNames) {
        const named = it.isSkin && !showSkinNames && it.baseKey ? itemMap.get(it.baseKey) ?? it : it;
        baseNameLines.set(k, wrapLabel(ctx, named.short?.[lang] ?? lRec(named.name, lang), cellW - 2));
      }
    }
    const cellTotalH = tiers.map((tr) => {
      let extra = 0;
      if (showCards) {
        const maxBase = Math.max(0, ...tr.items.map((k) => baseNameLines.get(k)?.length ?? 0));
        const maxSkin = Math.max(0, ...tr.items.map((k) => skinNameLines.get(k)?.length ?? 0));
        if (maxBase || maxSkin) extra = (maxBase + maxSkin) * NAME_LH + 4;
      } else if (showNames) {
        const maxLines = Math.max(1, ...tr.items.map((k) => baseNameLines.get(k)?.length ?? 1));
        extra = maxLines * NAME_LH + 4;
      }
      return cellH + extra;
    });

    ctx.font = LABEL_FONT;
    const labelLines = tiers.map((tr) => wrapLabel(ctx, tr.label, LABEL_W - LABEL_PAD * 2));
    const rowHeights = tiers.map((tr, i) => {
      const itemsH = Math.max(1, Math.ceil(tr.items.length / PER_ROW)) * cellTotalH[i];
      const labelH = labelLines[i].length * LINE_H + LABEL_PAD * 2;
      return Math.max(itemsH, labelH);
    });

    const titleH = title.trim() ? 56 : 0;
    const contentW = LABEL_W + PER_ROW * cellW;
    const footerH = 30;
    const width = PAD * 2 + contentW;
    const height = PAD * 2 + titleH + rowHeights.reduce((a, b) => a + b, 0) + footerH;

    // Scale for crispness, but cap the device size so the canvas backing store
    // never exceeds the browser limit (which yields a silently blank export).
    const MAX_SIDE = 8192;
    let scale = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.max(0.5, Math.min(scale, MAX_SIDE / width, MAX_SIDE / height));
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    const drawCover = (im: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
      const sc = Math.max(dw / im.width, dh / im.height);
      const sw = dw / sc, sh = dh / sc;
      ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, dx, dy, dw, dh);
    };
    const drawContain = (im: HTMLImageElement, dx: number, dy: number, d: number) => {
      const scale = Math.min(d / im.width, d / im.height);
      const w = im.width * scale, h = im.height * scale;
      ctx.drawImage(im, dx + (d - w) / 2, dy + (d - h) / 2, w, h);
    };

    let y = PAD;
    if (titleH) {
      ctx.fillStyle = '#fafafa';
      ctx.font = '700 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title.trim(), width / 2, y + titleH / 2);
      y += titleH;
    }

    tiers.forEach((tr, ti) => {
      const rh = rowHeights[ti];
      // Label cell — wrapped, vertically centred
      ctx.fillStyle = tr.color;
      ctx.fillRect(PAD, y, LABEL_W, rh);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = labelLines[ti];
      const startY = y + (rh - lines.length * LINE_H) / 2 + LINE_H / 2;
      lines.forEach((ln, i) => ctx.fillText(ln, PAD + LABEL_W / 2, startY + i * LINE_H));
      // Items row background
      ctx.fillStyle = '#27272a';
      ctx.fillRect(PAD + LABEL_W, y, PER_ROW * cellW, rh);
      // Items
      tr.items.forEach((k, idx) => {
        const it = itemMap.get(k);
        if (!it) return;
        const isCard = !!(showCards && it.card);
        const src = isCard ? it.card! : it.img;
        const im = img.get(src);
        if (!im) return;
        const cellX = PAD + LABEL_W + (idx % PER_ROW) * cellW;
        const cellY = y + Math.floor(idx / PER_ROW) * cellTotalH[ti];
        const pad = isCard ? 0 : 3;
        const boxW = cellW - pad * 2;
        const boxH = cellH - pad * 2;
        const bx = cellX + pad, by = cellY + pad;
        // Thumbnail (rounded, cover-cropped to fill the box)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, isCard ? 4 : 6);
        ctx.clip();
        drawCover(im, bx, by, boxW, boxH);
        ctx.restore();
        // Overlays — positions differ per mode (CharacterCard puts elem/class
        // bottom-right; the portrait export puts elem top-right, class side).
        if (isCard) {
          if (showElement && it.element) {
            const el = img.get(`/images/ui/elem/CM_Element_${it.element}.webp`);
            if (el) { const s = boxW * 0.24; drawContain(el, bx + boxW - s - 2, by + boxH - s - 4, s); }
          }
          if (showClass && it.cls) {
            const cl = img.get(`/images/ui/class/CM_Class_${it.cls}.webp`);
            if (cl) { const s = boxW * 0.26; drawContain(cl, bx + boxW - s - 2, by + boxH - s * 2 - 8, s); }
          }
          if (showRarity && it.rarity) {
            const star = img.get('/images/ui/star/CM_icon_star_y.webp');
            if (star) {
              const s = boxW * 0.16;
              for (let r = 0; r < it.rarity; r++) drawContain(star, bx + boxW - s - 4, by + 4 + r * (s + 1), s);
            }
          }
          if (showCardTags) {
            const badgeSrc = recruitBadge(it.tags);
            const bd = badgeSrc ? img.get(badgeSrc) : null;
            if (bd) {
              const bw = boxW * 0.6;
              const bh = bw * bd.height / bd.width;
              ctx.drawImage(bd, bx + 2, by + 2, bw, bh);
            }
          }
        } else {
          if (showElement && it.element) {
            const el = img.get(`/images/ui/elem/CM_Element_${it.element}.webp`);
            if (el) { const s = boxW * 0.40; drawContain(el, bx + boxW - s, by, s); }
          }
          if (showClass && it.cls) {
            const cl = img.get(`/images/ui/class/CM_Class_${it.cls}.webp`);
            if (cl) { const s = boxW * 0.28; drawContain(cl, bx + boxW - s, by + boxW * 0.40, s); }
          }
          if (showRarity && it.rarity) {
            const star = img.get('/images/ui/star/CM_icon_star_y.webp');
            if (star) {
              const s = boxW * 0.20;
              let sx = bx + (boxW - it.rarity * s) / 2;
              const sy = by + boxW - s - 2;
              for (let r = 0; r < it.rarity; r++) { drawContain(star, sx, sy, s); sx += s; }
            }
          }
        }
        // Names below the cell — base then skin (card mode) or just base (portrait).
        ctx.font = NAME_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        let ty = cellY + cellH + 2;
        if (isCard) {
          if (showNames) {
            ctx.fillStyle = '#d4d4d8';
            const bn = baseNameLines.get(k) ?? [];
            bn.forEach((ln, i) => ctx.fillText(ln, cellX + cellW / 2, ty + i * NAME_LH));
            ty += bn.length * NAME_LH;
          }
          if (it.isSkin) {
            ctx.fillStyle = '#a1a1aa';
            (skinNameLines.get(k) ?? []).forEach((ln, i) => ctx.fillText(ln, cellX + cellW / 2, ty + i * NAME_LH));
          }
        } else if (showNames) {
          ctx.fillStyle = '#d4d4d8';
          (baseNameLines.get(k) ?? []).forEach((ln, i) => ctx.fillText(ln, cellX + cellW / 2, ty + i * NAME_LH));
        }
      });
      y += rh;
    });

    ctx.fillStyle = '#71717a';
    ctx.font = '500 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('outerpedia.com', width - PAD, y + footerH / 2);

    // Guard: if canvas readback comes back blank (broken GPU canvas, or a
    // privacy/anti-fingerprinting browser that neuters canvas), bail with a
    // message instead of silently downloading an empty PNG.
    try {
      if (ctx.getImageData(5, 5, 1, 1).data[3] === 0) {
        window.alert(t('tools.tier-list-maker.export_blocked'));
        return;
      }
    } catch {
      window.alert(t('tools.tier-list-maker.export_blocked'));
      return;
    }

    try {
      canvas.toBlob((blob) => {
        if (!blob) { window.alert('PNG export failed: the image came back empty.'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(title.trim() || 'tier-list').replace(/[^\w-]+/g, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      // A tainted canvas throws here — surface it instead of failing silently.
      window.alert(`PNG export failed: ${(err as Error).message}`);
    }
  }, [tiers, title, itemMap, iconSize, showNames, showElement, showClass, showRarity, showSkinNames, showCards, cardSize, showCardTags, lang, t]);

  // ── Render ──
  // Count base characters only — costumes are an opt-in extra hidden by default.
  const baseCharCount = useMemo(() => characters.filter((c) => !c.isSkin).length, [characters]);
  const TABS: { id: Tab; count: number }[] = [
    { id: 'characters', count: baseCharCount },
    { id: 'ee', count: ee.length },
    { id: 'bosses', count: bosses.length },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Title + toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('tools.tier-list-maker.title_placeholder')}
          maxLength={100}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-lg font-semibold text-white placeholder-zinc-500 focus:border-filter focus:outline-none sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <ToolbarButton onClick={copyLink} icon={copied ? <FaCheck /> : <FaLink />}>
            {copied ? t('tools.tier-list-maker.copied') : t('tools.tier-list-maker.share')}
          </ToolbarButton>
          <ToolbarButton onClick={exportPng} icon={<FaImage />}>
            {t('tools.tier-list-maker.export')}
          </ToolbarButton>
          <div className="relative">
            <ToolbarButton onClick={() => setShowSettings((v) => !v)} icon={<FaGear />}>
              {t('tools.tier-list-maker.settings')}
            </ToolbarButton>
            {showSettings && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                <div className="absolute right-0 z-50 mt-2 w-60 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm shadow-xl">
                  <p className="mb-1 text-xs uppercase tracking-wide text-zinc-400">{t('tools.tier-list-maker.icon_size')}</p>
                  <div className="mb-3 flex gap-1.5">
                    {(['s', 'm', 'l'] as IconSize[]).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setIconSize(sz)}
                        className={['flex-1 rounded px-2 py-1 text-xs font-medium transition', iconSize === sz ? 'bg-filter text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'].join(' ')}
                      >
                        {t(`tools.tier-list-maker.size_${sz}` as Parameters<typeof t>[0])}
                      </button>
                    ))}
                  </div>
                  <label className="mb-2 flex cursor-pointer items-center justify-between">
                    <span className="text-zinc-200">{t('tools.tier-list-maker.show_names')}</span>
                    <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                  </label>
                  <label className="mb-2 flex cursor-pointer items-center justify-between">
                    <span className="text-zinc-200">{t('tools.tier-list-maker.show_element')}</span>
                    <input type="checkbox" checked={showElement} onChange={(e) => setShowElement(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                  </label>
                  <label className="mb-2 flex cursor-pointer items-center justify-between">
                    <span className="text-zinc-200">{t('tools.tier-list-maker.show_class')}</span>
                    <input type="checkbox" checked={showClass} onChange={(e) => setShowClass(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                  </label>
                  <label className="mb-2 flex cursor-pointer items-center justify-between">
                    <span className="text-zinc-200">{t('tools.tier-list-maker.show_rarity')}</span>
                    <input type="checkbox" checked={showRarity} onChange={(e) => setShowRarity(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                  </label>
                  <label className="mb-2 flex cursor-pointer items-center justify-between border-t border-zinc-800 pt-2">
                    <span className="text-zinc-200">{t('tools.tier-list-maker.show_skins')}</span>
                    <input type="checkbox" checked={showSkins} onChange={(e) => setShowSkins(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                  </label>
                  <label className="mb-3 flex cursor-pointer items-center justify-between">
                    <span className="text-zinc-200">{t('tools.tier-list-maker.show_skin_names')}</span>
                    <input type="checkbox" checked={showSkinNames} onChange={(e) => setShowSkinNames(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                  </label>
                  <label className="mb-2 flex cursor-pointer items-center justify-between border-t border-zinc-800 pt-2">
                    <span className="text-zinc-200">{t('tools.tier-list-maker.show_cards')}</span>
                    <input type="checkbox" checked={showCards} onChange={(e) => setShowCards(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                  </label>
                  {showCards && (
                    <>
                      <p className="mb-1 text-xs uppercase tracking-wide text-zinc-400">{t('tools.tier-list-maker.card_size')}</p>
                      <div className="mb-3 flex gap-1.5">
                        {(['s', 'm', 'l'] as IconSize[]).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setCardSize(sz)}
                            className={['flex-1 rounded px-2 py-1 text-xs font-medium transition', cardSize === sz ? 'bg-filter text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'].join(' ')}
                          >
                            {t(`tools.tier-list-maker.size_${sz}` as Parameters<typeof t>[0])}
                          </button>
                        ))}
                      </div>
                      <label className="mb-3 flex cursor-pointer items-center justify-between">
                        <span className="text-zinc-200">{t('tools.tier-list-maker.show_card_tags')}</span>
                        <input type="checkbox" checked={showCardTags} onChange={(e) => setShowCardTags(e.target.checked)} className="h-4 w-4 accent-(--color-filter)" />
                      </label>
                    </>
                  )}
                  <div className="flex gap-2 border-t border-zinc-800 pt-3">
                    <button type="button" onClick={exportJson} className="flex flex-1 items-center justify-center gap-1.5 rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">
                      <FaFileExport /> {t('tools.tier-list-maker.export_json')}
                    </button>
                    <button type="button" onClick={() => importInputRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">
                      <FaFileImport /> {t('tools.tier-list-maker.import_json')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <ToolbarButton onClick={resetAll} icon={<FaArrowRotateLeft />} danger>
            {t('tools.tier-list-maker.reset')}
          </ToolbarButton>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }}
      />

      <p className="mb-3 text-center text-xs text-zinc-500">{t('tools.tier-list-maker.hint')}</p>

      <div className="lg:flex lg:items-start lg:gap-4">
      <div className="lg:min-w-0 lg:flex-1">
      {/* Tier rows */}
      <div className="overflow-hidden rounded-lg border border-zinc-700">
        {tiers.map((tier, idx) => {
          const isOver = dropAt?.tierId === tier.id;
          return (
            <div
              key={tier.id}
              data-drop="tier"
              data-tier-id={tier.id}
              onClick={(e) => tapZone(e, tier.id)}
              className={[
                'flex border-b border-zinc-800 last:border-b-0 transition-colors',
                rowDragActive === tier.id ? 'relative z-10 ring-2 ring-inset ring-amber-400' : '',
                isOver ? 'bg-amber-400/10' : selectedKey ? 'cursor-pointer hover:bg-zinc-800/40' : '',
              ].join(' ')}
            >
              {/* Label cell */}
              <div
                className="relative flex w-16 shrink-0 items-center justify-center p-1 sm:w-28"
                style={{ backgroundColor: tier.color }}
              >
                <TierLabel
                  value={tier.label}
                  onChange={(value) => updateTier(tier.id, { label: value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setColorRow(colorRow === tier.id ? null : tier.id); }}
                  title={t('tools.tier-list-maker.color') as string}
                  className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border border-zinc-900/40 bg-zinc-900/20"
                />
                {colorRow === tier.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setColorRow(null); }} />
                    <div
                      className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-6 gap-1">
                        {TIER_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { updateTier(tier.id, { color: c }); setColorRow(null); }}
                            className="h-6 w-6 rounded border border-zinc-700"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={tier.color}
                        onChange={(e) => updateTier(tier.id, { color: e.target.value })}
                        className="mt-2 h-7 w-full cursor-pointer rounded bg-transparent"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Items area */}
              <div data-items className="flex min-h-15 flex-1 flex-wrap content-start gap-1 bg-zinc-900 p-1.5">
                {(() => {
                  const showMarker = !!drag && dropAt?.tierId === tier.id;
                  const markerIdx = dropAt?.index ?? -1;
                  const dragIt = drag ? itemMap.get(drag.key) : undefined;
                  const useCardForDrag = showCards && !!dragIt?.card;
                  const dragImg = useCardForDrag ? dragIt!.card : dragIt?.img;
                  const marker = <DropPreview key="drop-marker" src={dragImg} size={useCardForDrag ? cardSize : iconSize} card={useCardForDrag} />;
                  const nodes: React.ReactNode[] = [];
                  tier.items.forEach((key, i) => {
                    if (showMarker && i === markerIdx) nodes.push(marker);
                    const it = itemMap.get(key);
                    if (!it) return;
                    if (showCards && it.card) {
                      nodes.push(
                        <CardView
                          key={key}
                          item={it}
                          selected={selectedKey === key}
                          dimmed={drag?.key === key}
                          /* Cards always show the base character name; the skin's own
                             name (if any) gets rendered below the card. */
                          label={localName(it.baseKey ?? key)}
                          skinLabel={it.isSkin ? localName(key) : undefined}
                          size={cardSize}
                          showName={showNames}
                          showElement={showElement}
                          showClass={showClass}
                          showStars={showRarity}
                          showBadge={showCardTags}
                          onPointerDown={onItemPointerDown}
                        />,
                      );
                    } else {
                      nodes.push(
                        <ItemView
                          key={key}
                          item={it}
                          selected={selectedKey === key}
                          dimmed={drag?.key === key}
                          label={localName(nameKeyFor(key))}
                          shortLabel={localShort(nameKeyFor(key))}
                          size={iconSize}
                          showName={showNames}
                          showElement={showElement}
                          showClass={showClass}
                          showRarity={showRarity}
                          onPointerDown={onItemPointerDown}
                        />,
                      );
                    }
                  });
                  if (showMarker && markerIdx >= tier.items.length) nodes.push(marker);
                  return nodes;
                })()}
              </div>

              {/* Row controls */}
              <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-zinc-800 bg-zinc-900 px-1.5">
                <button
                  type="button"
                  onPointerDown={(e) => onRowHandlePointerDown(e, tier.id)}
                  onClick={(e) => e.stopPropagation()}
                  title={t('tools.tier-list-maker.drag_row') as string}
                  className="flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded text-sm text-zinc-500 transition hover:bg-zinc-700 hover:text-white"
                >
                  <FaGripVertical />
                </button>
                <RowBtn onClick={() => moveRow(idx, -1)} disabled={idx === 0} title={t('tools.tier-list-maker.move_up') as string}>
                  <FaChevronUp />
                </RowBtn>
                <RowBtn onClick={() => moveRow(idx, 1)} disabled={idx === tiers.length - 1} title={t('tools.tier-list-maker.move_down') as string}>
                  <FaChevronDown />
                </RowBtn>
                <RowBtn onClick={() => clearRow(tier.id)} disabled={tier.items.length === 0} title={t('tools.tier-list-maker.clear_row') as string}>
                  <FaXmark />
                </RowBtn>
                <RowBtn onClick={() => deleteRow(tier.id)} disabled={tiers.length <= 1} title={t('tools.tier-list-maker.delete_row') as string} danger>
                  <FaTrash />
                </RowBtn>
                <RowBtn onClick={() => addRow(idx)} title={t('tools.tier-list-maker.add_row') as string}>
                  <FaPlus />
                </RowBtn>
              </div>
            </div>
          );
        })}
      </div>
      </div>{/* end tier column */}

      {/* Pool — side panel on desktop, stacked below on mobile */}
      <div className="mt-6 lg:mt-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-1.5rem)] lg:w-96 lg:shrink-0 lg:self-start lg:overflow-y-auto">
        {/* Tabs */}
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {TABS.map(({ id, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                tab === id ? 'bg-filter text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
              ].join(' ')}
            >
              {t(`tools.tier-list-maker.tab.${id}` as Parameters<typeof t>[0])}
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <FilterSearch value={rawQuery} onChange={setRawQuery} placeholder={t('tools.tier-list-maker.search') as string} />
        <div className="mt-2 flex items-center justify-center gap-2">
          <label className="text-xs text-zinc-400">{t('tools.tier-list-maker.sort')}</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-filter focus:outline-none"
          >
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>{t(`tools.tier-list-maker.sort_${k}` as Parameters<typeof t>[0])}</option>
            ))}
          </select>
        </div>
        {tab === 'characters' && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <div className="flex gap-1.5">
              {ELEMENTS.map((el) => (
                <FilterPill
                  key={el}
                  active={elementFilter.includes(el)}
                  onClick={() => setElementFilter((f) => (f.includes(el) ? f.filter((x) => x !== el) : [...f, el]))}
                  className="h-8 w-8 px-0"
                  title={el}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/ui/elem/CM_Element_${el}.webp`} alt={el} className="h-6 w-6" />
                </FilterPill>
              ))}
            </div>
            <div className="flex gap-1.5">
              {CLASSES.map((cl) => (
                <FilterPill
                  key={cl}
                  active={classFilter.includes(cl)}
                  onClick={() => setClassFilter((f) => (f.includes(cl) ? f.filter((x) => x !== cl) : [...f, cl]))}
                  className="h-8 w-8 px-0"
                  title={cl}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/ui/class/CM_Class_${cl}.webp`} alt={cl} className="h-6 w-6" />
                </FilterPill>
              ))}
            </div>
            <div className="flex gap-1.5">
              {RARITIES.map((r) => (
                <FilterPill
                  key={r}
                  active={rarityFilter.includes(r)}
                  onClick={() => setRarityFilter((f) => (f.includes(r) ? f.filter((x) => x !== r) : [...f, r]))}
                  className="h-8 px-2"
                  title={`${r}★`}
                >
                  <span className="text-xs font-semibold leading-none">{r}★</span>
                </FilterPill>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {FILTER_TAGS.map((tg) => (
                <FilterPill
                  key={tg}
                  active={tagFilter.includes(tg)}
                  onClick={() => setTagFilter((f) => (f.includes(tg) ? f.filter((x) => x !== tg) : [...f, tg]))}
                  className="h-8 px-2"
                  title={t(`tools.tier-list-maker.tag.${tg}` as Parameters<typeof t>[0]) as string}
                >
                  <span className="text-xs font-medium leading-none">{t(`tools.tier-list-maker.tag.${tg}` as Parameters<typeof t>[0])}</span>
                </FilterPill>
              ))}
              <FilterPill
                active={skinsOnly}
                onClick={() => setSkinsOnly((v) => !v)}
                className="h-8 px-2"
                title={t('tools.tier-list-maker.filter_skins_only') as string}
              >
                <span className="text-xs font-medium leading-none">{t('tools.tier-list-maker.filter_skins_only')}</span>
              </FilterPill>
            </div>
          </div>
        )}

        {/* Pool grid (drop target to un-rank) */}
        <div
          data-drop="pool"
          onClick={(e) => tapZone(e, 'pool')}
          className="mt-4 flex min-h-20 flex-wrap content-start justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-3"
        >
          {poolItems.length === 0 ? (
            <p className="py-6 text-sm text-zinc-500">
              {placed.size > 0 && query.trim() === '' && elementFilter.length === 0 && classFilter.length === 0 && rarityFilter.length === 0 && tagFilter.length === 0 && !skinsOnly
                ? t('tools.tier-list-maker.empty_pool')
                : t('tools.tier-list-maker.no_results')}
            </p>
          ) : (
            poolItems.map((it) => (
              <ItemView
                key={it.key}
                item={it}
                selected={selectedKey === it.key}
                dimmed={drag?.key === it.key}
                label={localName(nameKeyFor(it.key))}
                shortLabel={localShort(nameKeyFor(it.key))}
                size={iconSize}
                showName={showNames}
                showElement={showElement}
                showClass={showClass}
                showRarity={showRarity}
                onPointerDown={onItemPointerDown}
              />
            ))
          )}
        </div>
      </div>
      </div>{/* end layout */}

      {/* Drag ghost */}
      {drag && (
        <div
          className="pointer-events-none fixed z-100 -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: drag.x, top: drag.y }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={itemMap.get(drag.key)?.img}
            alt=""
            className="h-16 w-16 rounded-md border-2 border-amber-400 object-cover shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

// ── Small UI helpers ──

function ToolbarButton({
  onClick, icon, children, danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition',
        danger
          ? 'bg-red-900/40 text-red-200 hover:bg-red-900/70'
          : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}

function RowBtn({
  onClick, disabled, title, children, danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      title={title}
      className={[
        'flex h-6 w-6 items-center justify-center rounded text-sm transition',
        disabled
          ? 'cursor-not-allowed text-zinc-700'
          : danger
            ? 'text-red-400 hover:bg-red-900/40'
            : 'text-zinc-400 hover:bg-zinc-700 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

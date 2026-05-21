'use client';

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaPlus, FaTrash, FaChevronUp, FaChevronDown, FaXmark,
  FaImage, FaLink, FaArrowRotateLeft, FaCheck,
} from 'react-icons/fa6';
import type { LangMap } from '@/types/common';
import type { ElementType, ClassType, RarityType } from '@/types/enums';
import { ELEMENTS, CLASSES, RARITIES } from '@/types/enums';
import { useI18n } from '@/lib/contexts/I18nContext';
import { lRec } from '@/lib/i18n/localize';
import { FilterSearch, FilterPill } from '@/app/components/ui/FilterPills';

// ── Types ──

export type TierSourceItem = {
  key: string;
  name: LangMap;
  img: string;
  element?: string;
  cls?: string;
  rarity?: number;
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

const ITEM_CLS = 'h-11 w-11 sm:h-14 sm:w-14';

type ItemViewProps = {
  item: TierSourceItem;
  selected: boolean;
  dimmed: boolean;
  label: string;
  onPointerDown: (e: React.PointerEvent, key: string) => void;
};

const ItemView = memo(function ItemView({ item, selected, dimmed, label, onPointerDown }: ItemViewProps) {
  return (
    <div
      data-item-key={item.key}
      onPointerDown={(e) => onPointerDown(e, item.key)}
      title={label}
      className={[
        ITEM_CLS,
        'relative shrink-0 cursor-grab touch-none select-none rounded-md',
        'ring-offset-1 ring-offset-zinc-900 transition',
        selected ? 'ring-2 ring-amber-400' : 'ring-1 ring-zinc-700 hover:ring-zinc-400',
        dimmed ? 'opacity-30' : '',
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

  // Interaction state
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; x: number; y: number } | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);
  const [colorRow, setColorRow] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const localName = useCallback(
    (key: string) => {
      const it = itemMap.get(key);
      return it ? lRec(it.name, lang) : key;
    },
    [itemMap, lang],
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
    return sourceByTab[tab].filter((it) => {
      if (placed.has(it.key)) return false;
      if (elementFilter.length && (!it.element || !elementFilter.includes(it.element as ElementType))) return false;
      if (classFilter.length && (!it.cls || !classFilter.includes(it.cls as ClassType))) return false;
      if (rarityFilter.length && (it.rarity === undefined || !rarityFilter.includes(it.rarity as RarityType))) return false;
      if (q) {
        const name = Object.values(it.name).join(' ').toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [sourceByTab, tab, placed, query, elementFilter, classFilter, rarityFilter]);

  // ── Drag & drop (pointer events, mouse + touch) ──
  const startRef = useRef<{ x: number; y: number; key: string } | null>(null);
  const armedRef = useRef(false);
  const draggingRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent page scroll while a drag is active (touch).
  useEffect(() => {
    const block = (e: TouchEvent) => { if (draggingRef.current) e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  const updateDragOver = useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const zone = el?.closest('[data-drop="tier"]');
    setDragOverTier(zone?.getAttribute('data-tier-id') ?? null);
  }, []);

  const handleDrop = useCallback((key: string, x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const zone = el?.closest('[data-drop]') as HTMLElement | null;
    if (!zone) return;
    const drop = zone.getAttribute('data-drop');
    if (drop === 'pool') {
      setTiers((prev) => removeKey(prev, key));
      return;
    }
    if (drop === 'tier') {
      const tierId = zone.getAttribute('data-tier-id');
      if (!tierId) return;
      const itemEl = el?.closest('[data-item-key]') as HTMLElement | null;
      let beforeKey: string | null = itemEl?.getAttribute('data-item-key') ?? null;
      if (beforeKey === key) beforeKey = null;
      if (beforeKey && itemEl) {
        const r = itemEl.getBoundingClientRect();
        if (x > r.left + r.width / 2) beforeKey = null; // dropped past the midpoint → append-ish
        // when past midpoint we still want it right after; recompute below
      }
      setTiers((prev) => {
        // If past midpoint, insert after the hovered item.
        if (itemEl && beforeKey === null) {
          const hovered = itemEl.getAttribute('data-item-key');
          if (hovered && hovered !== key) {
            const cleaned = removeKey(prev, key);
            const idx = cleaned.findIndex((tr) => tr.id === tierId);
            if (idx >= 0) {
              const items = [...cleaned[idx].items];
              const hi = items.indexOf(hovered);
              const pos = hi >= 0 ? hi + 1 : items.length;
              items.splice(pos, 0, key);
              cleaned[idx] = { ...cleaned[idx], items };
              return cleaned;
            }
            return cleaned;
          }
        }
        return placeKey(prev, key, tierId, beforeKey);
      });
    }
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
      setDragOverTier(null);
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

  const deleteRow = (id: string) =>
    setTiers((prev) => (prev.length <= 1 ? prev : prev.filter((tr) => tr.id !== id)));

  const moveRow = (idx: number, dir: -1 | 1) =>
    setTiers((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const clearRow = (id: string) => updateTier(id, { items: [] });

  const resetAll = () => {
    if (!window.confirm(t('tools.tier-list-maker.confirm_reset'))) return;
    setTitle('');
    setTiers(makeDefaultTiers());
    setSelectedKey(null);
    shareBaselineRef.current = null;
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

  // ── PNG export ──
  const exportPng = useCallback(async () => {
    const CELL = 76, PER_ROW = 12, PAD = 20, LABEL_W = 110;
    const LABEL_PAD = 8, LINE_H = 24, LABEL_FONT = '700 20px system-ui, sans-serif';
    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = src;
      });

    const usedKeys = [...new Set(tiers.flatMap((tr) => tr.items))];
    const loaded = new Map<string, HTMLImageElement>();
    await Promise.all(
      usedKeys.map(async (k) => {
        const it = itemMap.get(k);
        if (!it) return;
        const im = await load(it.img);
        if (im) loaded.set(k, im);
      }),
    );

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Wrap each label, then size every row to fit both its items and its label.
    ctx.font = LABEL_FONT;
    const labelLines = tiers.map((tr) => wrapLabel(ctx, tr.label, LABEL_W - LABEL_PAD * 2));
    const rowHeights = tiers.map((tr, i) => {
      const itemsH = Math.max(1, Math.ceil(tr.items.length / PER_ROW)) * CELL;
      const labelH = labelLines[i].length * LINE_H + LABEL_PAD * 2;
      return Math.max(itemsH, labelH);
    });

    const titleH = title.trim() ? 56 : 0;
    const contentW = LABEL_W + PER_ROW * CELL;
    const footerH = 30;
    const width = PAD * 2 + contentW;
    const height = PAD * 2 + titleH + rowHeights.reduce((a, b) => a + b, 0) + footerH;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

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
      ctx.fillRect(PAD + LABEL_W, y, PER_ROW * CELL, rh);
      // Items
      tr.items.forEach((k, idx) => {
        const cx = PAD + LABEL_W + (idx % PER_ROW) * CELL;
        const cy = y + Math.floor(idx / PER_ROW) * CELL;
        const im = loaded.get(k);
        if (!im) return;
        const pad = 3;
        const cw = CELL - pad * 2;
        const scale = Math.max(cw / im.width, cw / im.height);
        const sw = cw / scale, sh = cw / scale;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx + pad, cy + pad, cw, cw, 6);
        ctx.clip();
        ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, cx + pad, cy + pad, cw, cw);
        ctx.restore();
      });
      y += rh;
    });

    ctx.fillStyle = '#71717a';
    ctx.font = '500 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('outerpedia.com', width - PAD, y + footerH / 2);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title.trim() || 'tier-list').replace(/[^\w-]+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [tiers, title, itemMap]);

  // ── Render ──
  const TABS: { id: Tab; count: number }[] = [
    { id: 'characters', count: characters.length },
    { id: 'ee', count: ee.length },
    { id: 'bosses', count: bosses.length },
  ];

  return (
    <div className="mx-auto max-w-5xl">
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
          <ToolbarButton onClick={resetAll} icon={<FaArrowRotateLeft />} danger>
            {t('tools.tier-list-maker.reset')}
          </ToolbarButton>
        </div>
      </div>

      <p className="mb-3 text-center text-xs text-zinc-500">{t('tools.tier-list-maker.hint')}</p>

      {/* Tier rows */}
      <div className="overflow-hidden rounded-lg border border-zinc-700">
        {tiers.map((tier, idx) => {
          const isOver = dragOverTier === tier.id;
          return (
            <div
              key={tier.id}
              data-drop="tier"
              data-tier-id={tier.id}
              onClick={(e) => tapZone(e, tier.id)}
              className={[
                'flex border-b border-zinc-800 last:border-b-0 transition-colors',
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
                  className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border border-zinc-900/40 bg-zinc-900/20"
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
              <div className="flex min-h-15 flex-1 flex-wrap content-start gap-1 bg-zinc-900 p-1.5">
                {tier.items.map((key) => {
                  const it = itemMap.get(key);
                  if (!it) return null;
                  return (
                    <ItemView
                      key={key}
                      item={it}
                      selected={selectedKey === key}
                      dimmed={drag?.key === key}
                      label={localName(key)}
                      onPointerDown={onItemPointerDown}
                    />
                  );
                })}
              </div>

              {/* Row controls */}
              <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-zinc-800 bg-zinc-900 px-1">
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

      {/* Pool */}
      <div className="mt-6">
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
              {placed.size > 0 && query.trim() === '' && elementFilter.length === 0 && classFilter.length === 0 && rarityFilter.length === 0
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
                label={localName(it.key)}
                onPointerDown={onItemPointerDown}
              />
            ))
          )}
        </div>
      </div>

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
        'flex h-5 w-5 items-center justify-center rounded text-[10px] transition',
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

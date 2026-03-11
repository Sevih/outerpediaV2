/**
 * Shared URL filter encoding/decoding for tier-list-like pages.
 * Uses the same bitfield + LZ-string approach as CharactersPageClient.
 */
import LZString from 'lz-string';

// ── Bitfield maps ──

const ELEM_BIT: Record<string, number> = { Fire: 0, Water: 1, Earth: 2, Light: 3, Dark: 4 };
const CLASS_BIT: Record<string, number> = { Striker: 0, Defender: 1, Ranger: 2, Healer: 3, Mage: 4 };
const RARITY_BIT: Record<number, number> = { 1: 0, 2: 1, 3: 2 };
const ROLE_BIT: Record<string, number> = { dps: 0, support: 1, sustain: 2 };
const CAT_BIT: Record<string, number> = {
  'world-boss': 0, 'joint-challenge': 1, 'guild-raid': 2, 'adventure': 3,
  'adventure-license': 4, 'special-request': 5, 'irregular-extermination': 6, 'skyward-tower': 7,
};

// Inverse maps
function invertStr(map: Record<string, number>): Record<number, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
}
function invertNum(map: Record<number, number>): Record<number, number> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, Number(k)]));
}

const ELEM_INV = invertStr(ELEM_BIT);
const CLASS_INV = invertStr(CLASS_BIT);
const RARITY_INV = invertNum(RARITY_BIT);
const ROLE_INV = invertStr(ROLE_BIT);
const CAT_INV = invertStr(CAT_BIT);

// ── Bitfield helpers ──

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

// ── Payload types ──

export type FilterPayload = {
  el?: string[];
  cl?: string[];
  r?: number[];
  role?: string[];
  q?: string;
  tr?: number;
  cat?: string[];
};

type CompactPayload = {
  e?: number;
  c?: number;
  r?: number;
  r2?: number;
  q?: string;
  tr?: number;
  ct?: number;
};

// ── Encode / Decode ──

export function encodeFilters(p: FilterPayload): string {
  const z: CompactPayload = {};
  if (p.el?.length) z.e = toBitfield(p.el, ELEM_BIT);
  if (p.cl?.length) z.c = toBitfield(p.cl, CLASS_BIT);
  if (p.r?.length) z.r = toBitfield(p.r, RARITY_BIT);
  if (p.role?.length) z.r2 = toBitfield(p.role, ROLE_BIT);
  if (p.q) z.q = p.q;
  if (p.tr !== undefined) z.tr = p.tr;
  if (p.cat?.length) z.ct = toBitfield(p.cat, CAT_BIT);
  return LZString.compressToEncodedURIComponent(JSON.stringify(z));
}

export function decodeFilters(encoded: string | null): FilterPayload | null {
  if (!encoded) return null;
  try {
    const z = JSON.parse(
      LZString.decompressFromEncodedURIComponent(encoded) || '{}'
    ) as CompactPayload;
    return {
      el: z.e ? fromBitfield(z.e, ELEM_INV, 5) : undefined,
      cl: z.c ? fromBitfield(z.c, CLASS_INV, 5) : undefined,
      r: z.r ? fromBitfield(z.r, RARITY_INV, 3) : undefined,
      role: z.r2 ? fromBitfield(z.r2, ROLE_INV, 3) : undefined,
      q: z.q,
      tr: z.tr,
      cat: z.ct ? fromBitfield(z.ct, CAT_INV, 8) : undefined,
    };
  } catch {
    return null;
  }
}

export function isEmptyPayload(p: FilterPayload): boolean {
  return !p.el?.length && !p.cl?.length && !p.r?.length && !p.role?.length
    && !p.q && p.tr === undefined && !p.cat?.length;
}
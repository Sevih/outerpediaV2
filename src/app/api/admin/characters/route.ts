import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'character');

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  const files = await fs.readdir(DATA_DIR);
  const characters = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(async f => {
        const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf-8');
        const data = JSON.parse(raw);
        return {
          ID: data.ID,
          Fullname: data.Fullname,
          Rarity: data.Rarity,
          Element: data.Element,
          Class: data.Class,
          rank: data.rank,
        };
      })
  );

  return NextResponse.json(characters);
}

// ── Key-order-preserving JSON stringify ──

/**
 * Extract key order from raw JSON text using regex.
 * Returns a map of JSON-pointer-like paths to ordered key arrays.
 * This reads key order from the TEXT, avoiding JS numeric key reordering.
 */
function extractKeyOrder(raw: string): Map<string, string[]> {
  const order = new Map<string, string[]>();

  // Parse the raw text character by character to track object key order
  function parse(text: string, startIdx: number, currentPath: string): number {
    let i = startIdx;
    i = skipWs(text, i);

    if (text[i] === '{') {
      i++; // skip {
      const keys: string[] = [];
      i = skipWs(text, i);
      if (text[i] !== '}') {
        while (i < text.length) {
          i = skipWs(text, i);
          // Read key
          const [key, nextI] = readString(text, i);
          keys.push(key);
          i = nextI;
          i = skipWs(text, i);
          i++; // skip :
          i = skipWs(text, i);
          // Recurse into value
          i = parse(text, i, currentPath ? `${currentPath}.${key}` : key);
          i = skipWs(text, i);
          if (text[i] === ',') { i++; continue; }
          if (text[i] === '}') break;
        }
      }
      order.set(currentPath, keys);
      i++; // skip }
      return i;
    }

    if (text[i] === '[') {
      i++; // skip [
      i = skipWs(text, i);
      let idx = 0;
      if (text[i] !== ']') {
        while (i < text.length) {
          i = parse(text, i, `${currentPath}[${idx}]`);
          idx++;
          i = skipWs(text, i);
          if (text[i] === ',') { i++; continue; }
          if (text[i] === ']') break;
        }
      }
      i++; // skip ]
      return i;
    }

    if (text[i] === '"') {
      const [, nextI] = readString(text, i);
      return nextI;
    }

    // number, boolean, null
    const match = text.substring(i).match(/^(-?\d+\.?\d*(?:[eE][+-]?\d+)?|true|false|null)/);
    if (match) return i + match[0].length;

    return i + 1;
  }

  function skipWs(text: string, i: number): number {
    while (i < text.length && /\s/.test(text[i])) i++;
    return i;
  }

  function readString(text: string, i: number): [string, number] {
    i++; // skip opening "
    let str = '';
    while (i < text.length) {
      if (text[i] === '\\') { str += text[i] + text[i + 1]; i += 2; continue; }
      if (text[i] === '"') { i++; break; }
      str += text[i];
      i++;
    }
    return [str, i];
  }

  parse(raw, 0, '');
  return order;
}

/**
 * Stringify a value using key order extracted from the original text.
 * Arrays of primitives shorter than 80 chars are kept compact (single line).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function orderedStringify(val: any, keyOrder: Map<string, string[]>, currentPath: string, depth: number): string {
  if (val === null) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);

  const indent = '  '.repeat(depth);
  const innerIndent = '  '.repeat(depth + 1);

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    // Check if all items are primitives
    const allPrimitive = val.every(v => v === null || typeof v !== 'object');
    if (allPrimitive) {
      const compact = '[' + val.map(v => JSON.stringify(v)).join(',') + ']';
      if (compact.length < 80) return compact;
    }
    const items = val.map((v, i) =>
      `${innerIndent}${orderedStringify(v, keyOrder, `${currentPath}[${i}]`, depth + 1)}`
    );
    return `[\n${items.join(',\n')}\n${indent}]`;
  }

  if (typeof val === 'object') {
    const originalKeys = keyOrder.get(currentPath) ?? [];
    // Use original key order, then append any new keys
    const allKeys = new Set([...originalKeys, ...Object.keys(val)]);
    const entries: string[] = [];
    for (const key of allKeys) {
      if (!(key in val)) continue;
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      const serialized = orderedStringify(val[key], keyOrder, childPath, depth + 1);
      entries.push(`${innerIndent}${JSON.stringify(key)}: ${serialized}`);
    }
    if (entries.length === 0) return '{}';
    return `{\n${entries.join(',\n')}\n${indent}}`;
  }

  return JSON.stringify(val);
}

// ── Editable fields ──

const EDITABLE_TOP = new Set(['Chain_Type', 'rank', 'rank_pvp', 'role', 'tags']);
const EDITABLE_SKILL = new Set(['cd', 'wgr', 'wgr_dual', 'offensive', 'target', 'buff', 'debuff', 'dual_offensive', 'dual_target', 'dual_buff', 'dual_debuff']);

/**
 * Merge only editable fields from `updates` into `original`.
 * Non-editable fields keep their original values (and original JS key order from parse).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeEditable(original: any, updates: any): any {
  const result = { ...original };

  for (const key of EDITABLE_TOP) {
    if (key in updates) result[key] = updates[key];
  }

  if (updates.skills && original.skills) {
    result.skills = { ...original.skills };
    for (const sk of Object.keys(original.skills)) {
      if (!updates.skills[sk]) continue;
      result.skills[sk] = { ...original.skills[sk] };
      for (const field of EDITABLE_SKILL) {
        if (field in updates.skills[sk]) {
          result.skills[sk][field] = updates.skills[sk][field];
        }
      }
    }
  }

  return result;
}

export async function PUT(request: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const data = await request.json();
  if (!data.ID) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR, `${data.ID}.json`);

  try {
    const originalRaw = await fs.readFile(filePath, 'utf-8');

    // Extract key order from the raw text (before JS reorders numeric keys)
    const keyOrder = extractKeyOrder(originalRaw);

    // Merge only editable fields
    const original = JSON.parse(originalRaw);
    const merged = mergeEditable(original, data);

    // Serialize using original key order
    const output = orderedStringify(merged, keyOrder, '', 0) + '\n';

    // Validate
    JSON.parse(output);

    await fs.writeFile(filePath, output, 'utf-8');
  } catch (err) {
    return NextResponse.json({ error: `Save failed: ${err}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

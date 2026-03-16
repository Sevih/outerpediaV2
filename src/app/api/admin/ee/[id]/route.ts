import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const EE_PATH = path.join(process.cwd(), 'data', 'equipment', 'ee.json');

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const raw = await fs.readFile(EE_PATH, 'utf-8');
  const all = JSON.parse(raw);

  return NextResponse.json(all[id] ?? null);
}

/** Serialize an EE entry preserving original key order from the raw text. */
function serializeEntry(original: string, updated: Record<string, unknown>, indent: string): string {
  // Extract key order from original text (avoids JS reorder)
  const keyOrder: string[] = [];
  const keyRegex = /"([^"]+)"\s*:/g;
  let m: RegExpExecArray | null;
  // Only match top-level keys of this entry (not nested)
  let depth = 0;
  for (let i = 0; i < original.length; i++) {
    if (original[i] === '{') depth++;
    else if (original[i] === '}') depth--;
    // We want keys at depth 1 (inside the entry object)
  }
  // Simpler: just scan for keys at the entry level
  depth = 0;
  for (let i = 0; i < original.length; i++) {
    if (original[i] === '{' || original[i] === '[') depth++;
    else if (original[i] === '}' || original[i] === ']') depth--;
    else if (original[i] === '"' && depth === 1) {
      // Try to match a key
      keyRegex.lastIndex = i;
      m = keyRegex.exec(original);
      if (m && m.index === i) {
        keyOrder.push(m[1]);
        i = keyRegex.lastIndex - 1;
      }
    }
  }

  // Build ordered keys: original order first, then any new keys
  const allKeys = new Set([...keyOrder, ...Object.keys(updated)]);
  const lines: string[] = [];

  for (const key of allKeys) {
    if (!(key in updated)) continue;
    const val = updated[key];
    let formatted: string;

    if (Array.isArray(val)) {
      if (val.length === 0) {
        formatted = '[]';
      } else {
        const compact = '[' + val.map(v => JSON.stringify(v)).join(', ') + ']';
        if (compact.length < 80) {
          formatted = compact;
        } else {
          formatted = '[\n' + val.map(v => `${indent}    ${JSON.stringify(v)}`).join(',\n') + `\n${indent}  ]`;
        }
      }
    } else {
      formatted = JSON.stringify(val);
    }

    lines.push(`${indent}  ${JSON.stringify(key)}: ${formatted}`);
  }

  return `{\n${lines.join(',\n')}\n${indent}}`;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const updates = await request.json();
  const originalRaw = await fs.readFile(EE_PATH, 'utf-8');
  const all = JSON.parse(originalRaw);

  if (!all[id]) {
    return NextResponse.json({ error: 'EE not found' }, { status: 404 });
  }

  // Apply only editable fields
  const editable = ['rank', 'buff', 'debuff', 'rank10'] as const;
  for (const field of editable) {
    if (field in updates) {
      all[id][field] = updates[field];
    }
  }

  // Find the entry's object boundaries in the raw text
  const entryKeyStart = originalRaw.indexOf(`"${id}":`);
  if (entryKeyStart === -1) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 500 });
  }

  const objStart = originalRaw.indexOf('{', entryKeyStart);
  let braceCount = 0;
  let objEnd = objStart;
  for (let i = objStart; i < originalRaw.length; i++) {
    if (originalRaw[i] === '{') braceCount++;
    else if (originalRaw[i] === '}') {
      braceCount--;
      if (braceCount === 0) { objEnd = i + 1; break; }
    }
  }

  const entryRaw = originalRaw.substring(objStart, objEnd);

  // Detect indentation of the entry
  const lineStart = originalRaw.lastIndexOf('\n', entryKeyStart);
  const indent = originalRaw.substring(lineStart + 1, entryKeyStart).match(/^\s*/)?.[0] ?? '  ';

  // Reserialize just this entry with original key order
  const newEntry = serializeEntry(entryRaw, all[id], indent);

  const output = originalRaw.substring(0, objStart) + newEntry + originalRaw.substring(objEnd);

  // Validate
  JSON.parse(output);
  await fs.writeFile(EE_PATH, output, 'utf-8');

  return NextResponse.json({ success: true });
}

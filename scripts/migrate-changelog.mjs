/**
 * One-time migration script: converts v1 changelog.ts → v2 changelog.json
 *
 * Usage: node scripts/migrate-changelog.mjs
 *
 * Reads the raw TS array via a regex-based extraction,
 * normalises every entry to { date, type, title: LangMap, content: LangMapArray, url? }.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const V1_PATH = resolve(
  __dirname,
  '../../outerpedia-clean/src/data/changelog.ts'
);
const OUT_PATH = resolve(__dirname, '../data/changelog.json');

// Read the TS source
const src = readFileSync(V1_PATH, 'utf-8');

// Extract the array between "oldChangelog = [" and "] as const"
const match = src.match(
  /export const oldChangelog\s*=\s*\[([\s\S]*?)\]\s*as\s*const/
);
if (!match) {
  console.error('Could not find oldChangelog array in source.');
  process.exit(1);
}

// We'll eval the array content in a safe-ish way by wrapping it
// Remove TypeScript casts like "as LString" before eval
let arrayBody = match[1].replace(/\bas\s+LString\b/g, '');

// Wrap in array brackets and parse via Function (no imports needed)
const entries = new Function(`return [${arrayBody}]`)();

/**
 * Normalise an LString (string | { en, jp?, kr?, zh? }) → LangMap { en, jp?, ... }
 */
function normaliseLString(val) {
  if (typeof val === 'string') {
    return { en: val };
  }
  // It's already a LangMap-like object
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Normalise content field → LangMapArray
 * v1 content can be: string | string[] | LString[]
 */
function normaliseContent(content) {
  // Single string → en-only single line
  if (typeof content === 'string') {
    return {
      en: content
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    };
  }

  // Array
  if (!Array.isArray(content)) return { en: [] };

  // Check if it's string[] (all plain strings) or LString[]
  const allStrings = content.every((c) => typeof c === 'string');
  if (allStrings) {
    return { en: content };
  }

  // LString[] → merge per language
  const result = {};
  for (const item of content) {
    const map = normaliseLString(item);
    for (const [lang, text] of Object.entries(map)) {
      if (!result[lang]) result[lang] = [];
      result[lang].push(text);
    }
  }
  return result;
}

// Convert all entries
const output = entries.map((e) => {
  const entry = {
    date: e.date,
    type: e.type,
    title: normaliseLString(e.title),
    content: normaliseContent(e.content),
  };
  if (e.url) entry.url = e.url;
  return entry;
});

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Migrated ${output.length} entries → ${OUT_PATH}`);

/**
 * Verify that all inline tags ({B/...}, {P/...}, etc.) used across the codebase
 * reference values that actually exist in the data files.
 *
 * Usage: node scripts/verify-inline-tags.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SRC = path.join(ROOT, 'src');

// ── Load valid values ──────────────────────────────────────────────

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf-8'));
}

function loadCharacterNames() {
  const index = loadJson('generated/characters-index.json');
  return new Set(Object.values(index).map((c) => c.Fullname));
}

function loadNames(rel) {
  const arr = loadJson(rel);
  return new Set(arr.map((e) => e.name));
}

function loadKeys(rel) {
  return new Set(Object.keys(loadJson(rel)));
}

function loadSetNames() {
  const full = loadNames('equipment/sets.json');
  const withShort = new Set(full);
  for (const name of full) {
    if (name.endsWith(' Set') || name.endsWith(' set')) {
      withShort.add(name.replace(/ [Ss]et$/, ''));
    }
  }
  return withShort;
}

const VALID = {
  B: loadNames('effects/buffs.json'),
  D: loadNames('effects/debuffs.json'),
  E: new Set(['Fire', 'Water', 'Earth', 'Light', 'Dark']),
  C: new Set([
    'Striker', 'Defender', 'Ranger', 'Healer', 'Mage',
    'Attacker', 'Bruiser', 'Sweeper', 'Phalanx', 'Tactician',
    'Vanguard', 'Sage', 'Reliever', 'Wizard', 'Enchanter',
  ]),
  S: loadKeys('stats.json'),
  P: loadCharacterNames(),
  EE: loadCharacterNames(),
  AS: loadSetNames(),
  SK: loadCharacterNames(),
  'I-W': loadNames('equipment/weapon.json'),
  'I-A': loadNames('equipment/accessory.json'),
  'I-T': loadNames('equipment/talisman.json'),
  'I-I': loadNames('items.json'),
};

// ── Scan files ─────────────────────────────────────────────────────

const TAG_REGEX = /\{((?:[BDSCEP])|EE|AS|SK|I-(?:W|A|T|I))\/([^}]+)\}/g;

function collectFiles(dir, exts) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      results.push(...collectFiles(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('<!--')) continue;
    let match;
    TAG_REGEX.lastIndex = 0;

    while ((match = TAG_REGEX.exec(line)) !== null) {
      const [full, tagType, rawValue] = match;
      const validSet = VALID[tagType];
      if (!validSet) continue;

      if (tagType === 'C') {
        const parts = rawValue.split('|');
        for (const part of parts) {
          if (!validSet.has(part)) {
            issues.push({ file: filePath, line: i + 1, tag: full, type: tagType, value: part });
          }
        }
        continue;
      }

      if (tagType === 'SK') {
        const [charName] = rawValue.split('|');
        if (!validSet.has(charName)) {
          issues.push({ file: filePath, line: i + 1, tag: full, type: tagType, value: charName });
        }
        continue;
      }

      if (!validSet.has(rawValue)) {
        issues.push({ file: filePath, line: i + 1, tag: full, type: tagType, value: rawValue });
      }
    }
  }
  return issues;
}

// ── Main ───────────────────────────────────────────────────────────

const files = [
  ...collectFiles(SRC, ['.tsx', '.ts', '.json']),
  ...collectFiles(DATA, ['.json']),
];

const allIssues = [];
let totalTags = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  TAG_REGEX.lastIndex = 0;
  let m;
  while ((m = TAG_REGEX.exec(content)) !== null) totalTags++;
  allIssues.push(...scanFile(file));
}

if (allIssues.length === 0) {
  console.log(`  \x1b[32m✓\x1b[0m Inline tags: all ${totalTags} tags valid`);
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ Inline tags: ${allIssues.length} invalid tag(s) out of ${totalTags}\x1b[0m\n`);

  const byType = new Map();
  for (const issue of allIssues) {
    const arr = byType.get(issue.type) || [];
    arr.push(issue);
    byType.set(issue.type, arr);
  }

  for (const [type, issues] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  {${type}/...} (${issues.length}):`);
    for (const issue of issues) {
      const rel = path.relative(ROOT, issue.file).replace(/\\/g, '/');
      console.log(`    ${rel}:${issue.line}  →  ${issue.tag}  (unknown: "${issue.value}")`);
    }
  }
  console.log();
  process.exit(1);
}

/**
 * Verify all buffs & debuffs usage across characters, bosses, EE, and inline tags.
 * Reports each effect with its usage count and flags unknown effects.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// Load reference effects
const buffs = JSON.parse(readFileSync(join(DATA_DIR, 'effects', 'buffs.json'), 'utf-8'));
const debuffs = JSON.parse(readFileSync(join(DATA_DIR, 'effects', 'debuffs.json'), 'utf-8'));
const groupMap = JSON.parse(readFileSync(join(DATA_DIR, 'generated', 'effect-group-map.json'), 'utf-8'));

const knownBuffNames = new Set(buffs.map(b => b.name));
const knownDebuffNames = new Set(debuffs.map(d => d.name));

// Track usage: { effectName: { buff: count, debuff: count, buffSources: Set, debuffSources: Set } }
const usage = {};

function track(effectName, type, source) {
  if (!usage[effectName]) {
    usage[effectName] = { buff: 0, debuff: 0, buffSources: new Set(), debuffSources: new Set() };
  }
  usage[effectName][type]++;
  usage[effectName][type === 'buff' ? 'buffSources' : 'debuffSources'].add(source);
}

// 1. Characters
const charDir = join(DATA_DIR, 'character');
const charFiles = readdirSync(charDir).filter(f => f.endsWith('.json'));

for (const file of charFiles) {
  const char = JSON.parse(readFileSync(join(charDir, file), 'utf-8'));
  const charId = char.ID || file.replace('.json', '');
  const charName = char.Fullname || charId;

  if (char.skills) {
    for (const [skillKey, skill] of Object.entries(char.skills)) {
      const src = `char:${charName}(${charId})/${skillKey}`;
      for (const b of skill.buff || []) track(b, 'buff', src);
      for (const d of skill.debuff || []) track(d, 'debuff', src);

      // Check burnEffect (burst skills)
      if (skill.burnEffect) {
        for (const [burstKey, burst] of Object.entries(skill.burnEffect)) {
          const burstSrc = `char:${charName}(${charId})/${skillKey}/${burstKey}`;
          for (const b of burst.buff || []) track(b, 'buff', burstSrc);
          for (const d of burst.debuff || []) track(d, 'debuff', burstSrc);
        }
      }
    }
  }

  // Chain skill
  if (char.chain) {
    const chainSrc = `char:${charName}(${charId})/chain`;
    for (const b of char.chain.buff || []) track(b, 'buff', chainSrc);
    for (const d of char.chain.debuff || []) track(d, 'debuff', chainSrc);
  }
}

// 2. Bosses
const bossDir = join(DATA_DIR, 'boss');
const bossFiles = readdirSync(bossDir).filter(f => f.endsWith('.json') && f !== 'index.json');

for (const file of bossFiles) {
  const boss = JSON.parse(readFileSync(join(bossDir, file), 'utf-8'));
  const bossId = boss.id || file.replace('.json', '');
  const bossName = boss.Name?.en || bossId;

  if (Array.isArray(boss.skills)) {
    for (const skill of boss.skills) {
      const skillName = skill.name?.en || skill.type || '?';
      const src = `boss:${bossName}(${bossId})/${skillName}`;
      for (const b of skill.buff || []) track(b, 'buff', src);
      for (const d of skill.debuff || []) track(d, 'debuff', src);
    }
  }
}

// 3. EE (Exclusive Equipment)
const ee = JSON.parse(readFileSync(join(DATA_DIR, 'equipment', 'ee.json'), 'utf-8'));

for (const [charId, eeData] of Object.entries(ee)) {
  const eeName = eeData.name || charId;
  const src = `ee:${eeName}(${charId})`;
  for (const b of eeData.buff || []) track(b, 'buff', src);
  for (const d of eeData.debuff || []) track(d, 'debuff', src);
}

// 4. Inline tags {B/...} and {D/...} in data/ and src/
const TAG_RE = /\{([BD])\/([^}]+)\}/g;
const ROOT = join(__dirname, '..');

function scanDirForTags(dir, base) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
      scanDirForTags(full, base);
    } else if (/\.(json|tsx?|jsx?|mjs)$/.test(entry.name) && entry.name !== 'parse-text.tsx') {
      const content = readFileSync(full, 'utf-8');
      let match;
      TAG_RE.lastIndex = 0;
      while ((match = TAG_RE.exec(content)) !== null) {
        const tagType = match[1]; // B or D
        const effectName = match[2];
        const type = tagType === 'B' ? 'buff' : 'debuff';
        const rel = relative(ROOT, full).replace(/\\/g, '/');
        track(effectName, type, `tag:${rel}`);
      }
    }
  }
}

scanDirForTags(join(ROOT, 'data'), ROOT);
scanDirForTags(join(ROOT, 'src'), ROOT);

// Analysis
const allEffectNames = Object.keys(usage).sort();

// Mismatch: used as buff but only defined in debuffs.json (or vice versa)
// Missing: used but not in either file
const mismatchBuffs = [];   // used as buff, exists in debuffs.json only
const mismatchDebuffs = []; // used as debuff, exists in buffs.json only
const missingBuffs = [];    // used as buff, exists in neither file
const missingDebuffs = [];  // used as debuff, exists in neither file
const unusedBuffs = [];
const unusedDebuffs = [];

for (const name of allEffectNames) {
  const u = usage[name];
  const canonical = groupMap[name] || name;
  const inBuffs = knownBuffNames.has(canonical);
  const inDebuffs = knownDebuffNames.has(canonical);

  if (u.buff > 0 && !inBuffs) {
    if (inDebuffs) mismatchBuffs.push(name);
    else missingBuffs.push(name);
  }
  if (u.debuff > 0 && !inDebuffs) {
    if (inBuffs) mismatchDebuffs.push(name);
    else missingDebuffs.push(name);
  }
}

// Unused: defined but never referenced anywhere
for (const b of buffs) {
  const isUsed = usage[b.name]?.buff > 0;
  const hasVariantUsed = Object.entries(groupMap).some(
    ([variant, canonical]) => canonical === b.name && usage[variant]?.buff > 0
  );
  if (!isUsed && !hasVariantUsed) unusedBuffs.push(b.name);
}

for (const d of debuffs) {
  const isUsed = usage[d.name]?.debuff > 0;
  const hasVariantUsed = Object.entries(groupMap).some(
    ([variant, canonical]) => canonical === d.name && usage[variant]?.debuff > 0
  );
  if (!isUsed && !hasVariantUsed) unusedDebuffs.push(d.name);
}

// Output
console.log('=== BUFF & DEBUFF USAGE REPORT ===\n');

console.log(`Total unique effects used: ${allEffectNames.length}`);
console.log(`Defined buffs: ${buffs.length} | Defined debuffs: ${debuffs.length}\n`);

// Usage table sorted by total count descending
console.log('--- ALL EFFECTS (sorted by usage count) ---\n');
console.log('Effect'.padEnd(45), 'Buff'.padStart(5), 'Debuff'.padStart(7), 'Total'.padStart(6));
console.log('-'.repeat(65));

const sorted = allEffectNames
  .map(name => ({ name, ...usage[name], total: usage[name].buff + usage[name].debuff }))
  .sort((a, b) => b.total - a.total);

for (const { name, buff, debuff, total } of sorted) {
  const mapped = groupMap[name] ? ` -> ${groupMap[name]}` : '';
  console.log(`${(name + mapped).padEnd(45)} ${String(buff).padStart(5)} ${String(debuff).padStart(7)} ${String(total).padStart(6)}`);
}

if (mismatchBuffs.length > 0) {
  console.log(`\n--- MISMATCH: used as buff but only in debuffs.json (${mismatchBuffs.length}) ---\n`);
  for (const name of mismatchBuffs) {
    console.log(`  ✗ ${name} (${usage[name].buff}x as buff)`);
    for (const src of usage[name].buffSources) console.log(`      ${src}`);
  }
}

if (mismatchDebuffs.length > 0) {
  console.log(`\n--- MISMATCH: used as debuff but only in buffs.json (${mismatchDebuffs.length}) ---\n`);
  for (const name of mismatchDebuffs) {
    console.log(`  ✗ ${name} (${usage[name].debuff}x as debuff)`);
    for (const src of usage[name].debuffSources) console.log(`      ${src}`);
  }
}

if (missingBuffs.length > 0) {
  console.log(`\n--- MISSING BUFFS (not in buffs.json nor debuffs.json) ---\n`);
  for (const name of missingBuffs) {
    console.log(`  ⚠ ${name} (${usage[name].buff}x as buff)`);
    for (const src of usage[name].buffSources) console.log(`      ${src}`);
  }
}

if (missingDebuffs.length > 0) {
  console.log(`\n--- MISSING DEBUFFS (not in buffs.json nor debuffs.json) ---\n`);
  for (const name of missingDebuffs) {
    console.log(`  ⚠ ${name} (${usage[name].debuff}x as debuff)`);
    for (const src of usage[name].debuffSources) console.log(`      ${src}`);
  }
}

if (unusedBuffs.length > 0) {
  console.log(`\n--- UNUSED BUFFS (in buffs.json but never used) ---\n`);
  for (const name of unusedBuffs) console.log(`  - ${name}`);
}

if (unusedDebuffs.length > 0) {
  console.log(`\n--- UNUSED DEBUFFS (in debuffs.json but never used) ---\n`);
  for (const name of unusedDebuffs) console.log(`  - ${name}`);
}

console.log(`\n--- SUMMARY ---`);
console.log(`Mismatch (buff↔debuff):  ${mismatchBuffs.length + mismatchDebuffs.length}`);
console.log(`Missing (nowhere):       ${missingBuffs.length + missingDebuffs.length}`);
console.log(`Unused buffs:            ${unusedBuffs.length}`);
console.log(`Unused debuffs:          ${unusedDebuffs.length}`);

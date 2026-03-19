import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  readTemplet, buildTextMap, expandLang,
  LANGS,
} from '@/app/admin/lib/text';

const WEAPON_PATH = path.join(process.cwd(), 'data', 'equipment', 'weapon.json');

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ── Types ──────────────────────────────────────────────────────────

type BuffRow = Record<string, string>;
type WeaponEntry = Record<string, unknown>;

// ── Placeholder resolution ─────────────────────────────────────────

function isPermilleValue(buff: BuffRow): boolean {
  if (buff.ApplyingType === 'OAT_RATE') return true;
  const stat = buff.StatType ?? '';
  if (stat.includes('_RATE') || stat.includes('_DMG')) return true;
  const type = buff.Type ?? '';
  if (type === 'BT_ADDITIVE_TURN') return true;
  if (type.includes('_ENHANCE')) return true;
  return false;
}

function formatBuffValue(buff: BuffRow): string {
  const rawValue = parseInt(buff.Value ?? '0');
  return isPermilleValue(buff) ? `${Math.abs(rawValue) / 10}%` : String(Math.abs(rawValue));
}

function formatBuffTurn(buff: BuffRow): string {
  return /^\d+$/.test(buff.TurnDuration ?? '') ? buff.TurnDuration! : '?';
}

function c(v: string): string {
  return `<color=#28d9ed>${v}</color>`;
}

/**
 * Find buff rows by BuffID and Level.
 * BuffIDs can be comma-separated (e.g. "BID_A,BID_B,BID_C").
 * Returns the primary buff (first ID) at the given level.
 */
function findWeaponBuff(buffData: BuffRow[], buffIdStr: string, level: number, suffix = ''): BuffRow | undefined {
  const ids = buffIdStr.split(',').map(s => s.trim());
  const primaryId = ids[0] + suffix;
  return buffData.find(r => r.BuffID === primaryId && String(r.Level) === String(level));
}

function findWeaponBuff2(buffData: BuffRow[], buffIdStr: string, level: number): BuffRow | undefined {
  const ids = buffIdStr.split(',').map(s => s.trim());
  // _2 suffix buff
  const id2 = ids.find(id => id.endsWith('_2')) ?? (ids[0] + '_2');
  return buffData.find(r => r.BuffID === id2 && String(r.Level) === String(level));
}

function findWeaponBuffN(buffData: BuffRow[], buffIdStr: string, level: number, n: number): BuffRow | undefined {
  const ids = buffIdStr.split(',').map(s => s.trim());
  const idN = ids.find(id => id.endsWith(`_${n}`)) ?? (ids[0] + `_${n}`);
  return buffData.find(r => r.BuffID === idN && String(r.Level) === String(level));
}

function resolveWeaponPlaceholders(text: string, buffData: BuffRow[], buffIdStr: string, level: number): string {
  const buff = findWeaponBuff(buffData, buffIdStr, level);
  const buff2 = findWeaponBuff2(buffData, buffIdStr, level);

  const rate = buff?.CreateRate ? `${parseInt(buff.CreateRate) / 10}%` : '?';
  const value = buff ? formatBuffValue(buff) : '?';
  const turn = buff ? formatBuffTurn(buff) : '?';

  const value2 = buff2 ? formatBuffValue(buff2) : '?';
  const turn2 = buff2 ? formatBuffTurn(buff2) : '?';

  // Value4, Value5 from _4, _5 suffix buffs
  const buff4 = findWeaponBuffN(buffData, buffIdStr, level, 4);
  const buff5 = findWeaponBuffN(buffData, buffIdStr, level, 5);
  const value4 = buff4 ? formatBuffValue(buff4) : '?';
  const value5 = buff5 ? formatBuffValue(buff5) : '?';

  return text
    .replace(/\[\+Value5\]/gi, c(`+${value5}`))
    .replace(/\[-Value5\]/gi, c(`-${value5}`))
    .replace(/\[Value5\]/gi, c(value5))
    .replace(/\[\+Value4\]/gi, c(`+${value4}`))
    .replace(/\[-Value4\]/gi, c(`-${value4}`))
    .replace(/\[Value4\]/gi, c(value4))
    .replace(/\[\+Value2\]/gi, c(`+${value2}`))
    .replace(/\[-Value2\]/gi, c(`-${value2}`))
    .replace(/\[Value2\]/gi, c(value2))
    .replace(/\[RATE\]/gi, c(rate))
    .replace(/\[Rate\]/gi, c(rate))
    .replace(/\[\+Value\]/gi, c(`+${value}`))
    .replace(/\[-Value\]/gi, c(`-${value}`))
    .replace(/\[Value\]/gi, c(value))
    .replace(/\[\+Turn\]/gi, c(turn))
    .replace(/\[-Turn\]/gi, c(`-${turn}`))
    .replace(/\[Turn2\]/gi, c(turn2))
    .replace(/\[Turn\]/gi, c(turn));
}

// ── Class from IconName ────────────────────────────────────────────

function classFromIcon(iconName: string): string {
  if (iconName.includes('_Defender')) return 'Defender';
  if (iconName.includes('_Ranger')) return 'Ranger';
  if (iconName.includes('_Mage')) return 'Mage';
  if (iconName.includes('_Priest')) return 'Healer';
  return 'Striker';
}

// ── Rarity from BasicStar ──────────────────────────────────────────

function rarityFromStar(star: string): string {
  const s = parseInt(star);
  if (s >= 6) return 'legendary';
  return 'epic';
}

// ── Key order for weapon.json entries ──────────────────────────────

const WEAPON_KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'type', 'rarity', 'image',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon', 'class', 'boss', 'level', 'mainStats', 'source',
];

function orderWeaponKeys(obj: WeaponEntry): WeaponEntry {
  const ordered: WeaponEntry = {};
  for (const key of WEAPON_KEY_ORDER) {
    if (key in obj) ordered[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (!(key in ordered)) ordered[key] = obj[key];
  }
  return ordered;
}

// ── Line ending detection ──────────────────────────────────────────

function detectEol(raw: string): string {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

// ── Max buff level ─────────────────────────────────────────────────

function getMaxBuffLevel(buffData: BuffRow[], buffIdStr: string): number {
  const primaryId = buffIdStr.split(',')[0].trim();
  const levels = buffData
    .filter(r => r.BuffID === primaryId)
    .map(r => parseInt(r.Level) || 1);
  return levels.length > 0 ? Math.max(...levels) : 1;
}

// ── Handlers ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action') ?? 'list';

  try {
    switch (action) {
      case 'list':
        return await handleList();
      case 'compare':
        return await handleCompare();
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleList() {
  const [itemTemplet, textItem, specialOpt, textSkill] = await Promise.all([
    readTemplet('ItemTemplet'),
    readTemplet('TextItem'),
    readTemplet('ItemSpecialOptionTemplet'),
    readTemplet('TextSkill'),
  ]);

  const textItemMap = buildTextMap(textItem.data);
  const textSkillMap = buildTextMap(textSkill.data);

  const optMap: Record<string, Record<string, string>> = {};
  for (const o of specialOpt.data) optMap[o.GroupID] = o;

  // Load existing weapon.json
  let existing: Record<string, WeaponEntry> = {};
  try {
    existing = JSON.parse(await fs.readFile(WEAPON_PATH, 'utf-8'));
  } catch { /* doesn't exist */ }

  // Build existing lookup by name+class for matching
  const existingByNameClass = new Map<string, string>();
  for (const [key, entry] of Object.entries(existing)) {
    const lookupKey = `${entry.name}|${entry.class ?? ''}`;
    existingByNameClass.set(lookupKey, key);
  }

  // All unique weapons from game data
  const weapons = itemTemplet.data.filter(
    (r: Record<string, string>) => r.ItemSubType === 'ITS_EQUIP_WEAPON' && r.ItemGrade === 'IG_UNIQUE'
  );

  const entries = weapons.map((row: Record<string, string>) => {
    const id = row.ID;
    const nameTexts = textItemMap[row.DescIDSymbol];
    const name = nameTexts?.en ?? id;
    const cls = classFromIcon(row.IconName ?? '');
    const [, effectId] = (row.SubOptionGroupID ?? '').split(',');
    const effectOpt = effectId ? optMap[effectId] : undefined;
    const effectNameTexts = effectOpt ? textSkillMap[effectOpt.NameIDSymbol] : undefined;
    const effectName = effectNameTexts?.en ?? '';

    const lookupKey = `${name}|${cls}`;
    const existingKey = existingByNameClass.get(lookupKey);

    return {
      id,
      name,
      class: cls,
      star: row.BasicStar,
      effectName,
      effectId: effectId ?? '',
      image: row.IconName ?? '',
      existsInJson: !!existingKey,
      existingKey,
    };
  });

  return NextResponse.json({
    total: entries.length,
    existing: entries.filter((e: { existsInJson: boolean }) => e.existsInJson).length,
    new: entries.filter((e: { existsInJson: boolean }) => !e.existsInJson).length,
    entries,
  });
}

async function handleCompare() {
  const [itemTemplet, textItem, specialOpt, textSkill, buffTemplet] = await Promise.all([
    readTemplet('ItemTemplet'),
    readTemplet('TextItem'),
    readTemplet('ItemSpecialOptionTemplet'),
    readTemplet('TextSkill'),
    readTemplet('BuffTemplet'),
  ]);

  const textItemMap = buildTextMap(textItem.data);
  const textSkillMap = buildTextMap(textSkill.data);

  const optMap: Record<string, Record<string, string>> = {};
  for (const o of specialOpt.data) optMap[o.GroupID] = o;

  // Load existing weapon.json
  let existing: Record<string, WeaponEntry> = {};
  try {
    existing = JSON.parse(await fs.readFile(WEAPON_PATH, 'utf-8'));
  } catch { /* doesn't exist */ }

  // Build extracted data for all weapons
  const weapons = itemTemplet.data.filter(
    (r: Record<string, string>) => r.ItemSubType === 'ITS_EQUIP_WEAPON' && r.ItemGrade === 'IG_UNIQUE'
  );

  // Build existing lookup by name+class
  const existingByNameClass = new Map<string, { key: string; entry: WeaponEntry }>();
  for (const [key, entry] of Object.entries(existing)) {
    const lookupKey = `${entry.name}|${entry.class ?? ''}`;
    existingByNameClass.set(lookupKey, { key, entry });
  }

  const results: { id: string; name: string; existingKey: string; diffs: { field: string; existing: string; extracted: string }[] }[] = [];
  let ok = 0;

  for (const row of weapons) {
    const id = row.ID;
    const nameTexts = textItemMap[row.DescIDSymbol];
    const name = nameTexts?.en ?? id;
    const cls = classFromIcon(row.IconName ?? '');

    const lookupKey = `${name}|${cls}`;
    const match = existingByNameClass.get(lookupKey);
    if (!match) continue; // skip weapons not in existing json

    const prev = match.entry;

    // Extract
    const [, effectId] = (row.SubOptionGroupID ?? '').split(',');
    const effectOpt = effectId ? optMap[effectId] : undefined;
    const effectNameTexts = effectOpt ? textSkillMap[effectOpt.NameIDSymbol] : undefined;
    const descSymbol = effectOpt?.CustomCraftDescIDSymbol ?? effectOpt?.DescID;
    const descTexts = descSymbol ? textSkillMap[descSymbol] : undefined;
    const buffIdStr = effectOpt?.BuffID ?? '';

    const extracted: WeaponEntry = {
      ...expandLang('name', nameTexts),
      type: 'weapon',
      rarity: rarityFromStar(row.BasicStar ?? '6'),
      image: row.IconName ?? '',
      ...expandLang('effect_name', effectNameTexts),
      class: cls,
      level: parseInt(row.BasicStar ?? '6'),
    };

    // Resolve effect descriptions at Level 1 and max level
    if (descTexts && buffIdStr) {
      const maxLevel = getMaxBuffLevel(buffTemplet.data, buffIdStr);
      for (const lang of LANGS) {
        const key1 = lang === 'en' ? 'effect_desc1' : `effect_desc1_${lang}`;
        const key4 = lang === 'en' ? 'effect_desc4' : `effect_desc4_${lang}`;
        const raw = descTexts[lang] ?? '';
        extracted[key1] = resolveWeaponPlaceholders(raw, buffTemplet.data, buffIdStr, 1);
        extracted[key4] = resolveWeaponPlaceholders(raw, buffTemplet.data, buffIdStr, maxLevel);
      }
    }

    if (effectOpt?.BuffLevel_4P) {
      extracted.effect_icon = effectOpt.BuffLevel_4P;
    }

    // Compare fields
    const COMPARE_FIELDS = [
      'name', 'name_jp', 'name_kr', 'name_zh',
      'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
      'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
      'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
      'effect_icon', 'class', 'image', 'rarity',
    ];

    const diffs: { field: string; existing: string; extracted: string }[] = [];
    for (const field of COMPARE_FIELDS) {
      const ext = String(extracted[field] ?? '');
      const cur = String(prev[field] ?? '');
      if (ext && cur && ext !== cur) {
        diffs.push({ field, existing: cur, extracted: ext });
      }
    }

    if (diffs.length > 0) {
      results.push({ id, name, existingKey: match.key, diffs });
    } else {
      ok++;
    }
  }

  return NextResponse.json({
    total: Object.keys(existing).length,
    withDiffs: results.length,
    ok,
    results,
  });
}

/**
 * POST /api/admin/extractor/weapon
 *
 * Body: { id, existingKey? } or { ids: [{ id, existingKey? }, ...] }
 */
export async function POST(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const items: { id: string; existingKey?: string }[] = body.items ?? (body.id ? [{ id: body.id, existingKey: body.existingKey }] : []);
    if (items.length === 0) return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 });

    const [itemTemplet, textItem, specialOpt, textSkill, buffTemplet] = await Promise.all([
      readTemplet('ItemTemplet'),
      readTemplet('TextItem'),
      readTemplet('ItemSpecialOptionTemplet'),
      readTemplet('TextSkill'),
      readTemplet('BuffTemplet'),
    ]);

    const textItemMap = buildTextMap(textItem.data);
    const textSkillMap = buildTextMap(textSkill.data);

    const optMap: Record<string, Record<string, string>> = {};
    for (const o of specialOpt.data) optMap[o.GroupID] = o;

    // Load existing weapon.json
    let existingRaw: string | undefined;
    let existing: Record<string, WeaponEntry> = {};
    try {
      existingRaw = await fs.readFile(WEAPON_PATH, 'utf-8');
      existing = JSON.parse(existingRaw);
    } catch { /* new file */ }

    // Build ItemTemplet lookup
    const itemById: Record<string, Record<string, string>> = {};
    for (const r of itemTemplet.data) itemById[r.ID] = r;

    // Build existing lookup by name+class for finding next key
    let maxKey = -1;
    for (const k of Object.keys(existing)) {
      const n = parseInt(k);
      if (!isNaN(n) && n > maxKey) maxKey = n;
    }

    let saved = 0;
    for (const { id, existingKey } of items) {
      const row = itemById[id];
      if (!row || row.ItemSubType !== 'ITS_EQUIP_WEAPON') continue;

      const nameTexts = textItemMap[row.DescIDSymbol];
      const cls = classFromIcon(row.IconName ?? '');
      const [, effectId] = (row.SubOptionGroupID ?? '').split(',');
      const effectOpt = effectId ? optMap[effectId] : undefined;
      const effectNameTexts = effectOpt ? textSkillMap[effectOpt.NameIDSymbol] : undefined;
      const descSymbol = effectOpt?.CustomCraftDescIDSymbol ?? effectOpt?.DescID;
      const descTexts = descSymbol ? textSkillMap[descSymbol] : undefined;
      const buffIdStr = effectOpt?.BuffID ?? '';

      const prev = existingKey ? (existing[existingKey] ?? {}) : {};

      const entry: WeaponEntry = {
        ...expandLang('name', nameTexts),
        type: 'weapon',
        rarity: rarityFromStar(row.BasicStar ?? '6'),
        image: row.IconName ?? '',
        ...expandLang('effect_name', effectNameTexts),
      };

      // Resolve effect descriptions
      if (descTexts && buffIdStr) {
        const maxLevel = getMaxBuffLevel(buffTemplet.data, buffIdStr);
        for (const lang of LANGS) {
          const key1 = lang === 'en' ? 'effect_desc1' : `effect_desc1_${lang}`;
          const key4 = lang === 'en' ? 'effect_desc4' : `effect_desc4_${lang}`;
          const raw = descTexts[lang] ?? '';
          entry[key1] = resolveWeaponPlaceholders(raw, buffTemplet.data, buffIdStr, 1);
          entry[key4] = resolveWeaponPlaceholders(raw, buffTemplet.data, buffIdStr, maxLevel);
        }
      }

      entry.effect_icon = effectOpt?.BuffLevel_4P ?? (prev as Record<string, unknown>).effect_icon ?? null;
      entry.class = cls;
      // Preserve manual fields
      entry.boss = (prev as Record<string, unknown>).boss ?? null;
      entry.level = parseInt(row.BasicStar ?? '6');
      entry.mainStats = (prev as Record<string, unknown>).mainStats ?? null;
      entry.source = (prev as Record<string, unknown>).source ?? null;

      const ordered = orderWeaponKeys(entry);

      // Determine key
      const key = existingKey ?? String(++maxKey);
      existing[key] = ordered;
      saved++;
    }

    // Write
    const eol = existingRaw ? detectEol(existingRaw) : '\n';
    let output = JSON.stringify(existing, null, 2) + '\n';
    if (eol === '\r\n') {
      output = output.replace(/\n/g, '\r\n');
    }

    await fs.writeFile(WEAPON_PATH, output, 'utf-8');

    return NextResponse.json({ ok: true, saved, total: Object.keys(existing).length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

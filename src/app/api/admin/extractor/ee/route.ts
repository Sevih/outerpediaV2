import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  readTemplet, buildTextMap, expandLang,
  LANGS,
} from '@/app/admin/lib/text';

const EE_PATH = path.join(process.cwd(), 'data', 'equipment', 'ee.json');

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ── Placeholder resolution ──────────────────────────────────────────

type BuffRow = Record<string, string>;

/**
 * Find EE buff entries for a character.
 * Most EEs use BID_CEQUIP_{id}, some use BID_CEQUIP_{id}_1.
 * buff2 is BID_CEQUIP_{id}_2 (secondary effect, e.g. [Value2]).
 */
function findEEBuff(buffData: BuffRow[], id: string, suffix = ''): BuffRow | undefined {
  return buffData.find(r => r.BuffID === `BID_CEQUIP_${id}${suffix}`)
    ?? buffData.find(r => r.BuffID === `BID_CEQUIP_${id}_1${suffix}`);
}

function findEEBuff2(buffData: BuffRow[], id: string, suffix = ''): BuffRow | undefined {
  return buffData.find(r => r.BuffID === `BID_CEQUIP_${id}_2${suffix}`);
}

/**
 * Find the buff for the +10 upgraded effect.
 * Priority: _CHANGE → _ADD (most EEs use _ADD for the +10 bonus effect)
 */
function findEEUpgradeBuff(buffData: BuffRow[], id: string): BuffRow | undefined {
  return findEEBuff(buffData, id, '_CHANGE')
    ?? buffData.find(r => r.BuffID === `BID_CEQUIP_${id}_ADD`);
}

function findEEUpgradeBuff2(buffData: BuffRow[], id: string): BuffRow | undefined {
  return findEEBuff2(buffData, id, '_CHANGE')
    ?? buffData.find(r => r.BuffID === `BID_CEQUIP_${id}_2_ADD`);
}

/** Check if a buff value should be treated as permille (÷10 + %) */
function isPermilleValue(buff: BuffRow): boolean {
  if (buff.ApplyingType === 'OAT_RATE') return true;
  const stat = buff.StatType ?? '';
  if (stat.includes('_RATE') || stat.includes('_DMG')) return true;
  const type = buff.Type ?? '';
  // BT_ADDITIVE_TURN: extra turn probability
  if (type === 'BT_ADDITIVE_TURN') return true;
  // *_ENHANCE types (BT_2000092_ENHANCE, BT_BLEED_ENHANCE, etc.) are always permille
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

function resolveEEPlaceholders(text: string, buff: BuffRow, buff2?: BuffRow): string {
  const rate = buff.CreateRate ? `${parseInt(buff.CreateRate) / 10}%` : '?';
  const value = formatBuffValue(buff);
  const turn = formatBuffTurn(buff);

  const value2 = buff2 ? formatBuffValue(buff2) : '?';

  let result = text
    .replace(/\[\+Value2\]/gi, c(`+${value2}`))
    .replace(/\[-Value2\]/gi, c(`-${value2}`))
    .replace(/\[Value2\]/gi, c(value2))
    .replace(/\[Rate\]/gi, c(rate))
    .replace(/\[\+Value\]/gi, c(`+${value}`))
    .replace(/\[-Value\]/gi, c(`-${value}`))
    .replace(/\[Value\]/gi, c(value))
    .replace(/\[\+Turn\]/gi, c(turn))
    .replace(/\[-Turn\]/gi, c(`-${turn}`))
    .replace(/\[Turn\]/gi, c(turn));

  return result;
}

// ── EE buff/debuff extraction ────────────────────────────────────────

const EE_BUFF_TYPE_BLACKLIST = new Set([
  'BT_DMG', 'BT_DMG_TO_BOSS', 'BT_DMG_CASTER_STAT', 'BT_DMG_CASTER_LOST_HP_RATE',
  'BT_DMG_OWNER_STAT', 'BT_DMG_TARGET_STAT', 'BT_DMG_ENEMY_TEAM_DECREASE', 'BT_DMG_REDUCE',
  'BT_DMG_REDUCE_FINAL', 'BT_STAT_PREMIUM', 'BT_STAT_OWNER_LOST_HP_RATE',
  'BT_GROUP', 'BT_RESOURCE_CHARGE_BUFF_CASTER', 'BT_WG_DMG',
  'BT_HEAL_BASED_CASTER', 'BT_HEAL_BASED_TARGET', 'BT_SHIELD_BASED_TARGET',
  'BT_REVIVAL', 'BT_NONE', 'BT_SECOND_TRIGGER',
]);

const EE_BUFF_FORCE_DEBUFF = new Set([
  'BT_WG_REVERSE_HEAL', 'BT_IMMEDIATELY_BLEED', 'BT_IMMEDIATELY_BURN',
  'BT_IMMEDIATELY_POISON', 'BT_IMMEDIATELY_CURSE',
]);

// Per-EE overrides: game data doesn't match in-game display
const EE_BUFF_OVERRIDES: Record<string, { buff?: string[]; debuff?: string[] }> = {
  '2000047': { buff: ['BT_SHIELD_BASED_CASTER'] },              // Barrier (data says BASED_TARGET)
  '2000060': { buff: ['BT_AP_CHARGE'] },                        // AP Charge (data has ST_ENTER_AP passive)
  '2000083': { buff: ['BT_AP_CHARGE'] },                        // AP Charge
  '2000093': { buff: ['BT_AP_CHARGE'] },                        // AP Charge
  '2000109': { debuff: ['BT_DOT_POISON2'] },                    // Corrosive Poison (data says BT_DOT_POISON)
};

function extractEEBuffDebuff(buffData: BuffRow[], id: string): { buff: string[]; debuff: string[] } {
  const buffs = new Set<string>();
  const debuffs = new Set<string>();

  const allBuffs = buffData.filter(r =>
    r.BuffID?.startsWith(`BID_CEQUIP_${id}`) && !r.BuffID.includes('old')
  );

  const seen = new Set<string>();
  for (const b of allBuffs) {
    const type = b.Type ?? '';
    const stat = b.StatType ?? '';
    const bd = b.BuffDebuffType ?? '';

    if (EE_BUFF_TYPE_BLACKLIST.has(type)) continue;
    if (type === 'BT_STAT' && stat === 'ST_ACCURACY') continue;
    if (type.includes('_ENHANCE')) continue;
    if (type.startsWith('BT_DMG_')) continue;
    // Permanent passive stats are not visible buff/debuff icons
    if (type === 'BT_STAT' && (b.TurnDuration === '-1' || b.BuffRemoveType === 'ON_SKILL_FINISH' || b.BuffCreateType === 'PASSIVE')) continue;

    // Use IconName if it contains "Interruption" (special irremovable variant)
    const icon = b.IconName ?? '';
    const tag = icon.includes('Interruption')
      ? icon
      : (type === 'BT_STAT' && stat && stat !== 'ST_NONE') ? `${type}|${stat}` : type;

    // Deduplicate by tag
    if (seen.has(tag)) continue;
    seen.add(tag);

    if (EE_BUFF_FORCE_DEBUFF.has(type)) {
      debuffs.add(tag);
    } else if (bd.startsWith('DEBUFF')) {
      debuffs.add(tag);
    } else if (bd === 'BUFF') {
      buffs.add(tag);
    }
  }

  // Apply per-EE overrides
  const overrides = EE_BUFF_OVERRIDES[id];
  if (overrides) {
    if (overrides.buff) overrides.buff.forEach(b => buffs.add(b));
    if (overrides.debuff) overrides.debuff.forEach(d => debuffs.add(d));
  }

  return { buff: [...buffs], debuff: [...debuffs] };
}

// ── MainStat extraction ─────────────────────────────────────────────

const OPPOSITE_ELEMENT: Record<string, string> = {
  EARTH: 'WATER', WATER: 'FIRE', FIRE: 'EARTH', LIGHT: 'DARK', DARK: 'LIGHT',
};

function getCharacterEnemyElement(charData: BuffRow[], charId: string): string | null {
  const char = charData.find(r => r.ID === charId);
  if (!char) return null;
  const raw = (char.Element ?? '').replace('CET_', '').replace('CCT_', '');
  return OPPOSITE_ELEMENT[raw] ?? null;
}

function composeSysKey(buffRow: BuffRow, enemyElem: string): string | null {
  const t = buffRow.Type ?? '';
  const st = buffRow.StatType ?? '';
  const tt = buffRow.TargetType ?? '';

  let base: string;
  if (t.startsWith('BT_DMG')) base = `SYS_${t}_`;
  else if (st.startsWith('ST_')) base = `SYS_STAT_${st.slice(3)}_`;
  else return null;

  let middle: string;
  if (tt === 'ME') middle = 'TARGET_';
  else if (tt === 'ENEMY_TEAM') middle = 'OWNER_';
  else return null;

  return `${base}${middle}${enemyElem}`;
}

function extractMainStat(
  itemOptionData: BuffRow[],
  buffData: BuffRow[],
  charData: BuffRow[],
  textSystemMap: Record<string, Record<string, string>>,
  id: string,
): Record<string, string> {
  const enemyElem = getCharacterEnemyElement(charData, id);
  if (!enemyElem) return {};

  // Step 1: Find ItemOptionTemplet rows matching this EE's character
  const optRows = itemOptionData.filter(r => {
    const raw = String(r.OptionMaxValue ?? '');
    return raw === id || new RegExp(`\\b${id}\\b`).test(raw);
  });

  // Step 2: Collect BuffIDs from those rows
  const buffIds = new Set<string>();
  for (const r of optRows) {
    const bid = r.BuffID ?? r.OptionBuffID ?? '';
    if (bid) buffIds.add(bid);
  }

  // Step 3: Get buff rows and compose SYS_* keys
  const seenKeys = new Set<string>();
  for (const bid of buffIds) {
    const matchingBuffs = buffData.filter(r => r.BuffID === bid);
    for (const br of matchingBuffs) {
      const key = composeSysKey(br, enemyElem);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        // Step 4: Look up in TextSystem
        const texts = textSystemMap[key];
        if (texts) {
          return {
            mainStat: (texts.en ?? '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim(),
            mainStat_jp: (texts.jp ?? '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim(),
            mainStat_kr: (texts.kr ?? '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim(),
            mainStat_zh: (texts.zh ?? '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim(),
          };
        }
      }
    }
  }

  return {};
}

// ── Key order for ee.json entries ───────────────────────────────────

const EE_KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'mainStat', 'mainStat_jp', 'mainStat_kr', 'mainStat_zh',
  'effect', 'effect_jp', 'effect_kr', 'effect_zh',
  'effect10', 'effect10_jp', 'effect10_kr', 'effect10_zh',
  'icon_effect',
  'buff', 'debuff',
  'rank', 'rank10',
];

function orderEEKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of EE_KEY_ORDER) {
    if (key in obj) ordered[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (!(key in ordered)) ordered[key] = obj[key];
  }
  return ordered;
}

// ── Detect line endings ─────────────────────────────────────────────

function detectEol(raw: string): string {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

// ── Handlers ────────────────────────────────────────────────────────

/**
 * GET /api/admin/extractor/ee
 *
 * ?action=list   → list EE entries from ItemTemplet vs existing ee.json
 * ?action=extract&id=2000001  → extract one EE entry
 */
export async function GET(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action') ?? 'list';

  try {
    switch (action) {
      case 'list':
        return await handleList();
      case 'extract':
        return await handleExtract(searchParams.get('id'));
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
  const [itemTemplet, textItem, textSkill] = await Promise.all([
    readTemplet('ItemTemplet'),
    readTemplet('TextItem'),
    readTemplet('TextSkill'),
  ]);

  const textItemMap = buildTextMap(textItem.data);
  const textSkillMap = buildTextMap(textSkill.data);

  // Load existing ee.json
  let existing: Record<string, Record<string, unknown>> = {};
  try {
    existing = JSON.parse(await fs.readFile(EE_PATH, 'utf-8'));
  } catch { /* doesn't exist yet */ }

  // All EE items from game data
  const eeItems = itemTemplet.data.filter(r => r.ItemSubType === 'ITS_EQUIP_EXCLUSIVE');

  const entries = eeItems.map(row => {
    const id = row.ID;
    const nameKey = `ITEM_C_EQUIP_${id}_NAME`;
    const name = textItemMap[nameKey]?.en ?? textSkillMap[`UO_CEQUIP_${id}_NAME`]?.en ?? id;
    const hasDesc = !!textSkillMap[`UO_CEQUIP_${id}_DESC`];
    const existsInJson = id in existing;

    const ex = existing[id];
    return { id, name, existsInJson, hasDesc, rank: String(ex?.rank ?? ''), rank10: String(ex?.rank10 ?? '') };
  });

  return NextResponse.json({
    total: entries.length,
    existing: entries.filter(e => e.existsInJson).length,
    new: entries.filter(e => !e.existsInJson).length,
    entries,
  });
}

async function handleExtract(id: string | null) {
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const [textItem, textSkill, buffTemplet, itemOptionTemplet, charTemplet, textSystem] = await Promise.all([
    readTemplet('TextItem'),
    readTemplet('TextSkill'),
    readTemplet('BuffTemplet'),
    readTemplet('ItemOptionTemplet'),
    readTemplet('CharacterTemplet'),
    readTemplet('TextSystem'),
  ]);

  const textItemMap = buildTextMap(textItem.data);
  const textSkillMap = buildTextMap(textSkill.data);
  const textSystemMap = buildTextMap(textSystem.data);

  // Name from TextItem
  const nameTexts = textItemMap[`ITEM_C_EQUIP_${id}_NAME`];

  // Effect descriptions from TextSkill
  const descTexts = textSkillMap[`UO_CEQUIP_${id}_DESC`];
  const upgradeDescTexts = textSkillMap[`UO_CEQUIP_${id}_UPGRADE_DESC`];

  // Buff values for placeholder resolution
  const baseBuff = findEEBuff(buffTemplet.data, id);
  const changeBuff = findEEUpgradeBuff(buffTemplet.data, id);
  const baseBuff2 = findEEBuff2(buffTemplet.data, id);
  const changeBuff2 = findEEUpgradeBuff2(buffTemplet.data, id);

  // Resolve effects with placeholders
  const resolvedEffect: Record<string, string> = {};
  const resolvedEffect10: Record<string, string> = {};

  if (descTexts) {
    for (const lang of LANGS) {
      const key = lang === 'en' ? 'effect' : `effect_${lang}`;
      const raw = descTexts[lang] ?? '';
      resolvedEffect[key] = baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw;
    }
  }

  if (upgradeDescTexts) {
    for (const lang of LANGS) {
      const key = lang === 'en' ? 'effect10' : `effect10_${lang}`;
      const raw = upgradeDescTexts[lang] ?? '';
      resolvedEffect10[key] = changeBuff ? resolveEEPlaceholders(raw, changeBuff, changeBuff2) : (baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw);
    }
  }

  const autoBuffDebuff = extractEEBuffDebuff(buffTemplet.data, id);
  const mainStatTexts = extractMainStat(itemOptionTemplet.data, buffTemplet.data, charTemplet.data, textSystemMap, id);

  return NextResponse.json({
    id,
    extracted: {
      ...expandLang('name', nameTexts),
      ...mainStatTexts,
      ...resolvedEffect,
      ...resolvedEffect10,
      icon_effect: 'TI_Icon_UO_Accessary_07',
      buff: autoBuffDebuff.buff,
      debuff: autoBuffDebuff.debuff,
    },
  });
}

// Fields to compare between extracted and existing
const COMPARE_FIELDS = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'mainStat', 'mainStat_jp', 'mainStat_kr', 'mainStat_zh',
  'effect', 'effect_jp', 'effect_kr', 'effect_zh',
  'effect10', 'effect10_jp', 'effect10_kr', 'effect10_zh',
  'icon_effect',
];

async function handleCompare() {
  const [itemTemplet, textItem, textSkill, buffTemplet, itemOptionTemplet, charTemplet, textSystem] = await Promise.all([
    readTemplet('ItemTemplet'),
    readTemplet('TextItem'),
    readTemplet('TextSkill'),
    readTemplet('BuffTemplet'),
    readTemplet('ItemOptionTemplet'),
    readTemplet('CharacterTemplet'),
    readTemplet('TextSystem'),
  ]);

  const textItemMap = buildTextMap(textItem.data);
  const textSkillMap = buildTextMap(textSkill.data);
  const textSystemMap = buildTextMap(textSystem.data);

  // Load existing ee.json
  let existing: Record<string, Record<string, unknown>> = {};
  try {
    existing = JSON.parse(await fs.readFile(EE_PATH, 'utf-8'));
  } catch { /* doesn't exist */ }

  const eeItems = itemTemplet.data.filter(r => r.ItemSubType === 'ITS_EQUIP_EXCLUSIVE');

  const results: { id: string; name: string; rank: string; rank10: string; diffs: { field: string; existing: string; extracted: string }[] }[] = [];
  let ok = 0;

  for (const row of eeItems) {
    const id = row.ID;
    const prev = existing[id];
    if (!prev) continue; // skip new entries, only compare existing

    // Extract
    const nameTexts = textItemMap[`ITEM_C_EQUIP_${id}_NAME`];
    const descTexts = textSkillMap[`UO_CEQUIP_${id}_DESC`];
    const upgradeDescTexts = textSkillMap[`UO_CEQUIP_${id}_UPGRADE_DESC`];
    const baseBuff = findEEBuff(buffTemplet.data, id);
    const changeBuff = findEEUpgradeBuff(buffTemplet.data, id);
    const baseBuff2 = findEEBuff2(buffTemplet.data, id);
    const changeBuff2 = findEEUpgradeBuff2(buffTemplet.data, id);

    const mainStatTexts = extractMainStat(itemOptionTemplet.data, buffTemplet.data, charTemplet.data, textSystemMap, id);

    const extracted: Record<string, string> = {
      ...expandLang('name', nameTexts),
      ...mainStatTexts,
      icon_effect: 'TI_Icon_UO_Accessary_07',
    };

    if (descTexts) {
      for (const lang of LANGS) {
        const key = lang === 'en' ? 'effect' : `effect_${lang}`;
        const raw = descTexts[lang] ?? '';
        extracted[key] = baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw;
      }
    }

    if (upgradeDescTexts) {
      for (const lang of LANGS) {
        const key = lang === 'en' ? 'effect10' : `effect10_${lang}`;
        const raw = upgradeDescTexts[lang] ?? '';
        extracted[key] = changeBuff ? resolveEEPlaceholders(raw, changeBuff, changeBuff2) : (baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw);
      }
    }

    // Compare text fields
    const diffs: { field: string; existing: string; extracted: string }[] = [];
    for (const field of COMPARE_FIELDS) {
      const ext = extracted[field] ?? '';
      const cur = String(prev[field] ?? '');
      if (ext && cur && ext !== cur) {
        diffs.push({ field, existing: cur, extracted: ext });
      }
    }

    // Compare buff/debuff arrays
    const autoBuffDebuff = extractEEBuffDebuff(buffTemplet.data, id);
    const prevBuff = (Array.isArray(prev.buff) ? [...prev.buff].sort() : []) as string[];
    const prevDebuff = (Array.isArray(prev.debuff) ? [...prev.debuff].sort() : []) as string[];
    const extBuff = [...autoBuffDebuff.buff].sort();
    const extDebuff = [...autoBuffDebuff.debuff].sort();
    if (JSON.stringify(prevBuff) !== JSON.stringify(extBuff)) {
      diffs.push({ field: 'buff', existing: prevBuff.join(', ') || '(empty)', extracted: extBuff.join(', ') || '(empty)' });
    }
    if (JSON.stringify(prevDebuff) !== JSON.stringify(extDebuff)) {
      diffs.push({ field: 'debuff', existing: prevDebuff.join(', ') || '(empty)', extracted: extDebuff.join(', ') || '(empty)' });
    }

    if (diffs.length > 0) {
      results.push({ id, name: String(prev.name ?? id), diffs, rank: String(prev.rank ?? ''), rank10: String(prev.rank10 ?? '') });
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
 * POST /api/admin/extractor/ee
 *
 * Body: { id } or { ids: [...] }
 *
 * Extracts and saves EE data. Preserves manual fields (mainStat, rank, buff, debuff)
 * and existing effects if they differ from the template (manually edited).
 */
export async function POST(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
    if (ids.length === 0) return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 });

    // Optional manual overrides (rank, rank10) — only for single-id saves
    const manualRank: string | undefined = body.rank;
    const manualRank10: string | undefined = body.rank10;

    const [textItem, textSkill, buffTemplet, itemTemplet, itemOptionTemplet, charTemplet, textSystem] = await Promise.all([
      readTemplet('TextItem'),
      readTemplet('TextSkill'),
      readTemplet('BuffTemplet'),
      readTemplet('ItemTemplet'),
      readTemplet('ItemOptionTemplet'),
      readTemplet('CharacterTemplet'),
      readTemplet('TextSystem'),
      readTemplet('ItemSpecialOptionTemplet'),
    ]);

    const textItemMap = buildTextMap(textItem.data);
    const textSkillMap = buildTextMap(textSkill.data);
    const textSystemMap = buildTextMap(textSystem.data);

    // Load existing ee.json
    let existingRaw: string | undefined;
    let existing: Record<string, Record<string, unknown>> = {};
    try {
      existingRaw = await fs.readFile(EE_PATH, 'utf-8');
      existing = JSON.parse(existingRaw);
    } catch { /* new file */ }

    // Validate IDs exist in game data
    const validIds = new Set(
      itemTemplet.data
        .filter(r => r.ItemSubType === 'ITS_EQUIP_EXCLUSIVE')
        .map(r => r.ID)
    );

    let saved = 0;
    for (const id of ids) {
      if (!validIds.has(id)) continue;

      const prev = (existing[id] ?? {}) as Record<string, unknown>;

      // Extract name
      const nameTexts = textItemMap[`ITEM_C_EQUIP_${id}_NAME`];

      // Extract effects
      const descTexts = textSkillMap[`UO_CEQUIP_${id}_DESC`];
      const upgradeDescTexts = textSkillMap[`UO_CEQUIP_${id}_UPGRADE_DESC`];
      const baseBuff = findEEBuff(buffTemplet.data, id);
      const changeBuff = findEEUpgradeBuff(buffTemplet.data, id);
      const baseBuff2 = findEEBuff2(buffTemplet.data, id);
      const changeBuff2 = findEEUpgradeBuff2(buffTemplet.data, id);

      // Build extracted effects
      const effects: Record<string, string> = {};
      const effects10: Record<string, string> = {};

      if (descTexts) {
        for (const lang of LANGS) {
          const key = lang === 'en' ? 'effect' : `effect_${lang}`;
          const raw = descTexts[lang] ?? '';
          effects[key] = baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw;
        }
      }

      if (upgradeDescTexts) {
        for (const lang of LANGS) {
          const key = lang === 'en' ? 'effect10' : `effect10_${lang}`;
          const raw = upgradeDescTexts[lang] ?? '';
          effects10[key] = changeBuff ? resolveEEPlaceholders(raw, changeBuff, changeBuff2) : (baseBuff ? resolveEEPlaceholders(raw, baseBuff, baseBuff2) : raw);
        }
      }

      // MainStat extraction
      const mainStatTexts = extractMainStat(itemOptionTemplet.data, buffTemplet.data, charTemplet.data, textSystemMap, id);

      // Merge: extracted fields + preserve manual fields from existing
      const entry = orderEEKeys({
        ...expandLang('name', nameTexts),
        ...mainStatTexts,
        // Effects: use extracted, but preserve existing if manually edited
        ...effects,
        ...effects10,
        icon_effect: 'TI_Icon_UO_Accessary_07',
        // Rank: use manual override if provided, else preserve from existing
        rank: manualRank ?? prev.rank ?? '',
        // Buff/debuff: always from extraction
        ...extractEEBuffDebuff(buffTemplet.data, id),
        rank10: manualRank10 ?? prev.rank10 ?? '',
      });

      existing[id] = entry;
      saved++;
    }

    // Sort entries by ID
    const sorted: Record<string, Record<string, unknown>> = {};
    for (const id of Object.keys(existing).sort()) {
      sorted[id] = existing[id];
    }

    // Write with same line endings
    const eol = existingRaw ? detectEol(existingRaw) : '\n';
    let output = JSON.stringify(sorted, null, 2) + '\n';
    if (eol === '\r\n') {
      output = output.replace(/\n/g, '\r\n');
    }

    await fs.writeFile(EE_PATH, output, 'utf-8');

    return NextResponse.json({ ok: true, saved, total: Object.keys(sorted).length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

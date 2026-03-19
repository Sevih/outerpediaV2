import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  readTemplet, buildTextMap, expandLang,
  LANGS, type LangTexts,
  resolveEnum, resolveClass,
} from '@/app/admin/lib/text';

const WEAPON_PATH = path.join(process.cwd(), 'data', 'equipment', 'weapon.json');

const IMG_SRC_DIR = path.join(process.cwd(), 'datamine', 'extracted_astudio', 'assets', 'editor', 'resources', 'sprite', 'at_thumbnailitemruntime');
const WEAPON_IMG_DST_DIR = path.join(process.cwd(), 'public', 'images', 'equipment');
const EFFECT_IMG_DST_DIR = path.join(process.cwd(), 'public', 'images', 'ui', 'effect');

function pngPath(dir: string, name: string): string {
  // Build path at runtime to avoid Turbopack static analysis matching broad file patterns
  return [dir, name].join(path.sep) + '.png';
}

async function copyIfMissing(srcDir: string, srcName: string, dstDir: string, dstName: string): Promise<boolean> {
  const dst = pngPath(dstDir, dstName);
  try {
    await fs.access(dst);
    return false;
  } catch {
    const src = pngPath(srcDir, srcName);
    try {
      await fs.access(src);
      await fs.mkdir(dstDir, { recursive: true });
      await fs.copyFile(src, dst);
      return true;
    } catch { return false; }
  }
}

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ── Types ──────────────────────────────────────────────────────────

type BuffRow = Record<string, string>;
type WeaponJson = Record<string, Record<string, unknown>>;

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

function findBuffByLevel(buffData: BuffRow[], buffIdStr: string, level: number, index = 0): BuffRow | undefined {
  const ids = buffIdStr.split(',').map(s => s.trim());
  // Index 0 = primary buff, 1 = second buff in comma list OR _2 suffix, etc.
  let targetId: string | undefined;
  if (index === 0) {
    targetId = ids[0];
  } else {
    // Try the Nth entry in the comma list first, then try _N suffix on the primary ID
    targetId = ids[index] ?? `${ids[0]}_${index + 1}`;
  }
  return buffData.find(r => r.BuffID === targetId && String(r.Level) === String(level));
}

function resolveWeaponPlaceholders(text: string, buffData: BuffRow[], buffIdStr: string, level: number): string {
  const buff = findBuffByLevel(buffData, buffIdStr, level, 0);
  const buff2 = findBuffByLevel(buffData, buffIdStr, level, 1);
  const buff4 = findBuffByLevel(buffData, buffIdStr, level, 3);
  const buff5 = findBuffByLevel(buffData, buffIdStr, level, 4);

  const rate = buff?.CreateRate ? `${parseInt(buff.CreateRate) / 10}%` : '?';
  const value = buff ? formatBuffValue(buff) : '?';
  const turn = buff ? formatBuffTurn(buff) : '?';
  const value2 = buff2 ? formatBuffValue(buff2) : '?';
  const turn2 = buff2 ? formatBuffTurn(buff2) : '?';
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
    .replace(/\[Rate\]/g, c(rate))
    .replace(/\[\+Value\]/gi, c(`+${value}`))
    .replace(/\[-Value\]/gi, c(`-${value}`))
    .replace(/\[Value\]/gi, c(value))
    .replace(/\[\+Turn\]/gi, c(turn))
    .replace(/\[-Turn\]/gi, c(`-${turn}`))
    .replace(/\[Turn2\]/gi, c(turn2))
    .replace(/\[Turn\]/gi, c(turn));
}

// ── Helpers ────────────────────────────────────────────────────────

function classFromRow(row: Record<string, string>, textSystemMap: Record<string, LangTexts>): string | null {
  const raw = row.TrustLevelLimit ?? '';
  if (!raw || raw === 'CCT_NONE') return null;
  return resolveClass(textSystemMap, raw) || null;
}

function getMaxBuffLevel(buffData: BuffRow[], buffIdStr: string): number {
  const primaryId = buffIdStr.split(',')[0].trim();
  const levels = buffData
    .filter(r => r.BuffID === primaryId)
    .map(r => parseInt(r.Level) || 1);
  return levels.length > 0 ? Math.max(...levels) : 1;
}

// ── Key order for weapon.json entries ──────────────────────────────

const WEAPON_KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'type', 'rarity', 'image',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon',
  'class',
  'source',
  'boss',
  'level',
];

function orderWeaponKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of WEAPON_KEY_ORDER) {
    if (key in obj) ordered[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (!(key in ordered)) ordered[key] = obj[key];
  }
  return ordered;
}

function detectEol(raw: string): string {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

// ── Shared extraction logic ────────────────────────────────────────

interface ExtractedWeapon {
  id: string;
  extracted: Record<string, unknown>;
}

function buildWeaponBossMap(
  dungeonData: Record<string, string>[],
  rewardData: Record<string, string>[],
  rewardGroupData: Record<string, string>[],
  spawnData: Record<string, string>[],
  textSystemMap: Record<string, LangTexts>,
): Map<string, string | string[]> {
  // SpawnID → boss monster ID via DungeonSpawnTemplet (HPLineCount → ID3)
  // SpawnID → boss monster ID: prefer ID0 (main boss), fallback to ID3
  const spawnToBoss: Record<string, string> = {};
  for (const s of spawnData) {
    if (s.HPLineCount) {
      spawnToBoss[s.HPLineCount] = s.ID0 || s.ID3;
    }
  }

  // RewardTemplet ID → RandomGroupIDs
  const rewardToGroups: Record<string, string[]> = {};
  for (const r of rewardData) {
    if (r.RandomGroupID) {
      rewardToGroups[r.ID] = r.RandomGroupID.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Find Stage 13 DM_RAID_2 dungeons
  const weaponToBoss = new Map<string, string | string[]>();
  for (const d of dungeonData) {
    if (d.DungeonMode !== 'DM_RAID_2') continue;
    const name = textSystemMap[d.SeasonFullName]?.en ?? '';
    if (!name.includes('Stage 13')) continue;

    const spawnId = d.SpawnID_Pos0 || d.SpawnID_Pos1 || d.SpawnID_Pos2;
    const bossId = spawnId ? spawnToBoss[spawnId] : undefined;
    if (!bossId) continue;

    const groups = rewardToGroups[d.RewardID] ?? [];
    for (const gid of groups) {
      for (const r of rewardGroupData) {
        if (r.GroupID === gid && r.Type === 'RIT_ITEM') {
          weaponToBoss.set(r.TypeID, bossId);
        }
      }
    }
  }

  // Irregular weapons: hardcoded boss mapping (not in game data)
  const IRREGULAR_BOSS_MAP: Record<string, string[]> = {
    '7003001': ['51202001', '51202002'], // Briareos's Recklessness
    '7003002': ['51202003', '51202004'], // Gorgon's Wrath
  };

  for (const [groupId, bossIds] of Object.entries(IRREGULAR_BOSS_MAP)) {
    const weapons = rewardGroupData.filter(r => r.GroupID === groupId && r.Type === 'RIT_ITEM');
    for (const w of weapons) {
      weaponToBoss.set(w.TypeID, bossIds);
    }
  }

  return weaponToBoss;
}

function extractWeaponsFromGameData(
  itemTemplet: { data: Record<string, string>[] },
  textItemMap: Record<string, LangTexts>,
  textSkillMap: Record<string, LangTexts>,
  textSystemMap: Record<string, LangTexts>,
  optById: Record<string, Record<string, string>>,
  buffData: BuffRow[],
  weaponBossMap: Map<string, string | string[]>,
  eventWeaponIds: Set<string>,
  adventureLicenseWeaponIds: Set<string>,
) {
  const allWeapons = itemTemplet.data.filter(
    r => r.ItemSubType === 'ITS_EQUIP_WEAPON' && (r.ItemGrade === 'IG_UNIQUE' || r.ItemGrade === 'IG_RARE') && parseInt(r.BasicStar ?? '0') >= 5
  );

  // Dedup step 1: keep highest star per name+class
  const bestByNameClass = new Map<string, Record<string, string>>();
  for (const row of allWeapons) {
    const name = textItemMap[row.DescIDSymbol]?.en ?? row.ID;
    const cls = classFromRow(row, textSystemMap);
    const key = `${name}|${cls}`;
    const existing = bestByNameClass.get(key);
    if (!existing || parseInt(row.BasicStar ?? '0') > parseInt(existing.BasicStar ?? '0')) {
      bestByNameClass.set(key, row);
    }
  }

  // Dedup step 2: keep highest star per effect_name+class+name
  const bestByEffectClassName = new Map<string, Record<string, string>>();
  for (const row of bestByNameClass.values()) {
    const name = textItemMap[row.DescIDSymbol]?.en ?? row.ID;
    const cls = classFromRow(row, textSystemMap);
    // Find effect name via MainOptionGroupID
    const mainOptIds = (row.MainOptionGroupID ?? '').split(',').map(s => s.trim()).filter(Boolean);
    let effectName = '';
    for (const mid of mainOptIds) {
      const opt = optById[mid];
      if (opt) {
        const ns = opt.NameIDSymbol ?? '';
        if (ns.startsWith('UO_WEAPON_') || ns.startsWith('UO_EVENT_')) {
          effectName = textSkillMap[ns]?.en ?? '';
          break;
        }
      }
    }
    const key = `${effectName}|${cls}|${name}`;
    const existing = bestByEffectClassName.get(key);
    if (!existing || parseInt(row.BasicStar ?? '0') > parseInt(existing.BasicStar ?? '0')) {
      bestByEffectClassName.set(key, row);
    }
  }

  const results: ExtractedWeapon[] = [];

  for (const row of bestByEffectClassName.values()) {
    const id = row.ID;
    const nameTexts = textItemMap[row.DescIDSymbol];
    const cls = classFromRow(row, textSystemMap);
    const star = parseInt(row.BasicStar ?? '1');

    // Find weapon effect via MainOptionGroupID
    const mainOptIds = (row.MainOptionGroupID ?? '').split(',').map(s => s.trim()).filter(Boolean);
    let effectOpt: Record<string, string> | undefined;
    for (const mid of mainOptIds) {
      const opt = optById[mid];
      if (opt) {
        const ns = opt.NameIDSymbol ?? '';
        if (ns.startsWith('UO_WEAPON_') || ns.startsWith('UO_EVENT_')) {
          effectOpt = opt;
          break;
        }
      }
    }

    const effectNameTexts = effectOpt ? textSkillMap[effectOpt.NameIDSymbol] : undefined;
    // DescID is the full description; CustomCraftDescIDSymbol is often a short/simple version that may not exist
    const descSymbol = effectOpt?.DescID ?? effectOpt?.CustomCraftDescIDSymbol;
    const descTexts = descSymbol ? textSkillMap[descSymbol] : undefined;
    const buffIdStr = effectOpt?.BuffID ?? '';
    const maxLevel = buffIdStr ? getMaxBuffLevel(buffData, buffIdStr) : 1;

    const extracted: Record<string, unknown> = {
      ...expandLang('name', nameTexts),
      type: 'weapon',
      rarity: resolveEnum(textSystemMap, row.ItemGrade ?? '', 'IG_', 'SYS_ITEM_GRADE_').toLowerCase(),
      image: row.IconName ?? '',
      ...expandLang('effect_name', effectNameTexts, null as unknown as string),
      effect_icon: effectOpt?.BuffLevel_4P ?? null,
      class: cls,
      level: star,
    };

    // IG_RARE (epic) weapons have no boss/source
    if (row.ItemGrade === 'IG_UNIQUE') {
      const boss = weaponBossMap.get(id) ?? null;
      if (boss) {
        extracted.boss = boss;
      } else {
        const source = eventWeaponIds.has(id) ? 'Event Shop' : adventureLicenseWeaponIds.has(id) ? 'Adventure License' : null;
        if (source) {
          extracted.source = source;
          extracted.boss = null;
        }
      }
    }

    for (const lang of LANGS) {
      const key1 = lang === 'en' ? 'effect_desc1' : `effect_desc1_${lang}`;
      const key4 = lang === 'en' ? 'effect_desc4' : `effect_desc4_${lang}`;
      if (descTexts && buffIdStr) {
        const raw = descTexts[lang] ?? '';
        extracted[key1] = resolveWeaponPlaceholders(raw, buffData, buffIdStr, 1);
        extracted[key4] = resolveWeaponPlaceholders(raw, buffData, buffIdStr, maxLevel);
      } else {
        extracted[key1] = null;
        extracted[key4] = null;
      }
    }

    results.push({ id, extracted });
  }

  results.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  return results;
}

// ── Load game data ─────────────────────────────────────────────────

async function loadGameData() {
  const [itemTemplet, textItem, specialOpt, textSkill, buffTemplet, textSystem, dungeonTemplet, rewardTemplet, rewardGroupTemplet, dungeonSpawnTemplet, itemCraftReward, productTemplet] = await Promise.all([
    readTemplet('ItemTemplet'),
    readTemplet('TextItem'),
    readTemplet('ItemSpecialOptionTemplet'),
    readTemplet('TextSkill'),
    readTemplet('BuffTemplet'),
    readTemplet('TextSystem'),
    readTemplet('DungeonTemplet'),
    readTemplet('RewardTemplet'),
    readTemplet('RewardGroupTemplet'),
    readTemplet('DungeonSpawnTemplet'),
    readTemplet('ItemCraftRewardTemplet'),
    readTemplet('ProductTemplet'),
  ]);

  const textItemMap = buildTextMap(textItem.data);
  const textSkillMap = buildTextMap(textSkill.data);
  const textSystemMap = buildTextMap(textSystem.data);
  const optById: Record<string, Record<string, string>> = {};
  for (const o of specialOpt.data) optById[o.ID] = o;

  const weaponBossMap = buildWeaponBossMap(
    dungeonTemplet.data, rewardTemplet.data, rewardGroupTemplet.data, dungeonSpawnTemplet.data, textSystemMap,
  );

  // Detect event weapons: ItemCraftRewardTemplet links weapon → GroupID → ProductTemplet with PC_EVENT_*
  const productById: Record<string, Record<string, string>> = {};
  for (const p of productTemplet.data) productById[p.ID] = p;

  const eventWeaponIds = new Set<string>();
  const adventureLicenseWeaponIds = new Set<string>();
  // Via ItemCraftRewardTemplet (craft → product)
  for (const craft of itemCraftReward.data) {
    const prod = productById[craft.GroupID];
    if (prod?.ProductCategory?.startsWith('PC_EVENT')) {
      eventWeaponIds.add(craft.ID);
    }
    if (prod?.ProductLevel === 'PC_ADVENTURE_LICENSE') {
      adventureLicenseWeaponIds.add(craft.ID);
    }
  }
  // Via ProductTemplet direct (ProductGoodsID = weapon ID)
  for (const prod of productTemplet.data) {
    if (prod.ProductGoodsType !== 'PGT_ITEM') continue;
    const wid = prod.ProductGoodsID;
    if (prod.ProductCategory?.startsWith('PC_EVENT')) {
      eventWeaponIds.add(wid);
    }
    if (prod.ProductLevel === 'PC_ADVENTURE_LICENSE') {
      adventureLicenseWeaponIds.add(wid);
    }
  }

  return { itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData: buffTemplet.data, weaponBossMap, eventWeaponIds, adventureLicenseWeaponIds };
}

async function loadExisting(): Promise<{ raw?: string; data: WeaponJson }> {
  try {
    const raw = await fs.readFile(WEAPON_PATH, 'utf-8');
    return { raw, data: JSON.parse(raw) };
  } catch {
    return { data: {} };
  }
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
  const { itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData, weaponBossMap, eventWeaponIds, adventureLicenseWeaponIds } = await loadGameData();
  const { data: existing } = await loadExisting();
  const weapons = extractWeaponsFromGameData(itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData, weaponBossMap, eventWeaponIds, adventureLicenseWeaponIds);

  // Build existing lookup by name+class
  const existingByNameClass = new Map<string, string>();
  for (const [key, entry] of Object.entries(existing)) {
    existingByNameClass.set(`${entry.name}|${entry.class ?? ''}`, key);
  }

  const entries = weapons.map(w => {
    const name = String(w.extracted.name ?? '');
    const cls = String(w.extracted.class ?? '');
    const existingKey = existingByNameClass.get(`${name}|${cls}`);
    return {
      ...w.extracted,
      id: w.id,
      existsInJson: !!existingKey,
      existingKey,
    };
  });

  return NextResponse.json({
    total: entries.length,
    existing: entries.filter(e => e.existsInJson).length,
    new: entries.filter(e => !e.existsInJson).length,
    entries,
  });
}

const COMPARE_FIELDS = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon', 'class', 'image', 'rarity', 'source',
];

async function handleCompare() {
  const { itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData, weaponBossMap, eventWeaponIds, adventureLicenseWeaponIds } = await loadGameData();
  const { data: existing } = await loadExisting();
  const weapons = extractWeaponsFromGameData(itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData, weaponBossMap, eventWeaponIds, adventureLicenseWeaponIds);

  // Build existing lookup by name+class
  const existingByNameClass = new Map<string, { key: string; entry: Record<string, unknown> }>();
  for (const [key, entry] of Object.entries(existing)) {
    existingByNameClass.set(`${entry.name}|${entry.class ?? ''}`, { key, entry });
  }

  const results: { id: string; name: string; existingKey: string; diffs: { field: string; existing: string; extracted: string }[] }[] = [];
  let ok = 0;

  for (const w of weapons) {
    const name = String(w.extracted.name ?? '');
    const cls = String(w.extracted.class ?? '');
    const match = existingByNameClass.get(`${name}|${cls}`);
    if (!match) continue;

    const prev = match.entry;
    const diffs: { field: string; existing: string; extracted: string }[] = [];

    for (const field of COMPARE_FIELDS) {
      const ext = String(w.extracted[field] ?? '');
      const cur = String(prev[field] ?? '');
      if (ext && cur && ext !== cur) {
        diffs.push({ field, existing: cur, extracted: ext });
      }
    }

    // Compare boss (can be string, array, or null)
    const extBoss = JSON.stringify(w.extracted.boss ?? null);
    const curBoss = JSON.stringify(prev.boss ?? null);
    if (extBoss !== curBoss) {
      diffs.push({ field: 'boss', existing: curBoss, extracted: extBoss });
    }

    // Check images
    const image = String(w.extracted.image ?? '');
    const effectIcon = String(w.extracted.effect_icon ?? '');
    if (image) {
      try { await fs.access(path.join(WEAPON_IMG_DST_DIR, `${image}.png`)); }
      catch { diffs.push({ field: 'image (file)', existing: '(missing)', extracted: `${image}.png` }); }
    }
    if (effectIcon) {
      try { await fs.access(path.join(EFFECT_IMG_DST_DIR, `${effectIcon}.png`)); }
      catch { diffs.push({ field: 'effect_icon (file)', existing: '(missing)', extracted: `${effectIcon}.png` }); }
    }

    if (diffs.length > 0) {
      results.push({ id: w.id, name, existingKey: match.key, diffs });
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

export async function POST(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
    if (ids.length === 0) return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 });

    const { itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData, weaponBossMap, eventWeaponIds, adventureLicenseWeaponIds } = await loadGameData();
    const { raw: existingRaw, data: existing } = await loadExisting();
    const weapons = extractWeaponsFromGameData(itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData, weaponBossMap, eventWeaponIds, adventureLicenseWeaponIds);

    // Build lookup by ID
    const weaponById = new Map(weapons.map(w => [w.id, w]));

    // Build existing lookup by name+class
    const existingByNameClass = new Map<string, string>();
    for (const [key, entry] of Object.entries(existing)) {
      existingByNameClass.set(`${entry.name}|${entry.class ?? ''}`, key);
    }

    let maxKey = -1;
    for (const k of Object.keys(existing)) {
      const n = parseInt(k);
      if (!isNaN(n) && n > maxKey) maxKey = n;
    }

    let saved = 0;
    for (const id of ids) {
      const w = weaponById.get(id);
      if (!w) continue;

      const name = String(w.extracted.name ?? '');
      const cls = String(w.extracted.class ?? '');
      const existingKey = existingByNameClass.get(`${name}|${cls}`);

      const entry = { ...w.extracted };

      const key = existingKey ?? String(++maxKey);
      existing[key] = orderWeaponKeys(entry);
      if (!existingKey) {
        existingByNameClass.set(`${name}|${cls}`, key);
      }

      // Copy images if missing
      const image = String(w.extracted.image ?? '');
      const effectIcon = String(w.extracted.effect_icon ?? '');
      if (image) await copyIfMissing(IMG_SRC_DIR, image, WEAPON_IMG_DST_DIR, image);
      if (effectIcon) await copyIfMissing(IMG_SRC_DIR, effectIcon, EFFECT_IMG_DST_DIR, effectIcon);

      saved++;
    }

    // Write
    const eol = existingRaw ? detectEol(existingRaw) : '\n';
    let output = JSON.stringify(existing, null, 2) + '\n';
    if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');

    await fs.writeFile(WEAPON_PATH, output, 'utf-8');
    return NextResponse.json({ ok: true, saved, total: Object.keys(existing).length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

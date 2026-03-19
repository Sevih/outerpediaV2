/**
 * Shared extraction logic for weapon-like equipment (weapons, accessories).
 * Both share the same game data structure: ItemTemplet → MainOptionGroupID → ItemSpecialOptionTemplet → BuffTemplet.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  readTemplet, buildTextMap, expandLang,
  LANGS, type LangTexts,
  resolveEnum, resolveClass,
} from '@/app/admin/lib/text';

const IMG_SRC_DIR = path.join(process.cwd(), 'datamine', 'extracted_astudio', 'assets', 'editor', 'resources', 'sprite', 'at_thumbnailitemruntime');
const EQUIP_IMG_DST_DIR = path.join(process.cwd(), 'public', 'images', 'equipment');
const EFFECT_IMG_DST_DIR = path.join(process.cwd(), 'public', 'images', 'ui', 'effect');

export type BuffRow = Record<string, string>;
export type EquipJson = Record<string, Record<string, unknown>>;

// ── Path helper (avoids Turbopack broad pattern warning) ───────────

function pngPath(dir: string, name: string): string {
  return [dir, name].join(path.sep) + '.png';
}

export async function copyIfMissing(srcDir: string, srcName: string, dstDir: string, dstName: string): Promise<boolean> {
  const dst = pngPath(dstDir, dstName);
  try { await fs.access(dst); return false; }
  catch {
    const src = pngPath(srcDir, srcName);
    try { await fs.access(src); await fs.mkdir(dstDir, { recursive: true }); await fs.copyFile(src, dst); return true; }
    catch { return false; }
  }
}

export async function copyEquipImages(image: string, effectIcon: string) {
  if (image) await copyIfMissing(IMG_SRC_DIR, image, EQUIP_IMG_DST_DIR, image);
  if (effectIcon) await copyIfMissing(IMG_SRC_DIR, effectIcon, EFFECT_IMG_DST_DIR, effectIcon);
}

export async function checkImageExists(dir: 'equip' | 'effect', name: string): Promise<boolean> {
  const d = dir === 'equip' ? EQUIP_IMG_DST_DIR : EFFECT_IMG_DST_DIR;
  try { await fs.access(pngPath(d, name)); return true; }
  catch { return false; }
}

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
  const targetId = index === 0 ? ids[0] : (ids[index] ?? `${ids[0]}_${index + 1}`);
  return buffData.find(r => r.BuffID === targetId && String(r.Level) === String(level));
}

export function resolveEquipPlaceholders(text: string, buffData: BuffRow[], buffIdStr: string, level: number): string {
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

export function classFromRow(row: Record<string, string>, textSystemMap: Record<string, LangTexts>): string | null {
  const raw = row.TrustLevelLimit ?? '';
  if (!raw || raw === 'CCT_NONE') return null;
  return resolveClass(textSystemMap, raw) || null;
}

export function getMaxBuffLevel(buffData: BuffRow[], buffIdStr: string): number {
  const primaryId = buffIdStr.split(',')[0].trim();
  const levels = buffData.filter(r => r.BuffID === primaryId).map(r => parseInt(r.Level) || 1);
  return levels.length > 0 ? Math.max(...levels) : 1;
}

// ── Main stat extraction (accessories) ─────────────────────────────

const STAT_TYPE_TO_KEY: Record<string, string> = {
  ST_ATK: 'ATK',
  ST_DEF: 'DEF',
  ST_HP: 'HP',
  ST_BUFF_CHANCE: 'EFF',
  ST_BUFF_RESIST: 'RES',
  ST_SPEED: 'SPD',
  ST_CRITICAL_RATE: 'CHC',
  ST_CRITICAL_DMG_RATE: 'CHD',
  ST_PIERCE_POWER_RATE: 'PEN%',
  ST_VAMPIRIC: 'LS',
  ST_DMG_BOOST: 'DMG UP%',
  ST_DMG_REDUCE_RATE: 'DMG RED%',
  ST_E_CRI_DMG_REDUCE: 'CDMG RED%',
};

export function extractMainStats(
  itemOptionData: BuffRow[],
  subOptionGroupId: string,
): string[] | null {
  // SubOptionGroupID matches OptionMaxValue in ItemOptionTemplet
  const opts = itemOptionData.filter(r => r.OptionMaxValue === subOptionGroupId);
  if (opts.length === 0) return null;

  const stats: string[] = [];
  for (const opt of opts) {
    const baseKey = STAT_TYPE_TO_KEY[opt.StatType];
    if (!baseKey) continue;
    // Add % suffix for OAT_RATE if not already present
    const key = opt.ApplyingType === 'OAT_RATE' && !baseKey.includes('%') ? `${baseKey}%` : baseKey;
    if (!stats.includes(key)) stats.push(key);
  }

  return stats.length > 0 ? stats : null;
}

export function detectEol(raw: string): string {
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

export function orderKeys(obj: Record<string, unknown>, keyOrder: string[]): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of keyOrder) { if (key in obj) ordered[key] = obj[key]; }
  for (const key of Object.keys(obj)) { if (!(key in ordered)) ordered[key] = obj[key]; }
  return ordered;
}

// ── Config ─────────────────────────────────────────────────────────

export interface EquipExtractorConfig {
  /** ItemSubType filter (e.g. 'ITS_EQUIP_WEAPON', 'ITS_EQUIP_ACCESSORY') */
  itemSubType: string;
  /** Type value in output JSON (e.g. 'weapon', 'amulet') */
  typeName: string;
  /** Prefix for effect NameIDSymbol (e.g. ['UO_WEAPON_', 'UO_EVENT_']) */
  effectPrefixes: string[];
  /** Path to the JSON data file */
  jsonPath: string;
  /** Key order for JSON output */
  keyOrder: string[];
  /** Boss map builder (weapon-specific, optional) */
  buildBossMap?: (gameData: EquipGameData) => Map<string, string | string[]>;
  /** Source detector (optional) */
  detectSource?: (id: string, row: Record<string, string>, gameData: EquipGameData) => string | null;
  /** Extract mainStats from SubOptionGroupID (accessories) */
  extractMainStats?: boolean;
}

export interface EquipGameData {
  itemTemplet: { data: Record<string, string>[] };
  textItemMap: Record<string, LangTexts>;
  textSkillMap: Record<string, LangTexts>;
  textSystemMap: Record<string, LangTexts>;
  optById: Record<string, Record<string, string>>;
  buffData: BuffRow[];
  dungeonData: Record<string, string>[];
  rewardData: Record<string, string>[];
  rewardGroupData: Record<string, string>[];
  spawnData: Record<string, string>[];
  itemCraftData: Record<string, string>[];
  productData: Record<string, string>[];
  itemOptionData: Record<string, string>[];
}

// ── Load game data ─────────────────────────────────────────────────

export async function loadEquipGameData(): Promise<EquipGameData> {
  const [itemTemplet, textItem, specialOpt, textSkill, buffTemplet, textSystem, dungeonTemplet, rewardTemplet, rewardGroupTemplet, dungeonSpawnTemplet, itemCraftReward, productTemplet, itemOptionTemplet] = await Promise.all([
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
    readTemplet('ItemOptionTemplet'),
  ]);

  const optById: Record<string, Record<string, string>> = {};
  for (const o of specialOpt.data) optById[o.ID] = o;

  return {
    itemTemplet,
    textItemMap: buildTextMap(textItem.data),
    textSkillMap: buildTextMap(textSkill.data),
    textSystemMap: buildTextMap(textSystem.data),
    optById,
    buffData: buffTemplet.data,
    dungeonData: dungeonTemplet.data,
    rewardData: rewardTemplet.data,
    rewardGroupData: rewardGroupTemplet.data,
    spawnData: dungeonSpawnTemplet.data,
    itemCraftData: itemCraftReward.data,
    productData: productTemplet.data,
    itemOptionData: itemOptionTemplet.data,
  };
}

export async function loadExistingJson(jsonPath: string): Promise<{ raw?: string; data: EquipJson }> {
  try {
    const raw = await fs.readFile(jsonPath, 'utf-8');
    return { raw, data: JSON.parse(raw) };
  } catch {
    return { data: {} };
  }
}

// ── Extraction ─────────────────────────────────────────────────────

export interface ExtractedEquip {
  id: string;
  extracted: Record<string, unknown>;
}

export function extractEquipFromGameData(config: EquipExtractorConfig, gd: EquipGameData): ExtractedEquip[] {
  const { itemSubType, typeName, effectPrefixes } = config;
  const { itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData } = gd;

  const allItems = itemTemplet.data.filter(
    r => r.ItemSubType === itemSubType && (r.ItemGrade === 'IG_UNIQUE' || r.ItemGrade === 'IG_RARE') && parseInt(r.BasicStar ?? '0') >= 5
  );

  // Dedup step 1: keep highest star per name+class
  const bestByNameClass = new Map<string, Record<string, string>>();
  for (const row of allItems) {
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
    const mainOptIds = (row.MainOptionGroupID ?? '').split(',').map(s => s.trim()).filter(Boolean);
    let effectName = '';
    for (const mid of mainOptIds) {
      const opt = optById[mid];
      if (opt && effectPrefixes.some(p => (opt.NameIDSymbol ?? '').startsWith(p))) {
        effectName = textSkillMap[opt.NameIDSymbol]?.en ?? '';
        break;
      }
    }
    const key = `${effectName}|${cls}|${name}`;
    const existing = bestByEffectClassName.get(key);
    if (!existing || parseInt(row.BasicStar ?? '0') > parseInt(existing.BasicStar ?? '0')) {
      bestByEffectClassName.set(key, row);
    }
  }

  // Boss map
  const bossMap = config.buildBossMap?.(gd) ?? new Map();

  const results: ExtractedEquip[] = [];

  for (const row of bestByEffectClassName.values()) {
    const id = row.ID;
    const nameTexts = textItemMap[row.DescIDSymbol];
    const cls = classFromRow(row, textSystemMap);
    const star = parseInt(row.BasicStar ?? '1');

    // Find effect via MainOptionGroupID
    const mainOptIds = (row.MainOptionGroupID ?? '').split(',').map(s => s.trim()).filter(Boolean);
    let effectOpt: Record<string, string> | undefined;
    for (const mid of mainOptIds) {
      const opt = optById[mid];
      if (opt && effectPrefixes.some(p => (opt.NameIDSymbol ?? '').startsWith(p))) {
        effectOpt = opt;
        break;
      }
    }

    const effectNameTexts = effectOpt ? textSkillMap[effectOpt.NameIDSymbol] : undefined;
    const descSymbol = effectOpt?.DescID ?? effectOpt?.CustomCraftDescIDSymbol;
    const descTexts = descSymbol ? textSkillMap[descSymbol] : undefined;
    const buffIdStr = effectOpt?.BuffID ?? '';
    const maxLevel = buffIdStr ? getMaxBuffLevel(buffData, buffIdStr) : 1;

    const extracted: Record<string, unknown> = {
      ...expandLang('name', nameTexts),
      type: typeName,
      rarity: resolveEnum(textSystemMap, row.ItemGrade ?? '', 'IG_', 'SYS_ITEM_GRADE_').toLowerCase(),
      image: row.IconName ?? '',
      ...expandLang('effect_name', effectNameTexts, null as unknown as string),
      effect_icon: effectOpt?.BuffLevel_4P ?? null,
      class: cls,
      level: star,
    };

    // Boss / source
    if (row.ItemGrade === 'IG_UNIQUE') {
      const boss = bossMap.get(id) ?? null;
      if (boss) {
        extracted.boss = boss;
      } else {
        const source = config.detectSource?.(id, row, gd) ?? null;
        if (source) {
          extracted.source = source;
          extracted.boss = null;
        }
      }
    }

    // MainStats (from SubOptionGroupID → ItemOptionTemplet)
    if (config.extractMainStats) {
      const subOptId = row.SubOptionGroupID?.split(',')[0]?.trim();
      if (subOptId) {
        const stats = extractMainStats(gd.itemOptionData, subOptId);
        if (stats) extracted.mainStats = stats;
      }
    }

    // Effect descriptions
    for (const lang of LANGS) {
      const key1 = lang === 'en' ? 'effect_desc1' : `effect_desc1_${lang}`;
      const key4 = lang === 'en' ? 'effect_desc4' : `effect_desc4_${lang}`;
      if (descTexts && buffIdStr) {
        const raw = descTexts[lang] ?? '';
        extracted[key1] = resolveEquipPlaceholders(raw, buffData, buffIdStr, 1);
        extracted[key4] = resolveEquipPlaceholders(raw, buffData, buffIdStr, maxLevel);
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

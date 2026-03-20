/**
 * Armor Set extractor API route.
 *
 * Extracts set data from ItemSpecialOptionTemplet (ST_Set_* entries).
 * Sets are effects applied to armor, NOT items themselves.
 * Each set has a 2-piece and/or 4-piece effect at two tiers (base + upgraded).
 *
 * Boss mapping: DM_RAID_1 (Ecology Study) Stage 13 → armor item rewards → set number.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  expandLang,
  LANGS, DEFAULT_LANG, SUFFIX_LANGS, type LangTexts,
} from '@/app/admin/lib/text';
import {
  loadEquipGameData,
  type EquipGameData,
  orderKeys,
  detectEol,
  copyIfMissing,
  checkImageExists,
} from '../lib/equip-extractor';

const JSON_PATH = path.join(process.cwd(), 'data', 'equipment', 'sets.json');

const IMG_SRC_DIR = path.join(process.cwd(), 'datamine', 'extracted_astudio', 'assets', 'editor', 'resources', 'sprite', 'at_thumbnailitemruntime');
const EFFECT_IMG_DST_DIR = path.join(process.cwd(), 'public', 'images', 'ui', 'effect');

const KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'rarity',
  'set_icon',
  'effect_2_1', 'effect_2_1_jp', 'effect_2_1_kr', 'effect_2_1_zh',
  'effect_4_1', 'effect_4_1_jp', 'effect_4_1_kr', 'effect_4_1_zh',
  'effect_2_4', 'effect_2_4_jp', 'effect_2_4_kr', 'effect_2_4_zh',
  'effect_4_4', 'effect_4_4_jp', 'effect_4_4_kr', 'effect_4_4_zh',
  'class',
  'source',
  'boss',
  'image_prefix',
];

const COMPARE_FIELDS = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'rarity', 'set_icon',
  'effect_2_1', 'effect_2_1_jp', 'effect_2_1_kr', 'effect_2_1_zh',
  'effect_4_1', 'effect_4_1_jp', 'effect_4_1_kr', 'effect_4_1_zh',
  'effect_2_4', 'effect_2_4_jp', 'effect_2_4_kr', 'effect_2_4_zh',
  'effect_4_4', 'effect_4_4_jp', 'effect_4_4_kr', 'effect_4_4_zh',
  'class', 'source', 'image_prefix',
];

type SetRow = Record<string, string>;
type SetJson = Record<string, unknown>[];

// ── Helpers ─────────────────────────────────────────────────────────

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

/** Check if a stat value should be displayed as permille (÷10 + %) */
function isPermilleStat(statType: string, applyingType: string): boolean {
  if (applyingType === 'OAT_RATE') return true;
  if (statType.includes('_RATE') || statType.includes('_DMG')) return true;
  // ST_VAMPIRIC (Lifesteal) uses permille with OAT_ADD
  if (statType === 'ST_VAMPIRIC') return true;
  return false;
}

/** Format a stat value: permille → "X%" or raw → "X" */
function formatStatValue(raw: string, statType: string, applyingType: string): string {
  const num = parseInt(raw);
  if (isNaN(num)) return '';
  if (isPermilleStat(statType, applyingType)) return `${num / 10}%`;
  return String(num);
}

/**
 * Get the 4-piece value from confusingly named fields.
 * The value can be in OptionType_4P_fallback1 or BuffLevel_2P_fallback1.
 */
function get4PValue(row: SetRow): string {
  const f1 = row.OptionType_4P_fallback1 ?? '';
  if (f1 && f1 !== 'OAT_NONE') return f1;
  const f2 = row.BuffLevel_2P_fallback1 ?? '';
  if (f2 && f2 !== 'OAT_NONE') return f2;
  return '';
}

// ── Stat-based effect description ───────────────────────────────────

function resolveStatEffect(
  statType: string,
  applyingType: string,
  rawValue: string,
  textSystemMap: Record<string, LangTexts>,
): Record<string, string | null> {
  if (!statType || statType === 'ST_NONE' || !rawValue || rawValue === 'OAT_NONE') {
    const result: Record<string, string | null> = {};
    result[DEFAULT_LANG] = null;
    for (const lang of SUFFIX_LANGS) result[lang] = null;
    return result;
  }

  const sysKey = 'SYS_STAT_' + statType.slice(3); // ST_ATK → SYS_STAT_ATK
  const statTexts = textSystemMap[sysKey];
  const formattedValue = formatStatValue(rawValue, statType, applyingType);

  const result: Record<string, string | null> = {};
  for (const lang of LANGS) {
    const statName = statTexts?.[lang] ?? statType;
    result[lang] = `${statName} +${formattedValue}`;
  }
  return result;
}

// ── Buff-based effect description ───────────────────────────────────

function resolveBuffEffect(
  descIds: string[],
  index: number,
  textSkillMap: Record<string, LangTexts>,
): Record<string, string | null> {
  const descId = descIds[index];
  const result: Record<string, string | null> = {};

  if (!descId) {
    result[DEFAULT_LANG] = null;
    for (const lang of SUFFIX_LANGS) result[lang] = null;
    return result;
  }

  const texts = textSkillMap[descId];
  for (const lang of LANGS) {
    result[lang] = texts?.[lang] ?? null;
  }
  return result;
}

// ── Boss mapping (DM_RAID_1 Ecology Study Stage 13) ─────────────────

function buildArmorBossMap(gd: EquipGameData): Map<string, string> {
  // SpawnID → boss monster ID
  const spawnToBoss: Record<string, string> = {};
  for (const s of gd.spawnData) {
    if (s.HPLineCount) spawnToBoss[s.HPLineCount] = s.ID0 || s.ID3;
  }

  // RewardID → RandomGroupIDs
  const rewardById: Record<string, Record<string, string>> = {};
  for (const r of gd.rewardData) {
    if (r.ID) rewardById[r.ID] = r;
  }

  // ItemTemplet by ID for DescIDSymbol lookup
  const itemById: Record<string, Record<string, string>> = {};
  for (const item of gd.itemTemplet.data) {
    itemById[item.ID] = item;
  }

  // Map: set GroupID → boss ID
  // Armor DescIDSymbols follow pattern: ITEM_*_XS_NAME where X = GroupID (NOT the ST_Set_XX number)
  const groupIdToBoss = new Map<string, string>();

  for (const d of gd.dungeonData) {
    if (d.DungeonMode !== 'DM_RAID_1') continue;
    const name = gd.textSystemMap[d.SeasonFullName]?.en ?? '';
    if (!name.includes('Stage 13')) continue;

    // Try all spawn positions — for DM_RAID_1, the boss is typically in Pos2
    const bossId =
      spawnToBoss[d.SpawnID_Pos2] ??
      spawnToBoss[d.SpawnID_Pos0] ??
      spawnToBoss[d.SpawnID_Pos1] ??
      undefined;
    if (!bossId) continue;

    // Get reward group IDs
    const reward = rewardById[d.RewardID];
    if (!reward?.RandomGroupID) continue;
    const groupIds = reward.RandomGroupID.split(',').map(s => s.trim()).filter(Boolean);

    // Find armor item IDs in reward groups and extract set number
    for (const gid of groupIds) {
      for (const r of gd.rewardGroupData) {
        if (r.GroupID !== gid || r.Type !== 'RIT_ITEM') continue;

        const item = itemById[r.TypeID];
        if (!item) continue;

        // Extract GroupID from DescIDSymbol: ITEM_HELMET_M_7S_NAME → 7 (= GroupID)
        const match = item.DescIDSymbol?.match(/_(\d+)S_NAME$/);
        if (match) {
          groupIdToBoss.set(match[1], bossId);
        }
      }
    }
  }

  return groupIdToBoss;
}

// ── Extraction ──────────────────────────────────────────────────────

interface ExtractedSet {
  id: string; // GroupID
  extracted: Record<string, unknown>;
}

function extractSetsFromGameData(gd: EquipGameData): ExtractedSet[] {
  const { textItemMap, textSkillMap, textSystemMap } = gd;

  // Get all set entries from ItemSpecialOptionTemplet
  const specialOptData = Object.values(gd.optById);
  const setEntries = specialOptData.filter(r => r.NameIDSymbol?.startsWith('ST_Set_'));

  // Group by GroupID
  const byGroup = new Map<string, { tier0?: SetRow; tier4?: SetRow }>();
  for (const row of setEntries) {
    const gid = row.GroupID;
    const group = byGroup.get(gid) ?? {};
    if (row.Level === '1') group.tier0 = row;
    else if (row.Level === '2') group.tier4 = row;
    byGroup.set(gid, group);
  }

  // Boss map: GroupID → boss ID
  const groupIdToBoss = buildArmorBossMap(gd);

  // Rarity: derive from armor items grade
  // All set armor pieces in DM_RAID_1 Stage 13 are IG_UNIQUE = legendary
  // Use resolveEnum for consistency
  const legendaryRarity = (textSystemMap['SYS_ITEM_GRADE_UNIQUE']?.en ?? 'Legendary').toLowerCase();

  const results: ExtractedSet[] = [];

  for (const [groupId, { tier0, tier4 }] of Array.from(byGroup)) {
    if (!tier0) continue; // Need at least the base tier

    const baseRow = tier0;
    const nameTexts = textItemMap[baseRow.NameIDSymbol];
    const setIcon = baseRow.BuffLevel_4P ?? '';

    // Resolve effects for each piece count (2P, 4P) at each tier (1, 4)
    const effect_2_1 = resolveEffect(baseRow, '2P', textSystemMap, textSkillMap);
    const effect_4_1 = resolveEffect(baseRow, '4P', textSystemMap, textSkillMap);
    const effect_2_4 = tier4 ? resolveEffect(tier4, '2P', textSystemMap, textSkillMap) : nullEffect();
    const effect_4_4 = tier4 ? resolveEffect(tier4, '4P', textSystemMap, textSkillMap) : nullEffect();

    // Boss mapping
    const boss = groupIdToBoss.get(groupId) ?? null;

    const extracted: Record<string, unknown> = {
      ...expandLang('name', nameTexts),
      rarity: legendaryRarity,
      set_icon: setIcon,
      ...expandEffectLang('effect_2_1', effect_2_1),
      ...expandEffectLang('effect_4_1', effect_4_1),
      ...expandEffectLang('effect_2_4', effect_2_4),
      ...expandEffectLang('effect_4_4', effect_4_4),
      class: null,
      boss,
      image_prefix: '06',
    };

    // Add source field if no boss (like Bursting Set)
    if (!boss) {
      extracted.source = null;
    }

    results.push({ id: groupId, extracted });
  }

  results.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  return results;
}

/** Resolve a single effect (2P or 4P) from a set row */
function resolveEffect(
  row: SetRow,
  piece: '2P' | '4P',
  textSystemMap: Record<string, LangTexts>,
  textSkillMap: Record<string, LangTexts>,
): Record<string, string | null> {
  const optionType = row[`OptionType_${piece}`] ?? '';

  if (optionType === 'IOT_STAT') {
    const statType = row[`StatType_${piece}`] ?? '';
    const applyingType = row[`ApplyingType_${piece}`] ?? '';

    let rawValue: string;
    if (piece === '2P') {
      rawValue = row.BuffLevel_2P ?? '';
    } else {
      rawValue = get4PValue(row);
    }

    return resolveStatEffect(statType, applyingType, rawValue, textSystemMap);
  }

  if (optionType === 'IOT_BUFF') {
    // Description from DescID (can be comma-separated: first=2P, second=4P)
    const descIdRaw = row.DescID ?? row.CustomCraftDescIDSymbol ?? '';
    const descIds = descIdRaw.split(',').map(s => s.trim()).filter(Boolean);

    // Determine index: if both 2P and 4P are buff → 2P=0, 4P=1
    // If only one piece is buff → always index 0
    let index: number;
    if (piece === '2P') {
      index = 0;
    } else {
      const otherIsBuff = (row.OptionType_2P ?? '') === 'IOT_BUFF';
      index = otherIsBuff ? 1 : 0;
    }

    return resolveBuffEffect(descIds, index, textSkillMap);
  }

  return nullEffect();
}

function nullEffect(): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  result[DEFAULT_LANG] = null;
  for (const lang of SUFFIX_LANGS) result[lang] = null;
  return result;
}

/** Expand effect langs into suffixed fields */
function expandEffectLang(field: string, langMap: Record<string, string | null>): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  result[field] = langMap[DEFAULT_LANG];
  for (const lang of SUFFIX_LANGS) {
    result[`${field}_${lang}`] = langMap[lang];
  }
  return result;
}

// ── Load existing JSON (array format) ───────────────────────────────

async function loadExisting(): Promise<{ raw?: string; data: SetJson }> {
  try {
    const raw = await fs.readFile(JSON_PATH, 'utf-8');
    return { raw, data: JSON.parse(raw) };
  } catch {
    return { data: [] };
  }
}

// ── Handlers ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const action = req.nextUrl.searchParams.get('action') ?? 'list';

  try {
    const gd = await loadEquipGameData();
    const sets = extractSetsFromGameData(gd);
    const { data: existing } = await loadExisting();

    if (action === 'list') {
      const existingNames = new Set(existing.map(e => String(e.name ?? '')));

      const entries = sets.map(s => ({
        ...s.extracted,
        id: s.id,
        existsInJson: existingNames.has(String(s.extracted.name ?? '')),
      }));

      return NextResponse.json({
        total: entries.length,
        existing: entries.filter(e => e.existsInJson).length,
        new: entries.filter(e => !e.existsInJson).length,
        entries,
      });
    }

    if (action === 'compare') {
      const existingByName = new Map<string, Record<string, unknown>>();
      for (const entry of existing) {
        existingByName.set(String(entry.name ?? ''), entry);
      }

      const results: { id: string; name: string; diffs: { field: string; existing: string; extracted: string }[] }[] = [];
      let ok = 0;

      for (const s of sets) {
        const name = String(s.extracted.name ?? '');
        const prev = existingByName.get(name);
        if (!prev) continue;

        const diffs: { field: string; existing: string; extracted: string }[] = [];

        for (const field of COMPARE_FIELDS) {
          const ext = String(s.extracted[field] ?? '');
          const cur = String(prev[field] ?? '');
          if (ext && cur && ext !== cur) {
            diffs.push({ field, existing: cur, extracted: ext });
          }
        }

        // Compare boss
        const extBoss = JSON.stringify(s.extracted.boss ?? null);
        const curBoss = JSON.stringify(prev.boss ?? null);
        if (extBoss !== curBoss) {
          diffs.push({ field: 'boss', existing: curBoss, extracted: extBoss });
        }

        // Check set_icon image
        const setIcon = String(s.extracted.set_icon ?? '');
        if (setIcon && !(await checkImageExists('effect', setIcon))) {
          diffs.push({ field: 'set_icon (file)', existing: '(missing)', extracted: `${setIcon}.png` });
        }

        if (diffs.length > 0) results.push({ id: s.id, name, diffs });
        else ok++;
      }

      return NextResponse.json({
        total: existing.length,
        withDiffs: results.length,
        ok,
        results,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
    if (ids.length === 0) return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 });

    const gd = await loadEquipGameData();
    const { raw: existingRaw, data: existing } = await loadExisting();
    const sets = extractSetsFromGameData(gd);
    const setById = new Map(sets.map(s => [s.id, s]));

    let saved = 0;
    for (const id of ids) {
      const s = setById.get(id);
      if (!s) continue;

      const name = String(s.extracted.name ?? '');
      const idx = existing.findIndex(e => String(e.name ?? '') === name);

      const ordered = orderKeys(s.extracted as Record<string, unknown>, KEY_ORDER);

      if (idx >= 0) {
        existing[idx] = ordered;
      } else {
        existing.push(ordered);
      }

      // Copy set_icon image
      const setIcon = String(s.extracted.set_icon ?? '');
      if (setIcon) {
        await copyIfMissing(IMG_SRC_DIR, setIcon, EFFECT_IMG_DST_DIR, setIcon);
      }

      saved++;
    }

    const eol = existingRaw ? detectEol(existingRaw) : '\n';
    let output = JSON.stringify(existing, null, 2) + '\n';
    if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
    await fs.writeFile(JSON_PATH, output, 'utf-8');

    return NextResponse.json({ ok: true, saved, total: existing.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

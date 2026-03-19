import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  type EquipExtractorConfig,
  type EquipGameData,
  loadEquipGameData,
  loadExistingJson,
  extractEquipFromGameData,
  orderKeys,
  detectEol,
  copyEquipImages,
  checkImageExists,
} from '../lib/equip-extractor';

const JSON_PATH = path.join(process.cwd(), 'data', 'equipment', 'accessory.json');

const KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'type', 'rarity', 'image',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon',
  'class',
  'mainStats',
  'source',
  'boss',
  'level',
];

// ── Boss mapping (same logic as weapons: Stage 13 DM_RAID_1) ──────

function buildAccessoryBossMap(gd: EquipGameData): Map<string, string | string[]> {
  const spawnToBoss: Record<string, string> = {};
  for (const s of gd.spawnData) {
    if (s.HPLineCount) spawnToBoss[s.HPLineCount] = s.ID0 || s.ID3;
  }

  const rewardToGroups: Record<string, string[]> = {};
  for (const r of gd.rewardData) {
    if (r.RandomGroupID) rewardToGroups[r.ID] = r.RandomGroupID.split(',').map(s => s.trim()).filter(Boolean);
  }

  const itemToBoss = new Map<string, string | string[]>();

  // DM_RAID_1 Stage 13 for accessories
  for (const d of gd.dungeonData) {
    if (d.DungeonMode !== 'DM_RAID_1') continue;
    const name = gd.textSystemMap[d.SeasonFullName]?.en ?? '';
    if (!name.includes('Stage 13')) continue;

    const spawnId = d.SpawnID_Pos0 || d.SpawnID_Pos1 || d.SpawnID_Pos2;
    const bossId = spawnId ? spawnToBoss[spawnId] : undefined;
    if (!bossId) continue;

    const groups = rewardToGroups[d.RewardID] ?? [];
    for (const gid of groups) {
      for (const r of gd.rewardGroupData) {
        if (r.GroupID === gid && r.Type === 'RIT_ITEM') {
          itemToBoss.set(r.TypeID, bossId);
        }
      }
    }
  }

  // Also check DM_RAID_2 (some accessories may drop there too)
  for (const d of gd.dungeonData) {
    if (d.DungeonMode !== 'DM_RAID_2') continue;
    const name = gd.textSystemMap[d.SeasonFullName]?.en ?? '';
    if (!name.includes('Stage 13')) continue;

    const spawnId = d.SpawnID_Pos0 || d.SpawnID_Pos1 || d.SpawnID_Pos2;
    const bossId = spawnId ? spawnToBoss[spawnId] : undefined;
    if (!bossId) continue;

    const groups = rewardToGroups[d.RewardID] ?? [];
    for (const gid of groups) {
      for (const r of gd.rewardGroupData) {
        if (r.GroupID === gid && r.Type === 'RIT_ITEM') {
          // Only set if not already mapped
          if (!itemToBoss.has(r.TypeID)) itemToBoss.set(r.TypeID, bossId);
        }
      }
    }
  }

  // Irregular accessories
  const IRREGULAR_ACC_BOSS_MAP: Record<string, string[]> = {
    '7003003': ['51202001', '51202002'], // Ambition accessories
    '7003004': ['51202003', '51202004'], // Vanity accessories
  };
  for (const [groupId, bossIds] of Object.entries(IRREGULAR_ACC_BOSS_MAP)) {
    const items = gd.rewardGroupData.filter(r => r.GroupID === groupId && r.Type === 'RIT_ITEM');
    for (const item of items) {
      itemToBoss.set(item.TypeID, bossIds);
    }
  }

  return itemToBoss;
}

// ── Source detection ────────────────────────────────────────────────

function detectSource(id: string, _row: Record<string, string>, gd: EquipGameData): string | null {
  const productById: Record<string, Record<string, string>> = {};
  for (const p of gd.productData) productById[p.ID] = p;

  // Via ItemCraftRewardTemplet
  for (const craft of gd.itemCraftData) {
    if (craft.ID !== id) continue;
    const prod = productById[craft.GroupID];
    if (prod?.ProductCategory?.startsWith('PC_EVENT')) return 'Event Shop';
    if (prod?.ProductLevel === 'PC_ADVENTURE_LICENSE') return 'Adventure License';
  }

  // Via ProductTemplet direct
  for (const prod of gd.productData) {
    if (prod.ProductGoodsType !== 'PGT_ITEM' || prod.ProductGoodsID !== id) continue;
    if (prod.ProductCategory?.startsWith('PC_EVENT')) return 'Event Shop';
    if (prod.ProductLevel === 'PC_ADVENTURE_LICENSE') return 'Adventure License';
  }

  return null;
}

// ── Config ─────────────────────────────────────────────────────────

const CONFIG: EquipExtractorConfig = {
  itemSubType: 'ITS_EQUIP_ACCESSORY',
  typeName: 'amulet',
  effectPrefixes: ['UO_ACC_', 'UO_EVENT_'],
  jsonPath: JSON_PATH,
  keyOrder: KEY_ORDER,
  buildBossMap: buildAccessoryBossMap,
  detectSource,
  extractMainStats: true,
};

// ── Handlers ───────────────────────────────────────────────────────

function devOnly() {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const action = req.nextUrl.searchParams.get('action') ?? 'list';
  try {
    const gd = await loadEquipGameData();
    const { data: existing } = await loadExistingJson(JSON_PATH);
    const items = extractEquipFromGameData(CONFIG, gd);

    if (action === 'list') {
      const existingByNameClass = new Map<string, string>();
      for (const [key, entry] of Object.entries(existing)) {
        existingByNameClass.set(`${entry.name}|${entry.class ?? ''}`, key);
      }

      const entries = items.map(w => {
        const name = String(w.extracted.name ?? '');
        const cls = String(w.extracted.class ?? '');
        return { ...w.extracted, id: w.id, existsInJson: !!existingByNameClass.get(`${name}|${cls}`) };
      });

      return NextResponse.json({ total: entries.length, existing: entries.filter(e => e.existsInJson).length, new: entries.filter(e => !e.existsInJson).length, entries });
    }

    if (action === 'compare') {
      const existingByNameClass = new Map<string, { key: string; entry: Record<string, unknown> }>();
      for (const [key, entry] of Object.entries(existing)) {
        existingByNameClass.set(`${entry.name}|${entry.class ?? ''}`, { key, entry });
      }

      const COMPARE_FIELDS = [
        'name', 'name_jp', 'name_kr', 'name_zh',
        'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
        'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
        'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
        'effect_icon', 'class', 'image', 'rarity', 'source',
      ];

      const results: { id: string; name: string; diffs: { field: string; existing: string; extracted: string }[] }[] = [];
      let ok = 0;

      for (const w of items) {
        const name = String(w.extracted.name ?? '');
        const cls = String(w.extracted.class ?? '');
        const match = existingByNameClass.get(`${name}|${cls}`);
        if (!match) continue;

        const prev = match.entry;
        const diffs: { field: string; existing: string; extracted: string }[] = [];

        for (const field of COMPARE_FIELDS) {
          const ext = String(w.extracted[field] ?? '');
          const cur = String(prev[field] ?? '');
          if (ext && cur && ext !== cur) diffs.push({ field, existing: cur, extracted: ext });
        }

        // Compare mainStats (array)
        const extStats = JSON.stringify(w.extracted.mainStats ?? null);
        const curStats = JSON.stringify(prev.mainStats ?? null);
        if (extStats !== curStats) diffs.push({ field: 'mainStats', existing: curStats, extracted: extStats });

        const extBoss = JSON.stringify(w.extracted.boss ?? null);
        const curBoss = JSON.stringify(prev.boss ?? null);
        if (extBoss !== curBoss) diffs.push({ field: 'boss', existing: curBoss, extracted: extBoss });

        const image = String(w.extracted.image ?? '');
        const effectIcon = String(w.extracted.effect_icon ?? '');
        if (image && !(await checkImageExists('equip', image))) diffs.push({ field: 'image (file)', existing: '(missing)', extracted: `${image}.png` });
        if (effectIcon && !(await checkImageExists('effect', effectIcon))) diffs.push({ field: 'effect_icon (file)', existing: '(missing)', extracted: `${effectIcon}.png` });

        if (diffs.length > 0) results.push({ id: w.id, name, diffs });
        else ok++;
      }

      return NextResponse.json({ total: Object.keys(existing).length, withDiffs: results.length, ok, results });
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
    const { raw: existingRaw, data: existing } = await loadExistingJson(JSON_PATH);
    const items = extractEquipFromGameData(CONFIG, gd);
    const itemById = new Map(items.map(w => [w.id, w]));

    const existingByNameClass = new Map<string, string>();
    for (const [key, entry] of Object.entries(existing)) {
      existingByNameClass.set(`${entry.name}|${entry.class ?? ''}`, key);
    }

    let maxKey = -1;
    for (const k of Object.keys(existing)) { const n = parseInt(k); if (!isNaN(n) && n > maxKey) maxKey = n; }

    let saved = 0;
    for (const id of ids) {
      const w = itemById.get(id);
      if (!w) continue;

      const name = String(w.extracted.name ?? '');
      const cls = String(w.extracted.class ?? '');
      const existingKey = existingByNameClass.get(`${name}|${cls}`);

      const key = existingKey ?? String(++maxKey);
      existing[key] = orderKeys({ ...w.extracted }, KEY_ORDER);
      if (!existingKey) existingByNameClass.set(`${name}|${cls}`, key);

      const image = String(w.extracted.image ?? '');
      const effectIcon = String(w.extracted.effect_icon ?? '');
      await copyEquipImages(image, effectIcon);

      saved++;
    }

    const eol = existingRaw ? detectEol(existingRaw) : '\n';
    let output = JSON.stringify(existing, null, 2) + '\n';
    if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
    await fs.writeFile(JSON_PATH, output, 'utf-8');

    return NextResponse.json({ ok: true, saved, total: Object.keys(existing).length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import type { Item, ItemRarity } from '@/types/item';

const ITEMS_PATH = path.join(process.cwd(), 'data', 'items.json');
const JSON2_DIR = path.join(process.cwd(), 'data', 'admin', 'json2');
const ICON_SOURCE_DIR = path.join(
  process.cwd(),
  'datamine',
  'extracted_astudio',
  'assets',
  'editor',
  'resources',
  'sprite',
  'at_thumbnailitemruntime',
);
const ICON_TARGET_DIR = path.join(process.cwd(), 'public', 'images', 'items');

// ── Game data tables ────────────────────────────────────────────────

interface ItemTempletRow {
  ID: string;
  NameID?: string;
  DescID?: string;
  IconName?: string;
  ItemType: string;
  ItemSubType: string;
  ItemGrade?: string;
}

interface TextRow {
  ID: string;
  English?: string;
  Japanese?: string;
  Korean?: string;
  China_Simplified?: string;
}

// ── Mappings ────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, Item['type']> = {
  IT_GEM: 'gem',
  IT_BOX: 'box',
  IT_PRESENT: 'present',
  IT_MATERIAL: 'material',
};

const RARITY_MAP: Record<string, ItemRarity> = {
  IG_NORMAL: 'normal',
  IG_MAGIC: 'superior',
  IG_RARE: 'epic',
  IG_UNIQUE: 'legendary',
};

const SUBTYPE_MAP: Record<string, string> = {
  ITS_GEM: 'gem',
  ITS_BOX_TYPE_RANDOM: 'box_random',
  ITS_BOX_TYPE_CHOICE_ITEM: 'box_choice_item',
  ITS_BOX_TYPE_CHOICE_CHAR: 'box_choice_char',
  ITS_BOX_TYPE_CHOICE_CHAR_MAX: 'box_choice_char_max',
  ITS_PRESENT_01: 'present',
  ITS_PRESENT_02: 'present',
  ITS_PRESENT_03: 'present',
  ITS_PRESENT_04: 'present',
  ITS_PRESENT_05: 'present',
  ITS_PRESENT_MAX: 'present_max',
  ITS_MATERIAL_CHAR_LEVEL: 'char_level',
  ITS_MATERIAL_CHAR_LEVEL_SPECIAL: 'char_level_special',
  ITS_MATERIAL_CHAR_EVO_FIRE: 'char_evo',
  ITS_MATERIAL_CHAR_EVO_WATER: 'char_evo',
  ITS_MATERIAL_CHAR_EVO_EARTH: 'char_evo',
  ITS_MATERIAL_CHAR_EVO_LIGHT: 'char_evo',
  ITS_MATERIAL_CHAR_EVO_DARK: 'char_evo',
  ITS_MATERIAL_CHAR_EVO_SPECIAL: 'char_evo_special',
  ITS_MATERIAL_CHAR_SKILL: 'char_class',
  ITS_MATERIAL_CHAR_RECALL: 'char_recall',
  ITS_MATERIAL_CHAR_CORE_FUSION: 'core_fusion',
  ITS_MATERIAL_CRAFT: 'craft',
  ITS_MATERIAL_CRAFT_ADDTION_1: 'craft',
  ITS_MATERIAL_CRAFT_ADDTION_2: 'craft',
  ITS_MATERIAL_CRAFT_ADDTION_3: 'craft',
  ITS_MATERIAL_CRAFT_GIFT: 'craft_gift',
  ITS_MATERIAL_EQUIP_BREAKLIMIT: 'equip_breaklimit',
  ITS_MATERIAL_EQUIP_CHANGER: 'equip_changer',
  ITS_MATERIAL_EQUIP_ENCHANT: 'equip_enchant',
  ITS_MATERIAL_EQUIP_TRANSCEND: 'equip_transcend',
  ITS_MATERIAL_GEAR_RECALL: 'gear_recall',
  ITS_MATERIAL_ARMOR_BREAKLIMIT: 'armor_breaklimit',
  ITS_MATERIAL_ADD_MANUFACT: 'add_manufact',
  ITS_RECRUIT_TICKET: 'recruit_ticket',
  ITS_SWEEP_TICKET: 'sweep_ticket',
  ITS_MONAD_GATE: 'monad',
};

// Localized + icon fields we compare/sync from game data
const SYNC_FIELDS = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'description', 'description_jp', 'description_kr', 'description_zh',
  'icon',
] as const;
type SyncField = typeof SYNC_FIELDS[number];

// Scope determines which fields get overwritten on apply
const EN_FIELDS: readonly SyncField[] = ['name', 'description', 'icon'];
const LOC_FIELDS: readonly SyncField[] = [
  'name_jp', 'name_kr', 'name_zh',
  'description_jp', 'description_kr', 'description_zh',
];
type Scope = 'all' | 'en' | 'loc';

function fieldsForScope(scope: Scope): readonly SyncField[] {
  if (scope === 'en') return EN_FIELDS;
  if (scope === 'loc') return LOC_FIELDS;
  return SYNC_FIELDS;
}

// ── Helpers ─────────────────────────────────────────────────────────

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

async function loadTable<T>(name: string): Promise<T[]> {
  const raw = await fs.readFile(path.join(JSON2_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as T[];
}

function buildTextLookup(rows: TextRow[]): Map<string, TextRow> {
  const map = new Map<string, TextRow>();
  for (const r of rows) if (r.ID) map.set(r.ID, r);
  return map;
}

function getLocalized(text: Map<string, TextRow>, id: string | undefined) {
  if (!id) return { en: '', jp: '', kr: '', zh: '' };
  const r = text.get(id);
  if (!r) return { en: '', jp: '', kr: '', zh: '' };
  return {
    en: r.English ?? '',
    jp: r.Japanese ?? '',
    kr: r.Korean ?? '',
    zh: r.China_Simplified ?? '',
  };
}

function extractFromTemplet(
  rows: ItemTempletRow[],
  text: Map<string, TextRow>,
): Item[] {
  const items: Item[] = [];
  for (const r of rows) {
    const type = TYPE_MAP[r.ItemType];
    if (!type) continue;

    const subtype = SUBTYPE_MAP[r.ItemSubType];
    if (!subtype) continue;

    const rarity = RARITY_MAP[r.ItemGrade ?? 'IG_NORMAL'] ?? 'normal';
    const name = getLocalized(text, r.NameID);
    const desc = getLocalized(text, r.DescID);

    items.push({
      id: r.ID,
      name: name.en,
      name_jp: name.jp,
      name_kr: name.kr,
      name_zh: name.zh,
      rarity,
      description: desc.en,
      description_jp: desc.jp,
      description_kr: desc.kr,
      description_zh: desc.zh,
      icon: r.IconName ?? '',
      type: type as Item['type'],
      subtype: subtype as Item['subtype'],
    });
  }
  return items;
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function checkIconStatus(icon: string) {
  if (!icon) return { hasTarget: true, hasSource: false };
  const targetPng = path.join(ICON_TARGET_DIR, `${icon}.png`);
  const targetWebp = path.join(ICON_TARGET_DIR, `${icon}.webp`);
  const sourcePng = path.join(ICON_SOURCE_DIR, `${icon}.png`);
  const [pngOk, webpOk, srcOk] = await Promise.all([
    fileExists(targetPng), fileExists(targetWebp), fileExists(sourcePng),
  ]);
  return { hasTarget: pngOk && webpOk, hasSource: srcOk };
}

/** Copy icon PNG from datamine to public, generate WebP. Returns true if any write happened. */
async function syncIcon(icon: string): Promise<{ copied: boolean; warning?: string }> {
  if (!icon) return { copied: false };
  const sourcePng = path.join(ICON_SOURCE_DIR, `${icon}.png`);
  const targetPng = path.join(ICON_TARGET_DIR, `${icon}.png`);
  const targetWebp = path.join(ICON_TARGET_DIR, `${icon}.webp`);

  if (!(await fileExists(sourcePng))) {
    return { copied: false, warning: `source PNG missing: ${icon}.png` };
  }

  await fs.mkdir(ICON_TARGET_DIR, { recursive: true });
  // Always copy + regenerate webp so icon mismatches are corrected
  await fs.copyFile(sourcePng, targetPng);
  await sharp(sourcePng).webp({ quality: 80 }).toFile(targetWebp);
  return { copied: true };
}

interface ItemDiff {
  id: string;
  name: string;
  status: 'new' | 'changed' | 'icon-missing';
  fields?: SyncField[];
  iconMissing?: boolean;
  iconSourceMissing?: boolean;
  current?: Item;
  extracted?: Item;
}

async function diffItems(extracted: Item[], current: Item[]) {
  const byIdCurrent = new Map(current.map(i => [i.id, i]));
  const byIdExtracted = new Map(extracted.map(i => [i.id, i]));

  // Pre-compute icon status for every distinct icon in parallel
  const iconNames = new Set<string>();
  for (const ex of extracted) if (ex.icon) iconNames.add(ex.icon);
  const iconStatus = new Map<string, { hasTarget: boolean; hasSource: boolean }>();
  await Promise.all(
    [...iconNames].map(async name => {
      iconStatus.set(name, await checkIconStatus(name));
    })
  );

  const diffs: ItemDiff[] = [];

  for (const ex of extracted) {
    const cur = byIdCurrent.get(ex.id);
    const ic = ex.icon ? iconStatus.get(ex.icon) : undefined;
    const iconMissing = ex.icon ? !(ic?.hasTarget ?? false) : false;
    const iconSourceMissing = ex.icon ? !(ic?.hasSource ?? false) : false;

    if (!cur) {
      diffs.push({
        id: ex.id, name: ex.name, status: 'new',
        extracted: ex, iconMissing, iconSourceMissing,
      });
      continue;
    }

    const changedFields: SyncField[] = [];
    for (const f of SYNC_FIELDS) {
      if ((cur[f] ?? '') !== (ex[f] ?? '')) changedFields.push(f);
    }

    if (changedFields.length > 0) {
      diffs.push({
        id: ex.id, name: ex.name || cur.name, status: 'changed',
        fields: changedFields, current: cur, extracted: ex,
        iconMissing, iconSourceMissing,
      });
    } else if (iconMissing) {
      // Data identical but icon file missing in public/
      diffs.push({
        id: ex.id, name: ex.name || cur.name, status: 'icon-missing',
        current: cur, extracted: ex, iconMissing, iconSourceMissing,
      });
    }
  }

  let manualCount = 0;
  for (const cur of current) if (!byIdExtracted.has(cur.id)) manualCount++;

  return {
    diffs,
    manualCount,
    totalExtracted: extracted.length,
  };
}

/**
 * Apply data changes to items.json. Returns the updated items array.
 * - scope='all': overwrite all sync fields, add new items
 * - scope='en':  overwrite only EN+icon fields on existing items, add new items (full extracted)
 * - scope='loc': overwrite only locale fields on existing items, do NOT add new items
 *   (new items have no locale-only meaning — adding them would also bring EN content)
 */
function applyDataChanges(
  extracted: Item[],
  current: Item[],
  idsToApply: Set<string> | null,
  scope: Scope,
): Item[] {
  const byIdExtracted = new Map(extracted.map(i => [i.id, i]));
  const byIdCurrent = new Map(current.map(i => [i.id, i]));
  const fields = fieldsForScope(scope);

  const merged: Item[] = [];

  for (const cur of current) {
    const ex = byIdExtracted.get(cur.id);
    if (!ex) { merged.push(cur); continue; }
    const shouldApply = idsToApply === null || idsToApply.has(cur.id);
    if (!shouldApply) { merged.push(cur); continue; }

    const updated: Item = { ...cur };
    for (const f of fields) {
      (updated as Record<string, unknown>)[f] = ex[f];
    }
    merged.push(updated);
  }

  // New items only when scope allows (all/en, since they bring canonical content)
  if (scope !== 'loc') {
    const newItems = extracted.filter(i => {
      if (byIdCurrent.has(i.id)) return false;
      return idsToApply === null || idsToApply.has(i.id);
    });
    newItems.sort((a, b) => {
      const na = Number(a.id), nb = Number(b.id);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.id.localeCompare(b.id);
    });
    merged.push(...newItems);
  }

  return merged;
}

async function writeItemsJson(items: Item[]) {
  const raw = await fs.readFile(ITEMS_PATH, 'utf-8').catch(() => '');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let output = JSON.stringify(items, null, 2) + '\n';
  if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
  await fs.writeFile(ITEMS_PATH, output, 'utf-8');
}

async function loadAll() {
  // Items reference text from TextItem (ITEM_* IDs) AND TextSystem (SYS_* IDs, e.g. event coins)
  const [templet, textItem, textSystem, current] = await Promise.all([
    loadTable<ItemTempletRow>('ItemTemplet'),
    loadTable<TextRow>('TextItem'),
    loadTable<TextRow>('TextSystem'),
    fs.readFile(ITEMS_PATH, 'utf-8').then(s => JSON.parse(s) as Item[]).catch(() => [] as Item[]),
  ]);
  // Merge both lookups; TextItem wins on ID collision (unlikely since prefixes differ)
  const text = buildTextLookup([...textSystem, ...textItem]);
  const extracted = extractFromTemplet(templet, text);
  return { extracted, current };
}

// ── Routes ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    // Default 'full' returns the rich shape used by the items-extractor page.
    // 'compare' / 'list' use dashboard-compatible shapes (matching extractor-v3 endpoints).
    const action = req.nextUrl.searchParams.get('action') ?? 'full';
    const { extracted, current } = await loadAll();

    if (action === 'preview') {
      return NextResponse.json({ items: applyDataChanges(extracted, current, null, 'all') });
    }

    const result = await diffItems(extracted, current);
    const newCount = result.diffs.filter(d => d.status === 'new').length;
    const withDiffs = result.diffs.filter(d => d.status !== 'new').length;
    const total = result.totalExtracted;

    if (action === 'compare') {
      // Dashboard summary: counts existing items needing updates (new items reported via 'list')
      return NextResponse.json({ total, ok: total - withDiffs - newCount, withDiffs });
    }
    if (action === 'list') {
      return NextResponse.json({ new: newCount });
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

interface ApplyBody {
  ids?: string[]; // empty/missing → apply all
  scope?: Scope; // default: 'all'
}

export async function POST(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const body = (await req.json().catch(() => ({}))) as ApplyBody;
    const idsToApply = body.ids && body.ids.length > 0 ? new Set(body.ids) : null;
    const scope: Scope = body.scope === 'en' || body.scope === 'loc' ? body.scope : 'all';

    const { extracted, current } = await loadAll();
    const byIdExtracted = new Map(extracted.map(i => [i.id, i]));

    // Icons are part of EN scope; loc scope skips icon sync entirely
    const iconsToSync = new Set<string>();
    if (scope !== 'loc') {
      const targetIds = idsToApply ?? new Set(extracted.map(i => i.id));
      for (const id of targetIds) {
        const ex = byIdExtracted.get(id);
        if (ex?.icon) iconsToSync.add(ex.icon);
      }
    }

    const iconResults: { icon: string; copied: boolean; warning?: string }[] = [];
    const ICONS = [...iconsToSync];
    const CONCURRENCY = 8;
    for (let i = 0; i < ICONS.length; i += CONCURRENCY) {
      const slice = ICONS.slice(i, i + CONCURRENCY);
      const out = await Promise.all(slice.map(async icon => ({ icon, ...(await syncIcon(icon)) })));
      iconResults.push(...out);
    }

    const merged = applyDataChanges(extracted, current, idsToApply, scope);
    await writeItemsJson(merged);

    const warnings = iconResults.filter(r => r.warning).map(r => r.warning!);
    const iconsCopied = iconResults.filter(r => r.copied).length;

    return NextResponse.json({
      ok: true,
      applied: idsToApply ? idsToApply.size : 'all',
      scope,
      total: merged.length,
      iconsCopied,
      iconsTotal: ICONS.length,
      warnings,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

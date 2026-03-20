/**
 * Talisman extractor API route.
 *
 * Extracts talisman data from ItemTemplet (ITS_EQUIP_OOPARTS).
 * Effect link: ItemEnchantCostRate → ItemSpecialOptionTemplet → BuffTemplet.
 * Upgraded (tier 4) effect can have a completely different description and buff.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  expandLang,
  LANGS, DEFAULT_LANG,
  resolveEnum,
} from '@/app/admin/lib/text';
import {
  loadEquipGameData,
  type EquipGameData,
  resolveEquipPlaceholders,
  getMaxBuffLevel,
  orderKeys,
  detectEol,
  copyEquipImages,
  checkImageExists,
} from '../lib/equip-extractor';

const JSON_PATH = path.join(process.cwd(), 'data', 'equipment', 'talisman.json');

const KEY_ORDER = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'type', 'rarity', 'image',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon',
  'level',
  'source',
  'boss',
  'mode',
];

const COMPARE_FIELDS = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'type', 'rarity', 'image',
  'effect_name', 'effect_name_jp', 'effect_name_kr', 'effect_name_zh',
  'effect_desc1', 'effect_desc1_jp', 'effect_desc1_kr', 'effect_desc1_zh',
  'effect_desc4', 'effect_desc4_jp', 'effect_desc4_kr', 'effect_desc4_zh',
  'effect_icon', 'source', 'mode',
];

type TalismanJson = Record<string, unknown>[];

// ── Helpers ─────────────────────────────────────────────────────────

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ── Extraction ──────────────────────────────────────────────────────

interface ExtractedTalisman {
  id: string;
  extracted: Record<string, unknown>;
}

function extractTalismansFromGameData(gd: EquipGameData): ExtractedTalisman[] {
  const { itemTemplet, textItemMap, textSkillMap, textSystemMap, optById, buffData } = gd;

  // Filter talisman items
  const allTalismans = itemTemplet.data.filter(
    r => r.ItemSubType === 'ITS_EQUIP_OOPARTS'
  );

  // Dedup: keep highest star per name (DescIDSymbol)
  const bestByName = new Map<string, Record<string, string>>();
  for (const row of allTalismans) {
    const nameKey = row.DescIDSymbol ?? row.ID;
    const existing = bestByName.get(nameKey);
    if (!existing || parseInt(row.BasicStar ?? '0') > parseInt(existing.BasicStar ?? '0')) {
      bestByName.set(nameKey, row);
    }
  }

  const results: ExtractedTalisman[] = [];

  for (const row of bestByName.values()) {
    const id = row.ID;
    const nameTexts = textItemMap[row.DescIDSymbol];

    // Effect link: ItemEnchantCostRate → comma-separated special option IDs
    const enchantIds = (row.ItemEnchantCostRate ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const baseOpt = enchantIds[0] ? optById[enchantIds[0]] : undefined;
    const upgradedOpt = enchantIds[1] ? optById[enchantIds[1]] : undefined;

    // Effect name from base option
    const effectNameTexts = baseOpt ? textSkillMap[baseOpt.NameIDSymbol] : undefined;

    // Effect icon
    const effectIcon = baseOpt?.BuffLevel_4P ?? null;

    // Type: CP or AP from BuffID pattern
    const baseBuffId = baseOpt?.BuffID ?? '';
    let type = 'CP';
    if (baseBuffId.includes('_AP_')) type = 'AP';

    // Rarity
    const rarity = resolveEnum(textSystemMap, row.ItemGrade ?? '', 'IG_', 'SYS_ITEM_GRADE_').toLowerCase();

    const extracted: Record<string, unknown> = {
      ...expandLang('name', nameTexts),
      type,
      rarity,
      image: row.IconName ?? '',
      ...expandLang('effect_name', effectNameTexts, null as unknown as string),
    };

    // Effect desc1 (base, Level=1)
    if (baseOpt) {
      const descSymbol = baseOpt.CustomCraftDescIDSymbol ?? baseOpt.DescID;
      const descTexts = descSymbol ? textSkillMap[descSymbol] : undefined;
      const buffIdStr = baseOpt.BuffID ?? '';

      for (const lang of LANGS) {
        const key = lang === DEFAULT_LANG ? 'effect_desc1' : `effect_desc1_${lang}`;
        if (descTexts && buffIdStr && buffIdStr !== 'OAT_NONE') {
          const raw = descTexts[lang] ?? '';
          extracted[key] = resolveEquipPlaceholders(raw, buffData, buffIdStr, 1);
        } else {
          extracted[key] = null;
        }
      }
    } else {
      for (const lang of LANGS) {
        const key = lang === DEFAULT_LANG ? 'effect_desc1' : `effect_desc1_${lang}`;
        extracted[key] = null;
      }
    }

    // Effect desc4 (upgraded, Level=10) — completely different description and buff
    if (upgradedOpt && upgradedOpt.BuffID && upgradedOpt.BuffID !== 'OAT_NONE') {
      const descSymbol = upgradedOpt.CustomCraftDescIDSymbol ?? upgradedOpt.DescID;
      const descTexts = descSymbol ? textSkillMap[descSymbol] : undefined;
      const buffIdStr = upgradedOpt.BuffID;

      const maxLevel = getMaxBuffLevel(buffData, buffIdStr);

      for (const lang of LANGS) {
        const key = lang === DEFAULT_LANG ? 'effect_desc4' : `effect_desc4_${lang}`;
        if (descTexts && buffIdStr) {
          const raw = descTexts[lang] ?? '';
          extracted[key] = resolveEquipPlaceholders(raw, buffData, buffIdStr, maxLevel);
        } else {
          extracted[key] = null;
        }
      }
    } else {
      // No upgraded effect
      for (const lang of LANGS) {
        const key = lang === DEFAULT_LANG ? 'effect_desc4' : `effect_desc4_${lang}`;
        extracted[key] = null;
      }
    }

    extracted.effect_icon = effectIcon;
    extracted.level = row.BasicStar ?? '1';
    extracted.source = null;
    extracted.boss = null;
    extracted.mode = null;

    results.push({ id, extracted });
  }

  results.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  return results;
}

// ── Load existing JSON (array format) ───────────────────────────────

async function loadExisting(): Promise<{ raw?: string; data: TalismanJson }> {
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
    const talismans = extractTalismansFromGameData(gd);
    const { data: existing } = await loadExisting();

    if (action === 'list') {
      const existingNames = new Set(existing.map(e => String(e.name ?? '')));

      const entries = talismans.map(t => ({
        ...t.extracted,
        id: t.id,
        existsInJson: existingNames.has(String(t.extracted.name ?? '')),
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

      for (const t of talismans) {
        const name = String(t.extracted.name ?? '');
        const prev = existingByName.get(name);
        if (!prev) continue;

        const diffs: { field: string; existing: string; extracted: string }[] = [];

        for (const field of COMPARE_FIELDS) {
          const ext = String(t.extracted[field] ?? '');
          const cur = String(prev[field] ?? '');
          if (ext && cur && ext !== cur) {
            diffs.push({ field, existing: cur, extracted: ext });
          }
        }

        // Compare boss
        const extBoss = JSON.stringify(t.extracted.boss ?? null);
        const curBoss = JSON.stringify(prev.boss ?? null);
        if (extBoss !== curBoss) {
          diffs.push({ field: 'boss', existing: curBoss, extracted: extBoss });
        }

        // Check images
        const image = String(t.extracted.image ?? '');
        const effectIcon = String(t.extracted.effect_icon ?? '');
        if (image && !(await checkImageExists('equip', image))) {
          diffs.push({ field: 'image (file)', existing: '(missing)', extracted: `${image}.png` });
        }
        if (effectIcon && !(await checkImageExists('effect', effectIcon))) {
          diffs.push({ field: 'effect_icon (file)', existing: '(missing)', extracted: `${effectIcon}.png` });
        }

        if (diffs.length > 0) results.push({ id: t.id, name, diffs });
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
    const talismans = extractTalismansFromGameData(gd);
    const talismanById = new Map(talismans.map(t => [t.id, t]));

    let saved = 0;
    for (const id of ids) {
      const t = talismanById.get(id);
      if (!t) continue;

      const name = String(t.extracted.name ?? '');
      const idx = existing.findIndex(e => String(e.name ?? '') === name);

      const ordered = orderKeys(t.extracted as Record<string, unknown>, KEY_ORDER);

      if (idx >= 0) {
        existing[idx] = ordered;
      } else {
        existing.push(ordered);
      }

      // Copy images
      const image = String(t.extracted.image ?? '');
      const effectIcon = String(t.extracted.effect_icon ?? '');
      await copyEquipImages(image, effectIcon);

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

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  GAME_LANGS, DEFAULT_LANG, GAME_SUFFIX_LANGS, type GameLang, type LangTexts,
  readTemplet, buildTextMap, resolveEnum, emptyLang, mapLang,
  buildBuffIndex, resolveBuffPlaceholders,
} from '@/app/admin/lib/text-v2';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get('action') ?? 'list';

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
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Shared helpers ──────────────────────────────────────────────────

/** Get all Skill_{n} IDs from a character row */
function getSkillIds(charRow: Record<string, string>): string[] {
  const ids: string[] = [];
  for (let i = 1; i <= 23; i++) {
    const sid = charRow[`Skill_${i}`];
    if (sid) ids.push(sid);
  }
  return ids;
}

const WANTED_SKILL_TYPES = new Set([
  'SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE',
]);

const TARGET_MAP: Record<string, string | null> = {
  SINGLE: 'mono', ALL: 'multi', DOUBLE: 'duo', DOUBLE_SPEED: 'duo', NONE: null,
};

function resolveTarget(rangeType: string): string | string[] | null {
  const parts = rangeType.split(',').map(p => p.trim()).filter(Boolean);
  const mapped = parts.map(p => TARGET_MAP[p] ?? p).filter((v): v is string => v != null);
  if (mapped.length === 0) return null;
  const unique = [...new Set(mapped)];
  return unique.length === 1 ? unique[0] : unique;
}

/** Collect buff/debuff from BuffTemplet for given BuffIDs */
function extractBuffDebuff(
  buffIds: string[],
  buffData: Record<string, string>[],
): { buff: string[]; debuff: string[] } {
  const buffs = new Set<string>();
  const debuffs = new Set<string>();

  for (const bid of buffIds) {
    for (const row of buffData) {
      if (row.BuffID !== bid) continue;
      const type = row.Type ?? '';
      const statType = row.StatType ?? '';
      const bdType = row.BuffDebuffType ?? '';
      if (!type) continue;
      const tag = type === 'BT_STAT' && statType && statType !== 'ST_NONE' ? `${type}|${statType}` : type;
      if (bdType === 'BUFF') buffs.add(tag);
      else if (bdType.startsWith('DEBUFF')) debuffs.add(tag);
      break;
    }
  }

  return { buff: [...buffs], debuff: [...debuffs] };
}

/** Split a BuffID field (comma-separated) into individual IDs */
function parseBuffIds(buffIdField: string): string[] {
  return buffIdField.split(',').map(s => s.trim()).filter(Boolean);
}

/** Collect all unique BuffIDs from skill level rows */
function collectBuffIds(levels: Record<string, string>[]): string[] {
  const ids = new Set<string>();
  for (const lv of levels) {
    for (const bid of parseBuffIds(lv.BuffID ?? '')) ids.add(bid);
  }
  return [...ids];
}

/** Collect BuffIDs by pattern from BuffTemplet (e.g. "2000001_chain_") */
function collectBuffIdsByPattern(charId: string, pattern: string, buffData: Record<string, string>[]): string[] {
  const prefix = `${charId}_${pattern}_`;
  const ids = new Set<string>();
  for (const row of buffData) {
    if (row.BuffID?.startsWith(prefix)) ids.add(row.BuffID);
  }
  return [...ids];
}


// ── Tag detection ───────────────────────────────────────────────────

function detectTags(
  charId: string,
  recruitData: Record<string, string>[],
  extraData: Record<string, string>[],
): string[] {
  const tags: string[] = [];

  const banner = recruitData.find(r => r.PickupID === charId);
  if (banner) {
    const type = banner.RecruitType ?? '';
    if (type === 'DEMIURGE') tags.push('premium');
    else if (type === 'OUTER_FES') tags.push('limited');
    else if (type === 'SEASONAL') {
      tags.push(banner.BannerImageName?.includes('Collabo') ? 'collab' : 'seasonal');
    }
  } else {
    const extra = extraData.find(r => r.CharacterID === charId);
    if (extra?.ThumbnailEffect === 'FX_UI_Character_List_Dungeon') tags.push('collab');
  }

  if (charId.startsWith('2700')) tags.push('core-fusion');
  return tags;
}

const TAG_ORDER = ['premium', 'seasonal', 'limited', 'collab', 'ignore-defense', 'free', 'core-fusion'];
function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const ia = TAG_ORDER.indexOf(a);
    const ib = TAG_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

// ── Character extraction ────────────────────────────────────────────

function extractCharacter(
  row: Record<string, string>,
  textMap: Record<string, LangTexts>,
  sysMap: Record<string, LangTexts>,
  showNickIds: Set<string>,
  chainData: Record<string, string>[],
  trustData: Record<string, string>[],
  recruitData: Record<string, string>[],
  extraData: Record<string, string>[],
) {
  const id = row.ID;

  const name = textMap[row.NameID ?? ''];
  const nick = showNickIds.has(id) ? textMap[row.NickNameID ?? ''] : undefined;
  const fusionTitle = id.startsWith('2700') ? sysMap['SYS_CHARACTER_FUSION_TITLE'] : undefined;

  const fullname = mapLang(lang => {
    const n = name?.[lang] ?? '';
    if (fusionTitle) return `${fusionTitle[lang] ?? ''} ${n}`.trim();
    if (nick) return `${nick[lang] ?? ''} ${n}`.trim();
    return n;
  });

  const vaGeneric = textMap[row.CVNameID ?? ''];
  const vaByLang: Record<string, LangTexts | undefined> = {};
  for (const lang of GAME_LANGS) {
    vaByLang[lang] = textMap[`${id}_CVName_${lang}`];
  }

  // Chain_Type from ChainCombinationTemplet.Sequence: 0=Start, 1/2=Join, 3=Finish
  const chainComboRow = chainData.find(r => r.ID === id);
  const seq = parseInt(chainComboRow?.Sequence ?? '');
  const validChainType = isNaN(seq) ? null : seq === 0 ? 'Start' : seq === 3 ? 'Finish' : 'Join';

  // Gift from TrustTemplet → resolve via TextSystem (SYS_ITS_PRESENT_01 → "Science")
  const trustRow = trustData.find(r => r.ID === id);
  const giftKey = trustRow?.PresentTypeLike ?? '';
  const gift = giftKey ? (sysMap[`SYS_${giftKey}`]?.en ?? null) : null;

  // Tags
  const tags = sortTags(detectTags(id, recruitData, extraData));

  return {
    ID: id,
    Fullname: fullname,
    Rarity: parseInt(row.BasicStar) || 0,
    Element: resolveEnum(sysMap, row.Element ?? '', 'CET_', 'SYS_ELEMENT_') ?? emptyLang(),
    Class: resolveEnum(sysMap, row.Class ?? '', 'CCT_', 'SYS_CLASS_') ?? emptyLang(),
    SubClass: resolveEnum(sysMap, row.SubClass ?? '', '', 'SYS_CLASS_NAME_') ?? emptyLang(),
    VoiceActor: mapLang(lang => vaByLang[lang]?.[lang] || vaByLang.jp?.[lang] || vaGeneric?.[lang] || ''),
    Chain_Type: validChainType,
    gift,
    tags,
  };
}

// ── Transcend extraction ────────────────────────────────────────────

function extractTranscend(
  charRow: Record<string, string>,
  transcendData: Record<string, string>[],
  skillData: Record<string, string>[],
  skillLevelData: Record<string, string>[],
  textSkillMap: Record<string, LangTexts>,
): Record<string, string | null> {
  const id = charRow.ID;
  const rarity = parseInt(charRow.BasicStar) || 0;

  const charSpecific = transcendData.filter(r => r.CharacterID === id);
  const steps = charSpecific.length > 0
    ? charSpecific
    : transcendData.filter(r => r.CharacterID === '0' && r.BasicStar === String(rarity));

  steps.sort((a, b) => (parseInt(a.UseTransStar) || 0) - (parseInt(b.UseTransStar) || 0));

  // Find unique passive skill and its level descriptions
  const skillIds = getSkillIds(charRow);
  let uniquePassiveId: string | null = null;
  for (const row of skillData) {
    if (row.SkillType === 'SKT_UNIQUE_PASSIVE' && row.ID && skillIds.includes(row.ID)) {
      uniquePassiveId = row.ID;
      break;
    }
  }

  const transcendDescs = new Map<number, string[]>();
  if (uniquePassiveId) {
    for (const row of skillLevelData) {
      if (row.SkillID !== uniquePassiveId) continue;
      const sl = parseInt(row.SkillLevel) || 0;
      if (sl <= 0) continue;
      const descId = row.DescID ?? '';
      if (!descId) continue;
      const keys = descId.split(',').map(d => d.trim()).filter(Boolean);
      if (keys.length > 0) transcendDescs.set(sl, keys);
    }
  }

  const hasSubSteps = rarity >= 3;
  const grouped = new Map<string, typeof steps>();
  for (const step of steps) {
    const showUI = step.ShowUIStar ?? '';
    const arr = grouped.get(showUI) ?? [];
    arr.push(step);
    grouped.set(showUI, arr);
  }

  const transcend: Record<string, string | null> = {};
  let lastDescSkillLevel = 0;

  for (const [showUI, group] of grouped) {
    const useSubIndex = hasSubSteps && group.length > 1;
    for (let i = 0; i < group.length; i++) {
      const step = group[i];
      if (!hasSubSteps && i > 0) continue;

      const key = useSubIndex ? `${showUI}_${i + 1}` : showUI;
      const hpRate = parseInt(step.RewardHPRate) || 0;
      const skillLevel = parseInt(step.SkillLevel) || 0;

      if (hpRate === 0 && skillLevel === 0) {
        transcend[key] = null;
        continue;
      }

      const lines: Record<GameLang, string[]> = {} as Record<GameLang, string[]>;
      for (const lang of GAME_LANGS) lines[lang] = [];

      if (hpRate > 0) {
        const pct = `ATK DEF HP +${hpRate / 10}%`;
        for (const lang of GAME_LANGS) lines[lang].push(pct);
      }

      // SkillLevel 1 = "Burst Level 2 Unlocked" — always skip
      if (skillLevel > 1 && skillLevel > lastDescSkillLevel) {
        lastDescSkillLevel = skillLevel;
        const descKeys = transcendDescs.get(skillLevel);
        if (descKeys) {
          for (const descKey of descKeys) {
            const texts = textSkillMap[descKey];
            if (!texts) continue;
            for (const lang of GAME_LANGS) {
              const txt = texts[lang];
              if (txt) lines[lang].push(txt.replace(/\\n/g, '\n').trim());
            }
          }
        }
      }

      const defaultLines = lines[DEFAULT_LANG];
      transcend[key] = defaultLines.length > 0 ? defaultLines.join('\n') : null;

      for (const lang of GAME_SUFFIX_LANGS) {
        const langLines = lines[lang];
        if (langLines.length > 1 || (langLines.length === 1 && langLines[0] !== defaultLines[0])) {
          transcend[`${key}_${lang}`] = langLines.join('\n');
        }
      }
    }
  }

  return transcend;
}

// ── Skill extraction ────────────────────────────────────────────────

interface ExtractedSkill {
  [key: string]: unknown;
  NameIDSymbol: string;
  IconName: string;
  SkillType: string;
  name: LangTexts;
  true_desc_levels: Record<string, string>;
  enhancement: Record<string, string[]>;
  wgr: number | null;
  cd: number | null;
  offensive: boolean;
  target: string | string[] | null;
  buff: string[];
  debuff: string[];
}

function extractSkills(
  charRow: Record<string, string>,
  skillData: Record<string, string>[],
  skillLevelData: Record<string, string>[],
  buffData: Record<string, string>[],
  textSkillMap: Record<string, LangTexts>,
  buffIndex: Map<string, Map<number, Record<string, string>>>,
): Record<string, ExtractedSkill> {
  const id = charRow.ID;
  const skillIds = getSkillIds(charRow);

  // Index skill rows and level rows by skill ID
  const skillById = new Map<string, Record<string, string>>();
  for (const row of skillData) {
    if (row.ID && skillIds.includes(row.ID)) skillById.set(row.ID, row);
  }
  const levelsBySid = new Map<string, Record<string, string>[]>();
  for (const row of skillLevelData) {
    if (row.SkillID && skillIds.includes(row.SkillID)) {
      const arr = levelsBySid.get(row.SkillID) ?? [];
      arr.push(row);
      levelsBySid.set(row.SkillID, arr);
    }
  }

  const skills: Record<string, ExtractedSkill> = {};

  for (const [sid, sRow] of skillById) {
    const skillType = sRow.SkillType;
    if (!skillType || !WANTED_SKILL_TYPES.has(skillType)) continue;

    const nameKey = sRow.SkipNameID ?? sRow.NameID ?? '';
    const name = textSkillMap[nameKey] ?? emptyLang();

    // Descriptions per level from DescID on skill row (comma-separated, one per level)
    const descLevels: Record<string, string> = {};
    const descSymbols = (sRow.DescID ?? '').split(',').map(s => s.trim()).filter(Boolean);
    for (let lvl = 0; lvl < descSymbols.length; lvl++) {
      const texts = textSkillMap[descSymbols[lvl]];
      if (!texts) continue;
      const skillLv = lvl + 1;
      descLevels[String(skillLv)] = resolveBuffPlaceholders(texts[DEFAULT_LANG], skillLv, buffIndex);
      for (const lang of GAME_SUFFIX_LANGS) {
        if (texts[lang]) descLevels[`${skillLv}_${lang}`] = resolveBuffPlaceholders(texts[lang], skillLv, buffIndex);
      }
    }

    // Skill levels
    const levels = levelsBySid.get(sid) ?? [];
    const firstLevel = levels[0];

    // CD from StartCool
    const hasCd = skillType === 'SKT_SECOND' || skillType === 'SKT_ULTIMATE';
    const rawCd = hasCd ? firstLevel?.StartCool ?? '' : '';
    const cd = /^\d+$/.test(rawCd) ? parseInt(rawCd) : null;

    // WGReduce
    const offensive = (sRow.TargetTeamType ?? '').includes('ENEMY');
    const rawWgr = parseInt(firstLevel?.WGReduce ?? '0') || 0;
    const wgr = offensive ? rawWgr : null;

    // Enhancement from DescID field in level rows (levels 2+)
    const enhancement: Record<string, string[]> = {};
    for (const lv of levels) {
      const lvNum = lv.SkillLevel ?? '1';
      if (lvNum === '1') continue;
      const descId = lv.DescID ?? '';
      if (!descId) continue;
      const descs = descId.split(',').map(d => d.trim()).filter(Boolean);
      if (descs.length === 0) continue;
      enhancement[lvNum] = descs.map(d => textSkillMap[d]?.[DEFAULT_LANG] ?? d);
      for (const lang of GAME_SUFFIX_LANGS) {
        const langDescs = descs.map(d => textSkillMap[d]?.[lang] ?? '').filter(Boolean);
        if (langDescs.length > 0) enhancement[`${lvNum}_${lang}`] = langDescs;
      }
    }

    const isChain = skillType === 'SKT_CHAIN_PASSIVE';

    // Buff/debuff: chain passive uses pattern in BuffTemplet, others use BuffID from levels
    const bd = isChain
      ? extractBuffDebuff(collectBuffIdsByPattern(id, 'chain', buffData), buffData)
      : extractBuffDebuff(collectBuffIds(levels), buffData);

    const entry: ExtractedSkill = {
      NameIDSymbol: sid,
      IconName: sRow.IconName ?? '',
      SkillType: skillType,
      name,
      true_desc_levels: descLevels,
      enhancement,
      wgr: isChain ? 3 : wgr,
      cd,
      offensive: isChain ? true : offensive,
      target: isChain ? 'multi' : resolveTarget(sRow.RangeType ?? ''),
      buff: bd.buff,
      debuff: bd.debuff,
    };

    // Chain passive: dual attack from backup pattern in BuffTemplet
    if (isChain) {
      const dualBD = extractBuffDebuff(collectBuffIdsByPattern(id, 'backup', buffData), buffData);
      entry.wgr_dual = 1;
      entry.dual_offensive = true;
      entry.dual_target = 'mono';
      entry.dual_buff = dualBD.buff;
      entry.dual_debuff = dualBD.debuff;
    }

    skills[skillType] = entry;
  }

  // Burst skills (burnEffect) — attach to the skill that has RequireAP=int,int,int
  const burstTypes = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'] as const;
  const burstRows: Record<string, Record<string, string>> = {};
  for (const [, sRow] of skillById) {
    if (burstTypes.includes(sRow.SkillType as typeof burstTypes[number])) {
      burstRows[sRow.SkillType] = sRow;
    }
  }

  if (Object.keys(burstRows).length > 0) {
    // Find the parent skill with RequireAP
    let burnTarget: string | null = null;
    let burstCosts: number[] = [];
    for (const [, sRow] of skillById) {
      const rap = sRow.RequireAP ?? '';
      if (/^\d+,\d+,\d+$/.test(rap)) {
        burnTarget = sRow.SkillType;
        burstCosts = rap.split(',').map(Number);
        break;
      }
    }

    if (burnTarget && skills[burnTarget]) {
      const burnEffect: Record<string, unknown> = {};
      const targetSkill = skills[burnTarget];
      const mainBuffs = new Set(targetSkill.buff);
      const mainDebuffs = new Set(targetSkill.debuff);

      for (let bi = 0; bi < burstTypes.length; bi++) {
        const bRow = burstRows[burstTypes[bi]];
        if (!bRow) continue;

        const bDescKey = bRow.DescID ?? '';
        const bNames = textSkillMap[bDescKey] ?? emptyLang();

        burnEffect[burstTypes[bi]] = {
          effect: bNames,
          cost: burstCosts[bi] ?? null,
          level: bi + 1,
          offensive: (bRow.TargetTeamType ?? '').includes('ENEMY'),
          target: resolveTarget(bRow.RangeType ?? ''),
        };

        // Merge burst buff/debuff into parent
        const bLevels = levelsBySid.get(bRow.ID) ?? [];
        const bBD = extractBuffDebuff(collectBuffIds(bLevels), buffData);
        for (const b of bBD.buff) mainBuffs.add(b);
        for (const d of bBD.debuff) mainDebuffs.add(d);
      }

      targetSkill.burnEffect = burnEffect;
      targetSkill.buff = [...mainBuffs];
      targetSkill.debuff = [...mainDebuffs];
    }
  }

  return skills;
}

// ── List ─────────────────────────────────────────────────────────────

async function handleList() {
  const [charData, textChar, textSys, extraData, chainData, trustData, recruitData] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('ChainCombinationTemplet'),
    readTemplet('TrustTemplet'),
    readTemplet('RecruitGroupTemplet'),
  ]);

  const textMap = buildTextMap(textChar);
  const sysMap = buildTextMap(textSys);
  const showNickIds = new Set(extraData.filter(r => r.ShowNickName === 'True').map(r => r.CharacterID));

  const characters: { id: string; name: string; element: string; class: string; rarity: number; exists: boolean }[] = [];

  const existingDir = path.join(process.cwd(), 'data', 'character');
  let existingIds = new Set<string>();
  try {
    const files = await fs.readdir(existingDir);
    existingIds = new Set(files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));
  } catch { /* */ }

  for (const row of charData) {
    if (row.Type !== 'CT_PC') continue;
    const id = row.ID ?? '';
    if (!id.startsWith('2000') && !id.startsWith('2700')) continue;

    const extracted = extractCharacter(row, textMap, sysMap, showNickIds, chainData, trustData, recruitData, extraData);
    characters.push({
      id,
      name: extracted.Fullname.en,
      element: extracted.Element.en,
      class: extracted.Class.en,
      rarity: extracted.Rarity,
      exists: existingIds.has(id),
    });
  }

  characters.sort((a, b) => a.id.localeCompare(b.id));
  return NextResponse.json({ characters });
}

// ── Compare ─────────────────────────────────────────────────────────

/** Compare a LangTexts field against existing suffixed keys (e.g. Fullname, Fullname_jp...) */
function compareLangField(
  fieldName: string,
  extracted: LangTexts,
  existing: Record<string, unknown>,
  diffs: { field: string; existing: string; extracted: string }[],
) {
  const keys: [string, GameLang][] = [
    [fieldName, 'en' as GameLang],
    ...GAME_SUFFIX_LANGS.map(l => [`${fieldName}_${l}`, l] as [string, GameLang]),
  ];
  for (const [existKey, lang] of keys) {
    const e = String(existing[existKey] ?? '');
    const a = extracted[lang];
    if (e && a && e !== a) diffs.push({ field: existKey, existing: e, extracted: a });
  }
}

async function handleCompare() {
  const [charData, textChar, textSys, textSkill, extraData, skillData, skillLevelData, buffData, trustData, recruitData, transcendData, chainData] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('TextSkill'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('CharacterSkillLevelTemplet'),
    readTemplet('BuffTemplet'),
    readTemplet('TrustTemplet'),
    readTemplet('RecruitGroupTemplet'),
    readTemplet('CharacterTranscendentTemplet'),
    readTemplet('ChainCombinationTemplet'),
  ]);

  const textMap = buildTextMap(textChar);
  const sysMap = buildTextMap(textSys);
  const textSkillMap = buildTextMap(textSkill);
  const showNickIds = new Set(extraData.filter(r => r.ShowNickName === 'True').map(r => r.CharacterID));
  const buffIndex = buildBuffIndex(buffData);

  const charById = new Map<string, Record<string, string>>();
  for (const row of charData) {
    if (row.ID) charById.set(row.ID, row);
  }

  const existingDir = path.join(process.cwd(), 'data', 'character');
  let existingFiles: string[] = [];
  try {
    existingFiles = (await fs.readdir(existingDir)).filter(f => f.endsWith('.json'));
  } catch { /* */ }

  const results: { id: string; name: string; diffs: { field: string; existing: string; extracted: string }[] }[] = [];

  for (const file of existingFiles) {
    const id = file.replace('.json', '');
    const charRow = charById.get(id);
    if (!charRow) continue;

    const raw = await fs.readFile(path.join(existingDir, file), 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: Record<string, any> = JSON.parse(raw);
    const extracted = extractCharacter(charRow, textMap, sysMap, showNickIds, chainData, trustData, recruitData, extraData);
    const extractedSkills = extractSkills(charRow, skillData, skillLevelData, buffData, textSkillMap, buffIndex);
    const extractedTranscend = extractTranscend(charRow, transcendData, skillData, skillLevelData, textSkillMap);

    const diffs: { field: string; existing: string; extracted: string }[] = [];

    // ── Character fields ──
    compareLangField('Fullname', extracted.Fullname, existing, diffs);

    if (existing.Rarity != null && existing.Rarity !== extracted.Rarity) {
      diffs.push({ field: 'Rarity', existing: String(existing.Rarity), extracted: String(extracted.Rarity) });
    }

    for (const field of ['Element', 'Class', 'SubClass'] as const) {
      const e = String(existing[field] ?? '');
      const a = extracted[field].en;
      if (e && a && e !== a) diffs.push({ field, existing: e, extracted: a });
    }

    compareLangField('VoiceActor', extracted.VoiceActor, existing, diffs);

    // Chain_Type, gift
    for (const field of ['Chain_Type', 'gift'] as const) {
      const e = String(existing[field] ?? '');
      const a = String(extracted[field] ?? '');
      if (e && a && e !== a) diffs.push({ field, existing: e, extracted: a });
    }

    // Tags
    const existingTags = Array.isArray(existing.tags) ? [...existing.tags].sort().join(', ') : '';
    const extractedTags = [...new Set([...extracted.tags, ...(Array.isArray(existing.tags) && existing.tags.includes('free') ? ['free'] : [])])].sort().join(', ');
    if (existingTags && extractedTags && existingTags !== extractedTags) {
      diffs.push({ field: 'tags', existing: existingTags, extracted: extractedTags });
    }

    // ── Skills ──
    const SKILL_KEYS = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE'];
    for (const sk of SKILL_KEYS) {
      const existingSkill = existing.skills?.[sk];
      const extractedSkill = extractedSkills[sk];
      if (!existingSkill || !extractedSkill) continue;

      // Name
      compareLangField(`${sk}.name`, extractedSkill.name, existingSkill, diffs);

      // Scalar fields
      for (const f of ['wgr', 'cd', 'offensive', 'target', 'wgr_dual', 'dual_offensive', 'dual_target']) {
        if (!(f in existingSkill)) continue;
        const e = String(existingSkill[f] ?? '');
        const a = String((extractedSkill as Record<string, unknown>)[f] ?? '');
        if (e !== a) diffs.push({ field: `${sk}.${f}`, existing: e, extracted: a });
      }

      // Array fields (buff, debuff, dual_buff, dual_debuff)
      for (const af of ['buff', 'debuff', 'dual_buff', 'dual_debuff']) {
        if (!(af in existingSkill)) continue;
        const eArr = JSON.stringify((existingSkill[af] ?? []).slice().sort());
        const aArr = JSON.stringify(((extractedSkill as Record<string, unknown>)[af] as string[] ?? []).slice().sort());
        if (eArr !== aArr) {
          diffs.push({
            field: `${sk}.${af}`,
            existing: (existingSkill[af] ?? []).join(', '),
            extracted: ((extractedSkill as Record<string, unknown>)[af] as string[] ?? []).join(', '),
          });
        }
      }

      // Desc levels
      const descSymbols = (skillData.find(s => s.ID === existingSkill.NameIDSymbol)?.DescID ?? '').split(',').map(s => s.trim());
      for (let lvl = 0; lvl < descSymbols.length; lvl++) {
        const sym = descSymbols[lvl];
        if (!sym) continue;
        const texts = textSkillMap[sym];
        if (!texts) continue;
        const skillLv = lvl + 1;

        const resolved = resolveBuffPlaceholders(texts[DEFAULT_LANG], skillLv, buffIndex);
        const existingDesc = existingSkill.true_desc_levels?.[String(skillLv)] ?? '';
        if (existingDesc && resolved && existingDesc !== resolved) {
          diffs.push({ field: `${sk}.desc_lv${skillLv}`, existing: existingDesc, extracted: resolved });
        }

        for (const lang of GAME_SUFFIX_LANGS) {
          const resolvedLang = resolveBuffPlaceholders(texts[lang], skillLv, buffIndex);
          const existingLang = existingSkill.true_desc_levels?.[`${skillLv}_${lang}`] ?? '';
          if (existingLang && resolvedLang && existingLang !== resolvedLang) {
            diffs.push({ field: `${sk}.desc_lv${skillLv}_${lang}`, existing: existingLang, extracted: resolvedLang });
          }
        }
      }

      // Enhancement
      const existingEnh = existingSkill.enhancement ?? {};
      for (const k of Object.keys(existingEnh)) {
        const eVal = JSON.stringify(existingEnh[k] ?? null);
        const aVal = JSON.stringify(extractedSkill.enhancement[k] ?? null);
        if (eVal !== aVal) {
          diffs.push({ field: `${sk}.enh_${k}`, existing: existingEnh[k]?.join(', ') ?? '', extracted: extractedSkill.enhancement[k]?.join(', ') ?? '' });
        }
      }

      // burnEffect
      if (existingSkill.burnEffect && extractedSkill.burnEffect) {
        for (const bt of ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3']) {
          const exBurst = existingSkill.burnEffect[bt] ?? {};
          const extrBurst = ((extractedSkill.burnEffect as Record<string, Record<string, unknown>>)[bt] ?? {});
          if (!exBurst || !extrBurst) continue;

          // Compare effect (multilang)
          const extrEffect = (extrBurst.effect ?? emptyLang()) as LangTexts;
          const effectKeys: [string, GameLang][] = [
            ['effect', 'en' as GameLang],
            ...GAME_SUFFIX_LANGS.map(l => [`effect_${l}`, l] as [string, GameLang]),
          ];
          for (const [existKey, lang] of effectKeys) {
            const e = String(exBurst[existKey] ?? '');
            const a = extrEffect[lang] ?? '';
            if (e && a && e !== a) diffs.push({ field: `${sk}.burn.${bt}.${existKey}`, existing: e, extracted: a });
          }

          // Compare scalar fields
          for (const bf of ['cost', 'level', 'offensive', 'target']) {
            const e = String(exBurst[bf] ?? '');
            const a = String(extrBurst[bf] ?? '');
            if (e !== a) diffs.push({ field: `${sk}.burn.${bt}.${bf}`, existing: e, extracted: a });
          }
        }
      }
    }

    // ── Transcend ──
    const existingTranscend = existing.transcend ?? {};
    const allTranscendKeys = new Set([...Object.keys(existingTranscend), ...Object.keys(extractedTranscend)]);
    for (const k of allTranscendKeys) {
      const ev = existingTranscend[k] ?? null;
      const av = extractedTranscend[k] ?? null;
      if (ev === null && av === null) continue;
      if (String(ev ?? '') !== String(av ?? '')) {
        diffs.push({ field: `transcend.${k}`, existing: String(ev ?? ''), extracted: String(av ?? '') });
      }
    }

    if (diffs.length > 0) {
      results.push({ id, name: existing.Fullname ?? id, diffs });
    }
  }

  return NextResponse.json({
    total: existingFiles.length,
    withDiffs: results.length,
    ok: existingFiles.length - results.length,
    results,
  });
}

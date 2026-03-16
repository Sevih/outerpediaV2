import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang, type LangTexts,
  buildTextMap, expandLang,
  resolveElement, resolveClass, resolveSubClass,
  buildBuffIndex, resolveBuffPlaceholders,
  resolveTarget, GIFT_MAP, resolveChainType, NON_OFFENSIVE_OVERRIDE,
  BASIC_STAR_OVERRIDE,
} from '@/app/admin/lib/config';

const JSON_DIR = path.join(process.cwd(), 'data', 'admin', 'json');

/** Read and parse one of the admin JSON templet files */
async function readTemplet(name: string): Promise<{ columns: Record<string, string>; data: Record<string, string>[] }> {
  const raw = await fs.readFile(path.join(JSON_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

// ── Key order for output JSON ────────────────────────────────────────

const TOP_LEVEL_KEY_ORDER = [
  'ID', 'Fullname', 'Fullname_jp', 'Fullname_kr', 'Fullname_zh',
  'Rarity', 'Element', 'Class', 'SubClass',
  'rank', 'rank_pvp', 'role', 'tags', 'skill_priority',
  'Chain_Type', 'gift', 'video',
  'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
  'transcend', 'skills',
];

const SKILL_KEY_ORDER = [
  'NameIDSymbol', 'IconName', 'SkillType',
  'name', 'name_jp', 'name_kr', 'name_zh',
  'true_desc', 'true_desc_jp', 'true_desc_kr', 'true_desc_zh',
  'true_desc_levels', 'enhancement',
  'wgr', 'cd', 'buff', 'debuff', 'offensive', 'target',
];

/**
 * Reorder keys grouped by language: all EN first, then JP, then KR, then ZH.
 * Input:  { "1": ..., "1_jp": ..., "2": ..., "2_jp": ..., "1_kr": ... }
 * Output: { "1": ..., "2": ..., "1_jp": ..., "2_jp": ..., "1_kr": ..., "2_kr": ..., "1_zh": ..., "2_zh": ... }
 */
function groupByLang(obj: Record<string, string>): Record<string, string> {
  const langSuffixes = SUFFIX_LANGS.map(l => `_${l}`);

  // Separate keys by language group
  const defaultKeys: string[] = [];
  const langGroups: Record<string, string[]> = {};
  for (const lang of SUFFIX_LANGS) langGroups[lang] = [];

  for (const key of Object.keys(obj)) {
    const matchedLang = SUFFIX_LANGS.find(l => key.endsWith(`_${l}`));
    if (matchedLang) {
      langGroups[matchedLang].push(key);
    } else {
      defaultKeys.push(key);
    }
  }

  // Sort each group naturally
  const naturalSort = (a: string, b: string) => {
    const strip = (k: string) => langSuffixes.reduce((s, sf) => s.endsWith(sf) ? s.slice(0, -sf.length) : s, k);
    const pa = strip(a).split('_').map(Number);
    const pb = strip(b).split('_').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  defaultKeys.sort(naturalSort);
  for (const lang of SUFFIX_LANGS) langGroups[lang].sort(naturalSort);

  const result: Record<string, string> = {};
  for (const key of defaultKeys) result[key] = obj[key];
  for (const lang of SUFFIX_LANGS) {
    for (const key of langGroups[lang]) result[key] = obj[key];
  }
  return result;
}

/** Reorder an object's keys according to a specified order, keeping extra keys at the end */
function orderKeys<T extends Record<string, unknown>>(obj: T, keyOrder: string[]): T {
  const ordered = {} as Record<string, unknown>;
  for (const key of keyOrder) {
    if (key in obj) ordered[key] = obj[key];
  }
  // Append any extra keys not in the order
  for (const key of Object.keys(obj)) {
    if (!(key in ordered)) ordered[key] = obj[key];
  }
  return ordered as T;
}

/**
 * GET /api/admin/extractor
 *
 * ?action=list                → list of characters from CharacterTemplet (CT_PC only)
 * ?action=info&id=2000001     → basic info (names, element, class, rarity, VA)
 * ?action=skills&id=2000001   → skills data
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action') ?? 'list';
  const id = searchParams.get('id');

  try {
    switch (action) {
      case 'list':
        return await handleList();
      case 'info':
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        return await handleInfo(id);
      case 'skills':
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        return await handleSkills(id);
      case 'transcend':
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        return await handleTranscend(id);
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

// ── List ─────────────────────────────────────────────────────────────

async function handleList() {
  const [charTemplet, textChar, textSys, extraTemplet, changeTemplet] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('CharacterChangeTemplet'),
  ]);

  const textMap = buildTextMap(textChar.data);
  const textSysMap = buildTextMap(textSys.data);

  // Build set of IDs where nickname is part of the display name
  const showNickIds = new Set(
    extraTemplet.data.filter(r => r.ShowNickName === 'True').map(r => r.CharacterID)
  );

  // Exclude "change" form IDs (transformed variants like 2000120 = Luna transformed)
  const changeTargetIds = new Set(
    changeTemplet.data.map(r => r.ID_fallback1).filter(Boolean)
  );

  // Keep base characters (2000xxx) and core-fusions (2700xxx), skip skins + change forms
  const pcOnly = charTemplet.data.filter(r => {
    if (r.Type !== 'CT_PC') return false;
    const id = r.ModelID ?? '';
    if (changeTargetIds.has(id)) return false;
    return id.startsWith('2000') || id.startsWith('2700');
  });

  const existingDir = path.join(process.cwd(), 'data', 'character');
  let existingIds: Set<string> = new Set();
  try {
    const files = await fs.readdir(existingDir);
    existingIds = new Set(files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));
  } catch { /* dir may not exist */ }

  // Deduplicate by ModelID (some characters have multiple entries)
  const seen = new Set<string>();
  const characters: { id: string; name: string; element: string; class: string; rarity: number; exists: boolean }[] = [];
  for (const row of pcOnly) {
    const id = row.ModelID ?? '';
    if (seen.has(id)) continue;
    seen.add(id);
    const names = textMap[row.NameIDSymbol ?? ''];
    let name = names?.[DEFAULT_LANG] ?? row.NameIDSymbol ?? '';
    if (id.startsWith('2700')) {
      const fusion = textSysMap['SYS_CHARACTER_FUSION_TITLE']?.[DEFAULT_LANG];
      if (fusion) name = `${fusion} ${name}`;
    } else if (showNickIds.has(id)) {
      const nick = textMap[`${id}_NickName`]?.[DEFAULT_LANG];
      if (nick) name = `${nick} ${name}`;
    }
    characters.push({
      id,
      name,
      element: resolveElement(textSysMap, row.Element ?? ''),
      class: resolveClass(textSysMap, row.Class ?? ''),
      rarity: BASIC_STAR_OVERRIDE[id] ?? (parseInt(row.BasicStar) || 0),
      exists: existingIds.has(id),
    });
  }

  characters.sort((a, b) => a.id.localeCompare(b.id));
  return NextResponse.json({ characters });
}

// ── Info ─────────────────────────────────────────────────────────────

async function handleInfo(id: string) {
  const [charTemplet, textChar, textSys, textSkill, extraTemplet, skillTemplet, trustTemplet, fusionTemplet] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('TextSkill'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('TrustTemplet'),
    readTemplet('CharacterFusionTemplet'),
  ]);

  const textMap = buildTextMap(textChar.data);
  const textSysMap = buildTextMap(textSys.data);
  const charRow = charTemplet.data.find(r => r.ModelID === id);
  if (!charRow) {
    return NextResponse.json({ error: `Character ${id} not found` }, { status: 404 });
  }

  const isCoreFusion = id.startsWith('2700');
  const names = textMap[charRow.NameIDSymbol ?? ''];

  // Check if nickname should be prepended (CharacterExtraTemplet.ShowNickName)
  const showNick = extraTemplet.data.some(r => r.CharacterID === id && r.ShowNickName === 'True');
  const nickNames = showNick ? textMap[`${id}_NickName`] : null;

  // Core fusion prefix from TextSystem
  const fusionPrefix = isCoreFusion ? textSysMap['SYS_CHARACTER_FUSION_TITLE'] : null;

  // Build fullname per lang
  const fullnameTexts = {} as LangTexts;
  for (const lang of LANGS) {
    const name = names?.[lang] ?? '';
    const nick = nickNames?.[lang] ?? '';
    const prefix = fusionPrefix?.[lang] ?? '';
    if (prefix) {
      fullnameTexts[lang] = `${prefix} ${name}`;
    } else {
      fullnameTexts[lang] = nick ? `${nick} ${name}` : name;
    }
  }

  // Voice actors: each lang has its own native VA entry ({id}_CVName_{lang})
  // For core-fusion, fallback to the base character's VA (2700xxx → 2000xxx via FusionTemplet)
  const baseId = isCoreFusion
    ? fusionTemplet.data.find(r => r.ChangeCharID === id)?.RecruitID ?? id
    : id;

  const cvEntries: Record<Lang, LangTexts | undefined> = {} as Record<Lang, LangTexts | undefined>;
  for (const lang of LANGS) {
    cvEntries[lang] = textMap[`${id}_CVName_${lang}`] ?? textMap[`${baseId}_CVName_${lang}`];
  }
  const voiceActorTexts = {} as LangTexts;
  for (const lang of LANGS) {
    voiceActorTexts[lang] = cvEntries[lang]?.[lang]
      || cvEntries.jp?.[lang]
      || cvEntries[DEFAULT_LANG]?.[lang]
      || '';
  }

  // Chain type: from chain passive description + icon fallback
  const skillIds: string[] = [];
  for (let i = 1; i <= 23; i++) {
    const sid = charRow[`Skill_${i}`];
    if (sid) skillIds.push(sid);
  }
  const textSkillMap = buildTextMap(textSkill.data);
  let chainDesc = '';
  let chainIconName = '';
  for (const row of skillTemplet.data) {
    if (row.SkillType === 'SKT_CHAIN_PASSIVE' && row.NameIDSymbol && skillIds.includes(row.NameIDSymbol)) {
      chainIconName = row.IconName ?? '';
      // Get first desc symbol to read the description text
      const descSym = (row.DescID ?? '').split(',')[0]?.trim();
      if (descSym) chainDesc = textSkillMap[descSym]?.[DEFAULT_LANG] ?? '';
      break;
    }
  }
  const chainType = resolveChainType(chainDesc, chainIconName);

  // Gift from TrustTemplet
  const trustRow = trustTemplet.data.find(r => r.ID === id);
  const gift = GIFT_MAP[trustRow?.PresentTypeLike ?? ''] ?? null;

  // Core fusion: check if this base character has a fusion variant
  const fusionRow = fusionTemplet.data.find(r => r.RecruitID === id);
  const hasCoreFusion = !!fusionRow;
  const coreFusionId = fusionRow?.ChangeCharID ?? undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {
    ID: id,
    ...expandLang('Fullname', fullnameTexts),
    Rarity: BASIC_STAR_OVERRIDE[id] ?? (parseInt(charRow.BasicStar) || 0),
    Element: resolveElement(textSysMap, charRow.Element ?? ''),
    Class: resolveClass(textSysMap, charRow.Class ?? ''),
    SubClass: resolveSubClass(textSysMap, charRow.SubClass ?? ''),
    Chain_Type: chainType,
    gift,
    ...expandLang('VoiceActor', voiceActorTexts),
  };

  if (hasCoreFusion) {
    result.hasCoreFusion = true;
    result.coreFusionId = coreFusionId;
  }

  return NextResponse.json(result);
}

// ── Skills ───────────────────────────────────────────────────────────

const WANTED_SKILL_TYPES = new Set(['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE']);

async function handleSkills(id: string) {
  const [charTemplet, textSkill, skillTemplet, skillLevelTemplet, buffTemplet, changeTemplet] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextSkill'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('CharacterSkillLevelTemplet'),
    readTemplet('BuffTemplet'),
    readTemplet('CharacterChangeTemplet'),
  ]);

  const textSkillMap = buildTextMap(textSkill.data);
  const buffIndex = buildBuffIndex(buffTemplet.data);

  const charRow = charTemplet.data.find(r => r.ModelID === id);
  if (!charRow) {
    return NextResponse.json({ error: `Character ${id} not found` }, { status: 404 });
  }

  // Check if this character has a "change" form (e.g. Luna 2000119 ↔ 2000120)
  const changeRow = changeTemplet.data.find(r => r.ID === id);
  const changeId = changeRow?.ID_fallback1 ?? null;
  const changeCharRow = changeId ? charTemplet.data.find(r => r.ModelID === changeId) : null;

  // Collect skill IDs referenced by the character + map sid → slot
  const skillIds: string[] = [];
  const sidToSlot = new Map<string, string>();
  for (let i = 1; i <= 23; i++) {
    const sid = charRow[`Skill_${i}`];
    if (sid) {
      skillIds.push(sid);
      sidToSlot.set(sid, `Skill_${i}`);
    }
  }

  // Index skill rows by NameIDSymbol (which matches the skill ID)
  const skillRows = new Map<string, Record<string, string>>();
  for (const row of skillTemplet.data) {
    if (row.NameIDSymbol && skillIds.includes(row.NameIDSymbol)) {
      skillRows.set(row.NameIDSymbol, row);
    }
  }

  // Index skill level rows by SkillID
  const skillLevelRows = new Map<string, Record<string, string>[]>();
  for (const row of skillLevelTemplet.data) {
    if (row.SkillID && skillIds.includes(row.SkillID)) {
      const arr = skillLevelRows.get(row.SkillID) ?? [];
      arr.push(row);
      skillLevelRows.set(row.SkillID, arr);
    }
  }

  const skills: Record<string, unknown> = {};

  for (const [sid, sRow] of skillRows) {
    const skillType = sRow.SkillType;
    if (!skillType || !WANTED_SKILL_TYPES.has(skillType)) continue;

    // Resolve name from SkipNameID
    const skipNameId = sRow.SkipNameID ?? '';
    const resolvedNames = textSkillMap[skipNameId];

    // Skill descriptions per level: DescID is comma-separated list of text symbols
    // Resolve [Buff_C_...], [Buff_V_...], [Buff_T_...] placeholders per level
    const descLevels: Record<string, string> = {};
    const descSymbols = (sRow.DescID ?? '').split(',');
    for (let lvl = 0; lvl < descSymbols.length; lvl++) {
      const sym = descSymbols[lvl]?.trim();
      if (!sym) continue;
      const texts = textSkillMap[sym];
      if (texts) {
        const skillLv = lvl + 1;
        descLevels[String(skillLv)] = resolveBuffPlaceholders(texts[DEFAULT_LANG], skillLv, buffIndex);
        for (const lang of SUFFIX_LANGS) {
          if (texts[lang]) descLevels[`${skillLv}_${lang}`] = resolveBuffPlaceholders(texts[lang], skillLv, buffIndex);
        }
      }
    }

    // Skill levels → WGR, CD, enhancement descriptions
    const levels = skillLevelRows.get(sid) ?? [];
    const firstLevel = levels[0];

    // CD from StartCool at level 1 (only S2 and Ultimate have visible cooldowns)
    const hasCd = skillType === 'SKT_SECOND' || skillType === 'SKT_ULTIMATE';
    const rawCd = hasCd ? firstLevel?.StartCool ?? '' : '';
    const cd = rawCd && /^\d+$/.test(rawCd) ? parseInt(rawCd) : null;

    // Enhancement descriptions per level (multilang, format: { "2": ["..."], "2_jp": ["..."], ... })
    // SE_DESC keys can be in DescID, GainCP, or DamageFactor (bytes parser column shifts)
    const enhancement: Record<string, string[]> = {};
    for (const lv of levels) {
      const lvNum = lv.SkillLevel ?? '1';
      if (lvNum === '1') continue;
      // Find SE_DESC keys in any field
      const seDescRaw = [lv.DescID, lv.GainCP, lv.DamageFactor]
        .filter(Boolean)
        .join(',')
        .split(',')
        .map(d => d.trim())
        .filter(d => d.startsWith('SE_DESC_'));
      if (seDescRaw.length === 0) continue;
      const descs = seDescRaw;
      // Default lang
      enhancement[lvNum] = descs.map(d => textSkillMap[d]?.[DEFAULT_LANG] ?? d);
      // Suffix langs
      for (const lang of SUFFIX_LANGS) {
        const langDescs = descs.map(d => textSkillMap[d]?.[lang] ?? '').filter(Boolean);
        if (langDescs.length > 0) enhancement[`${lvNum}_${lang}`] = langDescs;
      }
    }

    // true_desc = desc at level 1 (base description, all langs)
    const trueDesc: Record<string, string | null> = {};
    trueDesc.true_desc = descLevels['1'] ?? null;
    for (const lang of SUFFIX_LANGS) {
      trueDesc[`true_desc_${lang}`] = descLevels[`1_${lang}`] ?? null;
    }

    const isChain = skillType === 'SKT_CHAIN_PASSIVE';
    let target: string | null;
    let offensive: boolean;
    let wgr: number | null;

    if (isChain) {
      // Chain passive always has fixed values
      wgr = 3;
      offensive = true;
      target = 'multi';
    } else {
      // Combine RangeType with change form if exists (e.g. Luna 2000119↔2000120)
      let rangeType = sRow.RangeType ?? '';
      if (changeCharRow) {
        const changeSkillIds: string[] = [];
        for (let i = 1; i <= 23; i++) {
          const s = changeCharRow[`Skill_${i}`];
          if (s) changeSkillIds.push(s);
        }
        const changeSRow = skillTemplet.data.find(r =>
          r.SkillType === skillType && r.NameIDSymbol && changeSkillIds.includes(r.NameIDSymbol)
        );
        if (changeSRow?.RangeType && changeSRow.RangeType !== rangeType) {
          rangeType = `${rangeType},${changeSRow.RangeType}`;
        }
      }
      target = resolveTarget(rangeType);
      const slot = sidToSlot.get(sid) ?? '';
      offensive = NON_OFFENSIVE_OVERRIDE.has(`${id}:${slot}`)
        ? false
        : (sRow.TargetTeamType ?? '').includes('ENEMY');
      wgr = offensive ? (parseInt(firstLevel?.WGReduce ?? '0') || 0) : null;
    }

    skills[skillType] = {
      NameIDSymbol: sid,
      IconName: sRow.IconName ?? '',
      SkillType: skillType,
      ...expandLang('name', resolvedNames),
      ...trueDesc,
      true_desc_levels: descLevels,
      enhancement,
      wgr,
      cd,
      offensive,
      target,
      buff: [],
      debuff: [],
    };
  }

  // ── burnEffect: burst skills attached to the main skill that has RequireAP=int,int,int ──
  const burstTypes = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'] as const;
  const burstRows: Record<string, Record<string, string>> = {};
  for (const row of skillTemplet.data) {
    if (row.NameIDSymbol && skillIds.includes(row.NameIDSymbol) && burstTypes.includes(row.SkillType as typeof burstTypes[number])) {
      burstRows[row.SkillType] = row;
    }
  }

  if (Object.keys(burstRows).length > 0) {
    // Find which main skill has RequireAP=int,int,int (that's the one with burnEffect)
    let burnTarget: string | null = null;
    let burstCosts: number[] = [];
    for (const [, sRow] of skillRows) {
      const rap = sRow.RequireAP ?? '';
      if (/^\d+,\d+,\d+$/.test(rap)) {
        burnTarget = sRow.SkillType;
        burstCosts = rap.split(',').map(Number);
        break;
      }
    }

    if (burnTarget && skills[burnTarget]) {
      const burnEffect: Record<string, unknown> = {};
      for (let bi = 0; bi < burstTypes.length; bi++) {
        const bt = burstTypes[bi];
        const bRow = burstRows[bt];
        if (!bRow) continue;

        // IconName contains the DESC key with the full description text
        const bDescKey = bRow.IconName ?? '';
        const bNames = textSkillMap[bDescKey];
        const bTarget = resolveTarget(bRow.RangeType ?? '');
        const bOffensive = (bRow.TargetTeamType ?? '').includes('ENEMY');

        burnEffect[bt] = {
          ...expandLang('effect', bNames),
          cost: burstCosts[bi] ?? null,
          level: bi + 1,
          offensive: bOffensive,
          target: bTarget,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (skills[burnTarget] as any).burnEffect = burnEffect;
    }
  }

  return NextResponse.json({ skills });
}

// ── Transcend ────────────────────────────────────────────────────────

// BasicStar range in TranscendentTemplet per initial rarity
const TRANSCEND_BS_OFFSET: Record<number, number> = { 1: 0, 2: 0, 3: 17 };

/** Build transcend data from templet data — shared between handleTranscend and handleCompare */
function buildTranscend(
  id: string,
  charRow: Record<string, string>,
  transcendData: Record<string, string>[],
  skillTempletData: Record<string, string>[],
  skillLevelData: Record<string, string>[],
  textSkillMap: Record<string, LangTexts>,
): Record<string, string | null> {
  const rarity = BASIC_STAR_OVERRIDE[id] ?? (parseInt(charRow.BasicStar) || 0);
  const bsOffset = TRANSCEND_BS_OFFSET[rarity] ?? 0;

  const charSpecific = transcendData.filter(r => r.CharacterID === id);
  const steps = charSpecific.length > 0
    ? charSpecific
    : transcendData.filter(r => {
        if (r.CharacterID !== '0') return false;
        const bs = parseInt(r.BasicStar) || 0;
        return bs > bsOffset && bs <= bsOffset + 9;
      });

  steps.sort((a, b) => (parseInt(a.UseTransStar) || 0) - (parseInt(b.UseTransStar) || 0));

  const skillIds: string[] = [];
  for (let i = 1; i <= 23; i++) {
    const sid = charRow[`Skill_${i}`];
    if (sid) skillIds.push(sid);
  }

  let uniquePassiveId: string | null = null;
  for (const row of skillTempletData) {
    if (row.SkillType === 'SKT_UNIQUE_PASSIVE' && row.NameIDSymbol && skillIds.includes(row.NameIDSymbol)) {
      uniquePassiveId = row.NameIDSymbol;
      break;
    }
  }

  const transcendDescs = new Map<number, string>();
  if (uniquePassiveId) {
    for (const row of skillLevelData) {
      if (row.SkillID === uniquePassiveId) {
        const sl = parseInt(row.SkillLevel) || 0;
        const descKey = row.WGReduce ?? '';
        if (sl > 0 && descKey.startsWith('SE_DESC_')) {
          transcendDescs.set(sl, descKey);
        }
      }
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

      const lines: Record<Lang, string[]> = {} as Record<Lang, string[]>;
      for (const lang of LANGS) lines[lang] = [];

      if (hpRate > 0) {
        const pct = `ATK DEF HP +${hpRate / 10}%`;
        for (const lang of LANGS) lines[lang].push(pct);
      }

      // SkillLevel 1 = Burst Lv2 unlock (implicit, not shown in transcend desc)
      if (skillLevel > 1 && skillLevel > lastDescSkillLevel) {
        lastDescSkillLevel = skillLevel;
        const descKey = transcendDescs.get(skillLevel);
        if (descKey) {
          const texts = textSkillMap[descKey];
          if (texts) {
            for (const lang of LANGS) {
              const txt = texts[lang];
              if (txt) lines[lang].push(txt.replace(/\\n/g, '\n'));
            }
          }
        }
      }

      const defaultLines = lines[DEFAULT_LANG];
      transcend[key] = defaultLines.length > 0 ? defaultLines.join('\n') : null;

      for (const lang of SUFFIX_LANGS) {
        const langLines = lines[lang];
        if (langLines.length > 1 || (langLines.length === 1 && langLines[0] !== defaultLines[0])) {
          transcend[`${key}_${lang}`] = langLines.join('\n');
        }
      }
    }
  }

  return transcend;
}

async function handleTranscend(id: string) {
  const [charTemplet, transcendTemplet, skillTemplet, skillLevelTemplet, textSkill] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('CharacterTranscendentTemplet'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('CharacterSkillLevelTemplet'),
    readTemplet('TextSkill'),
  ]);

  const charRow = charTemplet.data.find(r => r.ModelID === id);
  if (!charRow) {
    return NextResponse.json({ error: `Character ${id} not found` }, { status: 404 });
  }

  const textSkillMap = buildTextMap(textSkill.data);
  const transcend = buildTranscend(id, charRow, transcendTemplet.data, skillTemplet.data, skillLevelTemplet.data, textSkillMap);
  return NextResponse.json({ transcend });
}

// ── Compare ──────────────────────────────────────────────────────────

const INFO_FIELDS = [
  'Fullname', 'Fullname_jp', 'Fullname_kr', 'Fullname_zh',
  'Rarity', 'Element', 'Class', 'SubClass', 'Chain_Type', 'gift',
  'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
  'hasCoreFusion', 'coreFusionId',
];

const SKILL_FIELDS = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'true_desc', 'true_desc_jp', 'true_desc_kr', 'true_desc_zh',
  'wgr', 'cd', 'offensive', 'target',
];
const SKILL_KEYS = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE'];

async function handleCompare() {
  // Load all templets once
  const [charTemplet, textChar, textSys, textSkill, extraTemplet,
    skillTemplet, skillLevelTemplet, buffTemplet, trustTemplet, fusionTemplet, changeTemplet,
    transcendTemplet,
    ] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('TextSkill'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('CharacterSkillLevelTemplet'),
    readTemplet('BuffTemplet'),
    readTemplet('TrustTemplet'),
    readTemplet('CharacterFusionTemplet'),
    readTemplet('CharacterChangeTemplet'),
    readTemplet('CharacterTranscendentTemplet'),
  ]);

  // Read existing character files
  const existingDir = path.join(process.cwd(), 'data', 'character');
  let existingFiles: string[] = [];
  try {
    existingFiles = (await fs.readdir(existingDir)).filter(f => f.endsWith('.json'));
  } catch { /* */ }

  // Build helpers once — call the individual handlers via internal fetch would be wasteful,
  // so we inline a lightweight comparison using the same data
  const textMap = buildTextMap(textChar.data);
  const textSysMap = buildTextMap(textSys.data);
  const textSkillMap = buildTextMap(textSkill.data);
  const buffIndex = buildBuffIndex(buffTemplet.data);

  const showNickIds = new Set(
    extraTemplet.data.filter(r => r.ShowNickName === 'True').map(r => r.CharacterID)
  );

  // Index skill/level templets
  const skillByNS = new Map<string, Record<string, string>>();
  for (const row of skillTemplet.data) {
    if (row.NameIDSymbol) skillByNS.set(row.NameIDSymbol, row);
  }
  const skillLevelBySID = new Map<string, Record<string, string>[]>();
  for (const row of skillLevelTemplet.data) {
    if (row.SkillID) {
      const arr = skillLevelBySID.get(row.SkillID) ?? [];
      arr.push(row);
      skillLevelBySID.set(row.SkillID, arr);
    }
  }

  const results: { id: string; name: string; diffs: { field: string; existing: string; extracted: string }[] }[] = [];

  for (const file of existingFiles) {
    const id = file.replace('.json', '');
    const raw = await fs.readFile(path.join(existingDir, file), 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: Record<string, any> = JSON.parse(raw);

    const charRow = charTemplet.data.find(r => r.ModelID === id);
    if (!charRow) continue;

    const diffs: { field: string; existing: string; extracted: string }[] = [];

    // ── Info fields ──
    const isCoreFusion = id.startsWith('2700');
    const names = textMap[charRow.NameIDSymbol ?? ''];
    const showNick = showNickIds.has(id);
    const nickNames = showNick ? textMap[`${id}_NickName`] : null;
    const fusionPrefix = isCoreFusion ? textSysMap['SYS_CHARACTER_FUSION_TITLE'] : null;

    const fullnameTexts = {} as LangTexts;
    for (const lang of LANGS) {
      const n = names?.[lang] ?? '';
      const prefix = fusionPrefix?.[lang] ?? '';
      const nick = nickNames?.[lang] ?? '';
      if (prefix) {
        fullnameTexts[lang] = `${prefix} ${n}`;
      } else {
        fullnameTexts[lang] = nick ? `${nick} ${n}` : n;
      }
    }

    // VA: fallback to base character for core-fusion
    const baseId = isCoreFusion
      ? fusionTemplet.data.find((r: Record<string, string>) => r.ChangeCharID === id)?.RecruitID ?? id
      : id;
    const cvEntries: Record<Lang, LangTexts | undefined> = {} as Record<Lang, LangTexts | undefined>;
    for (const lang of LANGS) cvEntries[lang] = textMap[`${id}_CVName_${lang}`] ?? textMap[`${baseId}_CVName_${lang}`];
    const voiceActorTexts = {} as LangTexts;
    for (const lang of LANGS) {
      voiceActorTexts[lang] = cvEntries[lang]?.[lang] || cvEntries.jp?.[lang] || cvEntries[DEFAULT_LANG]?.[lang] || '';
    }

    // Collect skill IDs + slot mapping
    const sids: string[] = [];
    const sidSlotMap = new Map<string, string>();
    for (let i = 1; i <= 23; i++) {
      const s = charRow[`Skill_${i}`];
      if (s) { sids.push(s); sidSlotMap.set(s, `Skill_${i}`); }
    }

    let chainDesc = '';
    let chainIconName = '';
    for (const row of skillTemplet.data) {
      if (row.SkillType === 'SKT_CHAIN_PASSIVE' && row.NameIDSymbol && sids.includes(row.NameIDSymbol)) {
        chainIconName = row.IconName ?? '';
        const descSym = (row.DescID ?? '').split(',')[0]?.trim();
        if (descSym) chainDesc = textSkillMap[descSym]?.[DEFAULT_LANG] ?? '';
        break;
      }
    }
    const chainType = resolveChainType(chainDesc, chainIconName);

    const trustRow = trustTemplet.data.find(r => r.ID === id);
    const gift = GIFT_MAP[trustRow?.PresentTypeLike ?? ''] ?? null;

    const fusionRow = fusionTemplet.data.find((r: Record<string, string>) => r.RecruitID === id);

    const extracted: Record<string, unknown> = {
      ...expandLang('Fullname', fullnameTexts),
      Rarity: BASIC_STAR_OVERRIDE[id] ?? (parseInt(charRow.BasicStar) || 0),
      Element: resolveElement(textSysMap, charRow.Element ?? ''),
      Class: resolveClass(textSysMap, charRow.Class ?? ''),
      SubClass: resolveSubClass(textSysMap, charRow.SubClass ?? ''),
      Chain_Type: chainType,
      gift,
      ...expandLang('VoiceActor', voiceActorTexts),
      hasCoreFusion: fusionRow ? true : undefined,
      coreFusionId: fusionRow?.ChangeCharID ?? undefined,
    };

    for (const field of INFO_FIELDS) {
      if (!(field in existing)) continue;
      const e = String(existing[field] ?? '');
      const a = String(extracted[field] ?? '');
      if (e !== a) diffs.push({ field, existing: e, extracted: a });
    }

    // ── Skills ──
    for (const sk of SKILL_KEYS) {
      const existingSkill = existing.skills?.[sk];
      if (!existingSkill) continue;

      // Find the skill row
      const sid = sids.find(s => skillByNS.get(s)?.SkillType === sk);
      if (!sid) continue;
      const sRow = skillByNS.get(sid);
      if (!sRow) continue;

      const resolvedNames = textSkillMap[sRow.SkipNameID ?? ''];
      const levels = skillLevelBySID.get(sid) ?? [];
      const firstLevel = levels[0];

      // Chain passive gameplay fields (wgr, offensive, target) are manual — skip comparison
      const isChain = sk === 'SKT_CHAIN_PASSIVE';

      const hasCd = sk === 'SKT_SECOND' || sk === 'SKT_ULTIMATE';
      const rawCd = hasCd ? firstLevel?.StartCool ?? '' : '';
    const cd = rawCd && /^\d+$/.test(rawCd) ? parseInt(rawCd) : null;
      // Combine RangeType with change form if exists
      let rangeType = sRow.RangeType ?? '';
      if (!isChain) {
        const changeRow = changeTemplet.data.find(r => r.ID === id);
        const chId = changeRow?.ID_fallback1;
        if (chId) {
          const chCharRow = charTemplet.data.find(r => r.ModelID === chId);
          if (chCharRow) {
            const chSids: string[] = [];
            for (let i = 1; i <= 23; i++) { const s = chCharRow[`Skill_${i}`]; if (s) chSids.push(s); }
            const chSRow = skillTemplet.data.find(r => r.SkillType === sk && r.NameIDSymbol && chSids.includes(r.NameIDSymbol));
            if (chSRow?.RangeType && chSRow.RangeType !== rangeType) {
              rangeType = `${rangeType},${chSRow.RangeType}`;
            }
          }
        }
      }
      let target: string | null;
      let offensive: boolean;
      let wgr: number | null;

      if (isChain) {
        wgr = 3;
        offensive = true;
        target = 'multi';
      } else {
        target = resolveTarget(rangeType);
        const slot = sidSlotMap.get(sid) ?? '';
        offensive = NON_OFFENSIVE_OVERRIDE.has(`${id}:${slot}`)
          ? false
          : (sRow.TargetTeamType ?? '').includes('ENEMY');
        wgr = offensive ? (parseInt(firstLevel?.WGReduce ?? '0') || 0) : null;
      }

      // Build true_desc from desc level 1
      const skillDescSymbols = (sRow.DescID ?? '').split(',');
      const descSym1 = skillDescSymbols[0]?.trim();
      const descTexts1 = descSym1 ? textSkillMap[descSym1] : undefined;
      const trueDescExtracted: Record<string, string | null> = {
        true_desc: descTexts1 ? resolveBuffPlaceholders(descTexts1[DEFAULT_LANG], 1, buffIndex) : null,
      };
      for (const lang of SUFFIX_LANGS) {
        trueDescExtracted[`true_desc_${lang}`] = descTexts1 ? resolveBuffPlaceholders(descTexts1[lang], 1, buffIndex) : null;
      }

      const extractedSkill: Record<string, unknown> = {
        ...expandLang('name', resolvedNames),
        ...trueDescExtracted,
        wgr,
        cd,
        offensive,
        target,
      };

      for (const sf of SKILL_FIELDS) {
        // Skip if existing doesn't have this field at all (not yet filled)
        if (!(sf in existingSkill)) continue;
        const e = String(existingSkill[sf] ?? '');
        const a = String(extractedSkill[sf] ?? '');
        if (e !== a) diffs.push({ field: `${sk}.${sf}`, existing: e, extracted: a });
      }

      // Compare desc all levels, all languages
      const descSymbols = (sRow.DescID ?? '').split(',');
      for (let lvl = 0; lvl < descSymbols.length; lvl++) {
        const sym = descSymbols[lvl]?.trim();
        if (!sym) continue;
        const texts = textSkillMap[sym];
        if (!texts) continue;
        const skillLv = lvl + 1;

        // Default lang
        const resolved = resolveBuffPlaceholders(texts[DEFAULT_LANG], skillLv, buffIndex);
        const existingDesc = existingSkill.true_desc_levels?.[String(skillLv)] ?? '';
        if (existingDesc && resolved && existingDesc !== resolved) {
          diffs.push({ field: `${sk}.desc_lv${skillLv}`, existing: existingDesc, extracted: resolved });
        }

        // Suffix langs
        for (const lang of SUFFIX_LANGS) {
          const resolvedLang = resolveBuffPlaceholders(texts[lang], skillLv, buffIndex);
          const existingLang = existingSkill.true_desc_levels?.[`${skillLv}_${lang}`] ?? '';
          if (existingLang && resolvedLang && existingLang !== resolvedLang) {
            diffs.push({ field: `${sk}.desc_lv${skillLv}_${lang}`, existing: existingLang, extracted: resolvedLang });
          }
        }
      }

      // Compare enhancement (all langs)
      const existingEnh = existingSkill.enhancement ?? {};
      const extractedEnh: Record<string, string[]> = {};
      for (const lv of levels) {
        const lvNum = lv.SkillLevel ?? '1';
        if (lvNum === '1') continue;
        const descs = [lv.DescID, lv.GainCP, lv.DamageFactor]
          .filter(Boolean)
          .join(',')
          .split(',')
          .map((d: string) => d.trim())
          .filter((d: string) => d.startsWith('SE_DESC_'));
        if (descs.length === 0) continue;
        extractedEnh[lvNum] = descs.map((d: string) => textSkillMap[d]?.[DEFAULT_LANG] ?? d);
        for (const lang of SUFFIX_LANGS) {
          const langDescs = descs.map((d: string) => textSkillMap[d]?.[lang] ?? '').filter(Boolean);
          if (langDescs.length > 0) extractedEnh[`${lvNum}_${lang}`] = langDescs;
        }
      }
      // Only compare keys that exist in the existing data
      for (const k of Object.keys(existingEnh)) {
        const eVal = JSON.stringify(existingEnh[k] ?? null);
        const aVal = JSON.stringify(extractedEnh[k] ?? null);
        if (eVal !== aVal) {
          diffs.push({ field: `${sk}.enh_${k}`, existing: existingEnh[k]?.join(', ') ?? '', extracted: extractedEnh[k]?.join(', ') ?? '' });
        }
      }

      // Compare burnEffect
      const existingBurn = existingSkill.burnEffect ?? {};
      // Find if this skill has RequireAP=int,int,int (= has burnEffect)
      const rap = sRow.RequireAP ?? '';
      if (/^\d+,\d+,\d+$/.test(rap)) {
        const burstCosts = rap.split(',').map(Number);
        const burstTypes2 = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'];
        for (let bi = 0; bi < burstTypes2.length; bi++) {
          const bt = burstTypes2[bi];
          const exBurst = existingBurn[bt] ?? {};
          // Find burst skill row
          const bRow = skillTemplet.data.find(r =>
            r.SkillType === bt && r.NameIDSymbol && sids.includes(r.NameIDSymbol)
          );
          if (!bRow) continue;

          const bDescKey = bRow.IconName ?? '';
          const bNames = textSkillMap[bDescKey];
          const extractedBurst = {
            ...expandLang('effect', bNames),
            cost: burstCosts[bi],
            level: bi + 1,
            offensive: (bRow.TargetTeamType ?? '').includes('ENEMY'),
            target: resolveTarget(bRow.RangeType ?? ''),
          };

          for (const bf of ['effect', 'effect_jp', 'effect_kr', 'effect_zh', 'cost', 'level', 'offensive', 'target']) {
            const eVal = String(exBurst[bf] ?? '');
            const aVal = String((extractedBurst as Record<string, unknown>)[bf] ?? '');
            if (eVal !== aVal) {
              diffs.push({ field: `${sk}.burn.${bt}.${bf}`, existing: eVal, extracted: aVal });
            }
          }
        }
      }
    }

    // ── Transcend ──
    const existingTranscend = existing.transcend ?? {};
    const extractedTranscend = buildTranscend(id, charRow, transcendTemplet.data, skillTemplet.data, skillLevelTemplet.data, textSkillMap);

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

// ── Save ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/extractor
 *
 * Body: { id, manual: { rank, rank_pvp, role, tags, skill_priority, video } }
 *
 * Merges extracted data + manual fields + existing buff/debuff → saves to data/character/{id}.json
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, manual } = body as {
      id: string;
      manual: {
        rank?: string | null;
        rank_pvp?: string | null;
        role?: string | null;
        tags?: string[];
        skill_priority?: Record<string, { prio: number }>;
        video?: string | null;
      };
    };

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Fetch extracted data
    const [infoRes, skillsRes, transcendRes] = await Promise.all([
      handleInfo(id),
      handleSkills(id),
      handleTranscend(id),
    ]);

    const info = await infoRes.json();
    const skillsData = await skillsRes.json();
    const transcendData = await transcendRes.json();

    if (info.error || skillsData.error || transcendData.error) {
      return NextResponse.json({ error: info.error || skillsData.error || transcendData.error }, { status: 500 });
    }

    // Load existing data for buff/debuff preservation
    const existingPath = path.join(process.cwd(), 'data', 'character', `${id}.json`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existing: Record<string, any> = {};
    try {
      existing = JSON.parse(await fs.readFile(existingPath, 'utf-8'));
    } catch { /* new character */ }

    // Merge skills: extracted + preserve existing buff/debuff/true_desc/burnEffect
    const mergedSkills: Record<string, unknown> = {};
    for (const sk of ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE']) {
      const extracted = skillsData.skills?.[sk];
      if (!extracted) continue;

      const existingSkill = existing.skills?.[sk] ?? {};

      const merged: Record<string, unknown> = {
        ...extracted,
        // Preserve manually-set fields from existing (buff/debuff not yet extractible)
        buff: existingSkill.buff ?? [],
        debuff: existingSkill.debuff ?? [],
      };

      // burnEffect: extracted has effect text, cost, offensive, target
      // No merge needed — extraction is authoritative

      // Reorder lang-keyed objects: group by lang (EN first, then JP, KR, ZH)
      if (merged.true_desc_levels) {
        merged.true_desc_levels = groupByLang(merged.true_desc_levels as Record<string, string>);
      }
      if (merged.enhancement) {
        merged.enhancement = groupByLang(merged.enhancement as Record<string, string>);
      }

      mergedSkills[sk] = orderKeys(merged, SKILL_KEY_ORDER);

      // Remove undefined values
      const skill = mergedSkills[sk] as Record<string, unknown>;
      for (const key of Object.keys(skill)) {
        if (skill[key] === undefined) delete skill[key];
      }
    }

    // Build final character JSON
    const character = orderKeys({
      ...info,
      rank: manual.rank ?? existing.rank ?? null,
      rank_pvp: manual.rank_pvp ?? existing.rank_pvp ?? undefined,
      role: manual.role ?? existing.role ?? null,
      tags: manual.tags ?? existing.tags ?? undefined,
      skill_priority: manual.skill_priority ?? existing.skill_priority ?? { First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 } },
      video: manual.video ?? existing.video ?? undefined,
      transcend: groupByLang(transcendData.transcend),
      skills: mergedSkills,
    }, TOP_LEVEL_KEY_ORDER);

    // Remove undefined values
    for (const key of Object.keys(character)) {
      if (character[key] === undefined) delete character[key];
    }

    // Write file
    const outputDir = path.join(process.cwd(), 'data', 'character');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, `${id}.json`),
      JSON.stringify(character, null, 2) + '\n',
      'utf-8',
    );

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

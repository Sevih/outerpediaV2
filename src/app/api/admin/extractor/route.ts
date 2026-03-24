import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { stringifyCharacter, orderKeys, TOP_LEVEL_KEY_ORDER, SKILL_KEY_ORDER } from '@/app/api/admin/lib/character-json';
import {
  LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang, type LangTexts,
  readTemplet, buildTextMap, expandLang,
  resolveElement, resolveClass, resolveSubClass,
  buildBuffIndex, resolveBuffPlaceholders, extractBuffDebuff, collectBuffGroupIds, collectFusionPassiveBuffIds, collectBuffGroupIdsByPattern,
  resolveTarget, GIFT_MAP, resolveChainType, NON_OFFENSIVE_OVERRIDE,
  BASIC_STAR_OVERRIDE, detectTags, sortTags, SKILL_BUFF_FORCE,
} from '@/app/admin/lib/config';

// Simple async mutex for serializing writes to shared files (character-profiles.json)
function createMutex() {
  let chain = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn, fn);
    chain = p.then(() => {}, () => {});
    return p;
  };
}
const profileMutex = createMutex();

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

/** Case-insensitive lookup in textSkillMap (game data sometimes has SKILL_Desc_ instead of SKILL_DESC_) */
function textSkillLookup(map: Record<string, LangTexts>, key: string): LangTexts | undefined {
  return map[key] ?? Object.entries(map).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1];
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
      case 'inspect':
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        return await handleInspect(id);
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
  const [charTemplet, textChar, textSys, textSkill, extraTemplet, skillTemplet, trustTemplet, fusionTemplet, buffTemplet, recruitTemplet, profileTemplet] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('TextSkill'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('TrustTemplet'),
    readTemplet('CharacterFusionTemplet'),
    readTemplet('BuffTemplet'),
    readTemplet('RecruitGroupTemplet'),
    readTemplet('ArchiveCharacterProfileTemplet'),
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

  const tags = sortTags(detectTags(id, buffTemplet.data, recruitTemplet.data, extraTemplet.data));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {
    ID: id,
    ...expandLang('Fullname', fullnameTexts),
    Rarity: BASIC_STAR_OVERRIDE[id] ?? (parseInt(charRow.BasicStar) || 0),
    Element: resolveElement(textSysMap, charRow.Element ?? ''),
    Class: resolveClass(textSysMap, charRow.Class ?? ''),
    SubClass: resolveSubClass(textSysMap, charRow.SubClass ?? ''),
    tags,
    Chain_Type: chainType,
    gift,
    ...expandLang('VoiceActor', voiceActorTexts),
  };

  if (hasCoreFusion) {
    result.hasCoreFusion = true;
    result.coreFusionId = coreFusionId;
  }

  // Core fusion character: extract fusion-specific fields
  if (id.startsWith('2700')) {
    const cfRow = fusionTemplet.data.find(r => r.ChangeCharID === id);
    if (cfRow) {
      const fusionLevelTemplet = await readTemplet('CharacterFusionLevelTemplet');
      const levels = fusionLevelTemplet.data.filter(r => r.FusionGroupID === cfRow.FusionGroupID);

      const materialItemId = levels[0]?.RequireItemID ?? '';
      const itemTemplet = await readTemplet('ItemTemplet');
      const textItem = await readTemplet('TextItem');
      const itemRow = itemTemplet.data.find(r => r.ID === materialItemId);
      const itemName = itemRow?.NameIDSymbol
        ? (buildTextMap(textItem.data)[itemRow.NameIDSymbol]?.en ?? materialItemId)
        : materialItemId;

      result.fusionType = 'core-fusion';
      result.originalCharacter = cfRow.RecruitID;
      result.fusionRequirements = {
        transcendence: (parseInt(cfRow.CharacterID) || 1) - 1,
        material: { id: itemName, quantity: parseInt(levels[0]?.Skill_1) || 0 },
      };
      // Cost per level: level 1 = initial cost (Skill_1), levels 2+ = upgrade cost
      const costPerLevel: Record<number, { item: string; nb: number }> = {};
      levels.forEach((lv, i) => {
        costPerLevel[i + 1] = { item: materialItemId, nb: parseInt(lv.Skill_1) || 0 };
      });
      result.costPerLevel = costPerLevel;
    }
  }

  // Profile: birthday, height, weight, story
  // Core fusion chars have no profile row — fallback to base character for birthday/height/weight
  const profileRow = profileTemplet.data.find(r => r.CharacterID === id)
    ?? (isCoreFusion ? profileTemplet.data.find(r => r.CharacterID === baseId) : undefined);
  if (profileRow) {
    const bday = profileRow.Birthday ?? '';
    // Birthday format: YYYYMMDD → MM/DD
    const month = bday.length >= 8 ? bday.slice(4, 6) : '';
    const day = bday.length >= 8 ? bday.slice(6, 8) : '';
    result.birthday = month && day ? `${month}/${day}` : '';
    result.height = profileRow.Height ? `${profileRow.Height} cm` : '';
    result.weight = profileRow.Weight ? `${profileRow.Weight} kg` : '';

    // Story: try character-specific key first (core fusion has own story), then fallback to profile row
    const storySym = textSysMap[`SYS_ACHIEVE_PROFILE_${id}`] ? `SYS_ACHIEVE_PROFILE_${id}` : (profileRow.ScenarioIDSymbol ?? '');
    if (storySym) {
      const storyTexts = textSysMap[storySym];
      if (storyTexts) {
        result.story = {} as Record<string, string>;
        for (const lang of LANGS) {
          result.story[lang] = storyTexts[lang] ?? '';
        }
      }
    }
  }

  return NextResponse.json(result);
}

// ── Skills ───────────────────────────────────────────────────────────

const WANTED_SKILL_TYPES = new Set(['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE']);

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

  // Collect extra buff IDs from Skill_23 (class passive) that reference this character's buffs
  // These are custom passives that contain buff refs like {charId}_{skillNum}_{subId}
  const passiveBuffIdsBySkillNum = new Map<string, string[]>();
  const passiveSid = charRow.Skill_23;
  if (passiveSid) {
    const passiveLevels = skillLevelTemplet.data.filter(lv => lv.SkillID === passiveSid);
    for (const lv of passiveLevels) {
      for (const val of Object.values(lv)) {
        if (typeof val !== 'string') continue;
        for (const part of val.split(',')) {
          const t = part.trim();
          const m = t.match(new RegExp(`^${id}_(\\d+)_`));
          if (m) {
            const skillNum = m[1];
            const arr = passiveBuffIdsBySkillNum.get(skillNum) ?? [];
            if (!arr.includes(t)) arr.push(t);
            passiveBuffIdsBySkillNum.set(skillNum, arr);
          }
        }
      }
    }
  }

  // Index change character's skills by type (for transform characters like Luna 119↔120)
  const changeSkillsByType = new Map<string, { levels: Record<string, string>[]; row: Record<string, string> }>();
  if (changeCharRow) {
    const changeSids: string[] = [];
    for (let i = 1; i <= 23; i++) {
      const sid = changeCharRow[`Skill_${i}`];
      if (sid) changeSids.push(sid);
    }
    for (const row of skillTemplet.data) {
      if (row.NameIDSymbol && changeSids.includes(row.NameIDSymbol) && row.SkillType && WANTED_SKILL_TYPES.has(row.SkillType)) {
        const lvs = skillLevelTemplet.data.filter(lv => lv.SkillID === row.NameIDSymbol);
        changeSkillsByType.set(row.SkillType, { levels: lvs, row });
      }
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
      const texts = textSkillLookup(textSkillMap, sym);
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
      // Find SE_DESC/SKILL_DESC_B/SKILL_NAME_B keys in ALL fields (bytes parser shifts columns)
      const seDescRaw: string[] = [];
      for (const val of Object.values(lv)) {
        if (!val || typeof val !== 'string') continue;
        for (const part of val.split(',')) {
          const t = part.trim();
          if (t.startsWith('SE_DESC_') || t.startsWith('SKILL_DESC_B_') || t.startsWith('SKILL_NAME_B_')) {
            seDescRaw.push(t);
          }
        }
      }
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


    const isChain = skillType === 'SKT_CHAIN_PASSIVE';
    let target: string | string[] | null;
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

    const skillEntry: Record<string, unknown> = {
      NameIDSymbol: sid,
      IconName: sRow.IconName ?? '',
      SkillType: skillType,
      ...expandLang('name', resolvedNames),
      true_desc_levels: descLevels,
      enhancement,
      wgr,
      cd,
      offensive,
      target,
      ...(isChain
        ? extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'chain', buffTemplet.data), buffTemplet.data)
        : skillType === 'SKT_FUSION_PASSIVE'
          ? extractBuffDebuff(collectFusionPassiveBuffIds(levels, buffTemplet.data), buffTemplet.data)
          : (() => {
              // Merge buff IDs from skill levels + class passive (Skill_23)
              const baseIds = collectBuffGroupIds(levels);
              const slotNum = (sidToSlot.get(sid) ?? '').replace('Skill_', '');
              const extraIds = passiveBuffIdsBySkillNum.get(slotNum) ?? [];
              return extractBuffDebuff([...baseIds, ...extraIds], buffTemplet.data);
            })()),
    };

    // Merge transform character's buffs for this skill type
    const changeSkill = changeSkillsByType.get(skillType);
    if (changeSkill) {
      const changeBD = isChain
        ? extractBuffDebuff(collectBuffGroupIdsByPattern(changeId!, 'chain', buffTemplet.data), buffTemplet.data)
        : extractBuffDebuff(collectBuffGroupIds(changeSkill.levels), buffTemplet.data);
      const curBuff = (skillEntry.buff as string[]) ?? [];
      const curDebuff = (skillEntry.debuff as string[]) ?? [];
      for (const b of changeBD.buff) { if (!curBuff.includes(b)) curBuff.push(b); }
      for (const d of changeBD.debuff) { if (!curDebuff.includes(d)) curDebuff.push(d); }
      skillEntry.buff = curBuff;
      skillEntry.debuff = curDebuff;
    }

    // Chain passive: add dual attack fields from backup skill
    if (isChain) {
      const dualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'backup', buffTemplet.data), buffTemplet.data);
      // Also merge transform character's backup buffs
      if (changeId) {
        const changeDualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(changeId, 'backup', buffTemplet.data), buffTemplet.data);
        for (const b of changeDualBD.buff) { if (!dualBD.buff.includes(b)) dualBD.buff.push(b); }
        for (const d of changeDualBD.debuff) { if (!dualBD.debuff.includes(d)) dualBD.debuff.push(d); }
      }
      skillEntry.wgr_dual = 1;
      skillEntry.dual_offensive = true;
      skillEntry.dual_target = 'mono';
      skillEntry.dual_buff = dualBD.buff;
      skillEntry.dual_debuff = dualBD.debuff;
    }

    skills[skillType] = skillEntry;
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
        // Case may differ (e.g. SKILL_Desc_B vs SKILL_DESC_B), try exact then uppercase
        const bDescKey = bRow.IconName ?? '';
        const bNames = textSkillMap[bDescKey] ?? textSkillMap[bDescKey.toUpperCase()];
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
      const targetSkill = skills[burnTarget] as any;
      targetSkill.burnEffect = burnEffect;

      // Also merge burst skill buffs/debuffs into the main skill
      const mainBuffs = new Set<string>(targetSkill.buff ?? []);
      const mainDebuffs = new Set<string>(targetSkill.debuff ?? []);
      for (const bt of burstTypes) {
        const bRow = burstRows[bt];
        if (!bRow) continue;
        const bLevels = skillLevelRows.get(bRow.NameIDSymbol) ?? [];
        if (bLevels.length > 0) {
          const bd = extractBuffDebuff(collectBuffGroupIds(bLevels), buffTemplet.data);
          for (const b of bd.buff) mainBuffs.add(b);
          for (const d of bd.debuff) mainDebuffs.add(d);
        }
        // Detect BT_WG_REVERSE_HEAL from burst IconName referencing WG damage desc
        if (bRow.IconName === 'SE_DESC_DMG_WG_V_1') {
          mainDebuffs.add('BT_WG_REVERSE_HEAL');
        }
      }
      // Remove duplicates that are already from the base skill buff group
      targetSkill.buff = [...mainBuffs];
      targetSkill.debuff = [...mainDebuffs];
    }
  }

  // ── HEAVY_STRIKE detection: passive with ST_CRITICAL_RATE -1000 (OAT_RATE) = can't crit ──
  const hasHeavyStrike = buffTemplet.data.some(r =>
    r.BuffID?.startsWith(`${id}_passive`) &&
    r.StatType === 'ST_CRITICAL_RATE' &&
    r.Value === '-1000' &&
    r.ApplyingType === 'OAT_RATE',
  );
  if (hasHeavyStrike) {
    for (const skill of Object.values(skills) as Record<string, unknown>[]) {
      if (skill.offensive) {
        const buffs = (skill.buff as string[]) ?? [];
        if (!buffs.includes('HEAVY_STRIKE')) {
          skill.buff = ['HEAVY_STRIKE', ...buffs];
        }
      }
      // Also add to dual_buff if it exists (chain passive dual attack)
      if (skill.dual_offensive) {
        const dualBuffs = (skill.dual_buff as string[]) ?? [];
        if (!dualBuffs.includes('HEAVY_STRIKE')) {
          skill.dual_buff = ['HEAVY_STRIKE', ...dualBuffs];
        }
      }
    }
  }

  // Apply forced buff/debuff overrides
  for (const [key, forced] of Object.entries(SKILL_BUFF_FORCE)) {
    const [cid, skt] = key.split(':');
    if (cid !== id) continue;
    const skill = skills[skt] as Record<string, unknown> | undefined;
    if (!skill) continue;
    if (forced.buff) {
      const buffs = (skill.buff as string[]) ?? [];
      for (const b of forced.buff) { if (!buffs.includes(b)) buffs.push(b); }
      skill.buff = buffs;
    }
    if (forced.debuff) {
      const debuffs = (skill.debuff as string[]) ?? [];
      for (const d of forced.debuff) { if (!debuffs.includes(d)) debuffs.push(d); }
      skill.debuff = debuffs;
    }
    if (forced.dual_buff) {
      const db = (skill.dual_buff as string[]) ?? [];
      for (const b of forced.dual_buff) { if (!db.includes(b)) db.push(b); }
      skill.dual_buff = db;
    }
    if (forced.dual_debuff) {
      const dd = (skill.dual_debuff as string[]) ?? [];
      for (const d of forced.dual_debuff) { if (!dd.includes(d)) dd.push(d); }
      skill.dual_debuff = dd;
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

  const transcendDescs = new Map<number, string[]>();
  if (uniquePassiveId) {
    for (const row of skillLevelData) {
      if (row.SkillID === uniquePassiveId) {
        const sl = parseInt(row.SkillLevel) || 0;
        if (sl <= 0) continue;
        // Search all fields for SE_DESC keys (bytes parser shifts columns)
        const keys: string[] = [];
        for (const val of Object.values(row)) {
          if (!val || typeof val !== 'string') continue;
          for (const part of val.split(',')) {
            const t = part.trim();
            if (t.startsWith('SE_DESC_') || t.startsWith('SKILL_DESC_B_') || t.startsWith('SKILL_NAME_B_')) {
              keys.push(t);
            }
          }
        }
        if (keys.length > 0) transcendDescs.set(sl, keys);
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

      // Add transcend descriptions, stripping "Burst Level X Unlocked" only when
      // there are other lines alongside it (e.g. 2000063 has extra effects on the same SE_DESC key)
      const BURST_LINE_RE: Record<Lang, RegExp> = {
        en: /^Burst Level \d+ Unlocked$/i,
        jp: /^バーストスキル\d+段階解禁$/,
        kr: /^버스트 \d+단계 해금$/,
        zh: /^解锁\d+阶段?爆发$/,
      };
      if (skillLevel > 0 && skillLevel > lastDescSkillLevel) {
        lastDescSkillLevel = skillLevel;
        const descKeys = transcendDescs.get(skillLevel);
        if (descKeys) {
          for (const descKey of descKeys) {
            const texts = textSkillMap[descKey];
            if (texts) {
              for (const lang of LANGS) {
                const txt = texts[lang];
                if (!txt) continue;
                // Strip "Burst Level 2 Unlocked" lines only (keep Burst Level 3+)
                const filtered = txt.replace(/\\n/g, '\n').split('\n')
                  .filter(line => {
                    if (!BURST_LINE_RE[lang].test(line.trim())) return true;
                    // Only strip level 2 burst unlock
                    return !/2/.test(line);
                  })
                  .join('\n').trim();
                if (filtered) lines[lang].push(filtered);
              }
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
  'Rarity', 'Element', 'Class', 'SubClass', 'tags', 'Chain_Type', 'gift',
  'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
  'hasCoreFusion', 'coreFusionId',
  'fusionType', 'originalCharacter',
];

const PROFILE_FIELDS = ['birthday', 'height', 'weight'];

const SKILL_FIELDS = [
  'name', 'name_jp', 'name_kr', 'name_zh',
  'wgr', 'cd', 'offensive', 'target',
  'wgr_dual', 'dual_offensive', 'dual_target',
];

// Array fields compared as JSON
const SKILL_ARRAY_FIELDS = ['buff', 'debuff', 'dual_buff', 'dual_debuff'];
const SKILL_KEYS = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE'];

async function handleCompare() {
  // Load all templets once
  const [charTemplet, textChar, textSys, textSkill, extraTemplet,
    skillTemplet, skillLevelTemplet, buffTemplet, trustTemplet, fusionTemplet, changeTemplet,
    transcendTemplet, recruitTemplet, profileTemplet,
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
    readTemplet('RecruitGroupTemplet'),
    readTemplet('ArchiveCharacterProfileTemplet'),
  ]);

  // Read existing character-profiles.json
  const profilesPath = path.join(process.cwd(), 'data', 'character-profiles.json');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingProfiles: Record<string, any> = {};
  try {
    existingProfiles = JSON.parse(await fs.readFile(profilesPath, 'utf-8'));
  } catch { /* */ }

  // Index profile templet by CharacterID
  const profileByCharId = new Map<string, Record<string, string>>();
  for (const row of profileTemplet.data) {
    if (row.CharacterID) profileByCharId.set(row.CharacterID, row);
  }

  // Read existing character files
  const existingDir = path.join(process.cwd(), 'data', 'character');
  let existingFiles: string[] = [];
  try {
    existingFiles = (await fs.readdir(existingDir)).filter(f => f.endsWith('.json'));
  } catch { /* */ }

  // Lazy-loaded templets for core fusion comparison
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fusionLevelTemplet: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemTempletData: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let textItemData: any = null;

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

    // Collect extra buff IDs from Skill_23 (class passive)
    const cmpPassiveBuffIds = new Map<string, string[]>();
    const cmpPassiveSid = charRow.Skill_23;
    if (cmpPassiveSid) {
      const cmpPassiveLevels = skillLevelTemplet.data.filter(lv => lv.SkillID === cmpPassiveSid);
      for (const lv of cmpPassiveLevels) {
        for (const val of Object.values(lv)) {
          if (typeof val !== 'string') continue;
          for (const part of val.split(',')) {
            const t = part.trim();
            const m = t.match(new RegExp(`^${id}_(\\d+)_`));
            if (m) {
              const sn = m[1];
              const arr = cmpPassiveBuffIds.get(sn) ?? [];
              if (!arr.includes(t)) arr.push(t);
              cmpPassiveBuffIds.set(sn, arr);
            }
          }
        }
      }
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

    const autoTags = sortTags([...new Set([
      ...detectTags(id, buffTemplet.data, recruitTemplet.data, extraTemplet.data),
      ...(Array.isArray(existing.tags) && existing.tags.includes('free') ? ['free'] : []),
    ])]);

    const extracted: Record<string, unknown> = {
      ...expandLang('Fullname', fullnameTexts),
      Rarity: BASIC_STAR_OVERRIDE[id] ?? (parseInt(charRow.BasicStar) || 0),
      Element: resolveElement(textSysMap, charRow.Element ?? ''),
      Class: resolveClass(textSysMap, charRow.Class ?? ''),
      SubClass: resolveSubClass(textSysMap, charRow.SubClass ?? ''),
      tags: autoTags,
      Chain_Type: chainType,
      gift,
      ...expandLang('VoiceActor', voiceActorTexts),
      hasCoreFusion: fusionRow ? true : undefined,
      coreFusionId: fusionRow?.ChangeCharID ?? undefined,
    };

    // Core fusion: extract fusion-specific fields
    if (id.startsWith('2700')) {
      const cfRow = fusionTemplet.data.find((r: Record<string, string>) => r.ChangeCharID === id);
      if (cfRow) {
        if (!fusionLevelTemplet) fusionLevelTemplet = await readTemplet('CharacterFusionLevelTemplet');
        if (!itemTempletData) {
          const [it, ti] = await Promise.all([readTemplet('ItemTemplet'), readTemplet('TextItem')]);
          itemTempletData = it; textItemData = ti;
        }
        const levels = fusionLevelTemplet.data.filter((r: Record<string, string>) => r.FusionGroupID === cfRow.FusionGroupID);
        const materialItemId = levels[0]?.RequireItemID ?? '';
        const itemRow = itemTempletData.data.find((r: Record<string, string>) => r.ID === materialItemId);
        const itemName = itemRow?.NameIDSymbol
          ? (buildTextMap(textItemData.data)[itemRow.NameIDSymbol]?.en ?? materialItemId)
          : materialItemId;

        extracted.fusionType = 'core-fusion';
        extracted.originalCharacter = cfRow.RecruitID;
        extracted.fusionRequirements = {
          transcendence: (parseInt(cfRow.CharacterID) || 1) - 1,
          material: { id: itemName, quantity: parseInt(levels[0]?.Skill_1) || 0 },
        };
        const costPerLevel: Record<number, { item: string; nb: number }> = {};
        levels.forEach((lv: Record<string, string>, i: number) => {
          costPerLevel[i + 1] = { item: materialItemId, nb: parseInt(lv.Skill_1) || 0 };
        });
        extracted.costPerLevel = costPerLevel;
      }
    }

    for (const field of INFO_FIELDS) {
      if (!(field in existing) && !(field in extracted)) continue;
      // For array fields like tags, sort before comparing to ignore order
      const eVal = existing[field] ?? '';
      const aVal = extracted[field] ?? '';
      const e = Array.isArray(eVal) ? [...eVal].sort().join(', ') : String(eVal);
      const a = Array.isArray(aVal) ? [...aVal].sort().join(', ') : String(aVal);
      if (e !== a) diffs.push({ field, existing: e, extracted: a });
    }

    // Compare profile fields (from character-profiles.json)
    // Core fusion: fallback to base character for birthday/height/weight
    const cmpBaseId = isCoreFusion
      ? fusionTemplet.data.find((r: Record<string, string>) => r.ChangeCharID === id)?.RecruitID ?? id
      : id;
    const profileRow = profileByCharId.get(id) ?? (isCoreFusion ? profileByCharId.get(cmpBaseId) : undefined);
    const existingProfile = existingProfiles[id] ?? {};
    if (profileRow) {
      const bday = profileRow.Birthday ?? '';
      const month = bday.length >= 8 ? bday.slice(4, 6) : '';
      const day = bday.length >= 8 ? bday.slice(6, 8) : '';
      const extractedProfile: Record<string, string> = {
        birthday: month && day ? `${month}/${day}` : '',
        height: profileRow.Height ? `${profileRow.Height} cm` : '',
        weight: profileRow.Weight ? `${profileRow.Weight} kg` : '',
      };
      for (const field of PROFILE_FIELDS) {
        const e = String(existingProfile[field] ?? '');
        const a = String(extractedProfile[field] ?? '');
        if (e !== a) diffs.push({ field: `profile.${field}`, existing: e, extracted: a });
      }

      // Compare story: try character-specific key first (core fusion has own story)
      const storySym = textSysMap[`SYS_ACHIEVE_PROFILE_${id}`] ? `SYS_ACHIEVE_PROFILE_${id}` : (profileRow.ScenarioIDSymbol ?? '');
      if (storySym) {
        const storyTexts = textSysMap[storySym];
        if (storyTexts) {
          const existingStory = existingProfile.story ?? {};
          for (const lang of LANGS) {
            const e = String(existingStory[lang] ?? '');
            const a = String(storyTexts[lang] ?? '');
            if (e && a && e !== a) diffs.push({ field: `profile.story_${lang}`, existing: e.slice(0, 80) + '...', extracted: a.slice(0, 80) + '...' });
          }
        }
      }

      // Check fullname in profile
      const existingFullname = existingProfile.fullname ?? {};
      for (const lang of LANGS) {
        const key = lang === DEFAULT_LANG ? 'en' : lang;
        const e = String(existingFullname[key] ?? '');
        const a = String(fullnameTexts[lang] ?? '');
        if (e && a && e !== a) diffs.push({ field: `profile.fullname_${lang}`, existing: e, extracted: a });
      }
    }

    // Compare complex fusion fields as JSON
    for (const field of ['fusionRequirements', 'costPerLevel']) {
      if (!(field in existing) && !(field in extracted)) continue;
      const e = JSON.stringify(existing[field] ?? null);
      const a = JSON.stringify(extracted[field] ?? null);
      if (e !== a) diffs.push({ field, existing: e, extracted: a });
    }

    // ── HEAVY_STRIKE detection: passive with -100% crit rate ──
    const hasHeavyStrike = buffTemplet.data.some(r =>
      r.BuffID?.startsWith(`${id}_passive`) &&
      r.StatType === 'ST_CRITICAL_RATE' &&
      r.Value === '-1000' &&
      r.ApplyingType === 'OAT_RATE',
    );

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
      let target: string | string[] | null;
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

      // Extract buff/debuff (include class passive buff IDs from Skill_23)
      const cmpSlotNum = (sidSlotMap.get(sid) ?? '').replace('Skill_', '');
      const cmpExtraIds = cmpPassiveBuffIds.get(cmpSlotNum) ?? [];
      const skillBD = isChain
        ? extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'chain', buffTemplet.data), buffTemplet.data)
        : sk === 'SKT_FUSION_PASSIVE'
          ? extractBuffDebuff(collectFusionPassiveBuffIds(levels, buffTemplet.data), buffTemplet.data)
          : extractBuffDebuff([...collectBuffGroupIds(levels), ...cmpExtraIds], buffTemplet.data);

      // Merge transform character's buffs (e.g. Luna 2000119 ↔ 2000120)
      const changeRow = changeTemplet.data.find(r => r.ID === id);
      const changeId = changeRow?.ID_fallback1 ?? null;
      if (changeId) {
        const changeCharRow2 = charTemplet.data.find(r => r.ModelID === changeId);
        if (changeCharRow2) {
          const changeSids2: string[] = [];
          for (let i = 1; i <= 23; i++) { const s = changeCharRow2[`Skill_${i}`]; if (s) changeSids2.push(s); }
          const changeSRow = skillTemplet.data.find(r => r.SkillType === sk && r.NameIDSymbol && changeSids2.includes(r.NameIDSymbol));
          if (changeSRow) {
            const changeLevels = skillLevelTemplet.data.filter(r => r.SkillID === changeSRow.NameIDSymbol);
            const changeBD = isChain
              ? extractBuffDebuff(collectBuffGroupIdsByPattern(changeId, 'chain', buffTemplet.data), buffTemplet.data)
              : extractBuffDebuff(collectBuffGroupIds(changeLevels), buffTemplet.data);
            for (const b of changeBD.buff) { if (!skillBD.buff.includes(b)) skillBD.buff.push(b); }
            for (const d of changeBD.debuff) { if (!skillBD.debuff.includes(d)) skillBD.debuff.push(d); }
          }
        }
      }

      // Dual fields for chain passive
      let dualData: Record<string, unknown> = {};
      if (isChain) {
        const dualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'backup', buffTemplet.data), buffTemplet.data);
        if (changeId) {
          const changeDualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(changeId, 'backup', buffTemplet.data), buffTemplet.data);
          for (const b of changeDualBD.buff) { if (!dualBD.buff.includes(b)) dualBD.buff.push(b); }
          for (const d of changeDualBD.debuff) { if (!dualBD.debuff.includes(d)) dualBD.debuff.push(d); }
        }
        dualData = { wgr_dual: 1, dual_offensive: true, dual_target: 'mono', dual_buff: dualBD.buff, dual_debuff: dualBD.debuff };
      }

      // Merge burst skill buffs into the main skill if it has burnEffect
      const rapCheck = sRow.RequireAP ?? '';
      if (/^\d+,\d+,\d+$/.test(rapCheck)) {
        const burstTypes2 = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'];
        for (const bt of burstTypes2) {
          const bRow = skillTemplet.data.find(r => r.SkillType === bt && r.NameIDSymbol && sids.includes(r.NameIDSymbol));
          if (!bRow) continue;
          const bLevels = skillLevelBySID.get(bRow.NameIDSymbol) ?? [];
          if (bLevels.length > 0) {
            const bd = extractBuffDebuff(collectBuffGroupIds(bLevels), buffTemplet.data);
            for (const b of bd.buff) skillBD.buff.push(b);
            for (const d of bd.debuff) skillBD.debuff.push(d);
          }
          if (bRow.IconName === 'SE_DESC_DMG_WG_V_1') {
            skillBD.debuff.push('BT_WG_REVERSE_HEAL');
          }
        }
        // Deduplicate
        skillBD.buff = [...new Set(skillBD.buff)];
        skillBD.debuff = [...new Set(skillBD.debuff)];
      }

      const extractedSkill: Record<string, unknown> = {
        ...expandLang('name', resolvedNames),
        wgr,
        cd,
        offensive,
        target,
        ...dualData,
      };

      // Compare scalar fields
      for (const sf of SKILL_FIELDS) {
        if (!(sf in existingSkill)) continue;
        const e = String(existingSkill[sf] ?? '');
        const a = String(extractedSkill[sf] ?? '');
        if (e !== a) diffs.push({ field: `${sk}.${sf}`, existing: e, extracted: a });
      }

      // HEAVY_STRIKE: add to offensive skills if character has -100% crit rate passive
      if (hasHeavyStrike && offensive) {
        if (!skillBD.buff.includes('HEAVY_STRIKE')) skillBD.buff.unshift('HEAVY_STRIKE');
      }
      if (hasHeavyStrike && (dualData.dual_offensive as boolean)) {
        const db = (dualData.dual_buff as string[]) ?? [];
        if (!db.includes('HEAVY_STRIKE')) { db.unshift('HEAVY_STRIKE'); dualData.dual_buff = db; }
      }

      // Apply forced buff/debuff overrides
      const forceKey = `${id}:${sk}`;
      const forcedBD = SKILL_BUFF_FORCE[forceKey];
      if (forcedBD) {
        if (forcedBD.buff) for (const b of forcedBD.buff) { if (!skillBD.buff.includes(b)) skillBD.buff.push(b); }
        if (forcedBD.debuff) for (const d of forcedBD.debuff) { if (!skillBD.debuff.includes(d)) skillBD.debuff.push(d); }
      }

      // Compare array fields (buff, debuff, dual_buff, dual_debuff)
      const extractedArrays: Record<string, string[]> = {
        buff: skillBD.buff,
        debuff: skillBD.debuff,
        dual_buff: (dualData.dual_buff as string[]) ?? [],
        dual_debuff: (dualData.dual_debuff as string[]) ?? [],
      };
      for (const af of SKILL_ARRAY_FIELDS) {
        if (!(af in existingSkill)) continue;
        const eArr = JSON.stringify((existingSkill[af] ?? []).slice().sort());
        const aArr = JSON.stringify((extractedArrays[af] ?? []).slice().sort());
        if (eArr !== aArr) {
          diffs.push({
            field: `${sk}.${af}`,
            existing: (existingSkill[af] ?? []).join(', '),
            extracted: (extractedArrays[af] ?? []).join(', '),
          });
        }
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
        const descs: string[] = [];
        for (const val of Object.values(lv)) {
          if (!val || typeof val !== 'string') continue;
          for (const part of val.split(',')) {
            const t = part.trim();
            if (t.startsWith('SE_DESC_') || t.startsWith('SKILL_DESC_B_') || t.startsWith('SKILL_NAME_B_')) {
              descs.push(t);
            }
          }
        }
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
          const bNames = textSkillMap[bDescKey] ?? textSkillMap[bDescKey.toUpperCase()];
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

// ── Inspect (new character deep scan) ────────────────────────────────

async function handleInspect(id: string) {
  const sections: Record<string, unknown> = {};

  // 1. CharacterTemplet — basic stats & skill IDs
  const charTemplet = await readTemplet('CharacterTemplet');
  const charRow = charTemplet.data.find((r) => r.ModelID === id);
  if (!charRow) {
    return NextResponse.json({ error: `Character ${id} not found in CharacterTemplet` }, { status: 404 });
  }

  const sids: string[] = [];
  for (let i = 1; i <= 23; i++) {
    const s = charRow[`Skill_${i}`];
    if (s) sids.push(s);
  }

  const textSys = await readTemplet('TextSystem');
  const textSysMap = buildTextMap(textSys.data);

  sections.characterTemplet = {
    Element: resolveElement(textSysMap, charRow.Element ?? ''),
    Class: resolveClass(textSysMap, charRow.Class ?? ''),
    SubClass: resolveSubClass(textSysMap, charRow.SubClass ?? ''),
    BasicStar: charRow.BasicStar,
    skillIds: sids,
  };

  // 2. CharacterExtraTemplet
  const extraTemplet = await readTemplet('CharacterExtraTemplet');
  const extraRow = extraTemplet.data.find((r) => r.CharacterID === id);
  if (extraRow) sections.characterExtra = extraRow;

  // 3. Text entries (TextCharacter, TextSystem, TextSkill, TextItem)
  const textEntries: Record<string, string[]> = {};
  for (const tName of ['TextCharacter', 'TextSystem', 'TextSkill', 'TextItem']) {
    const { data } = await readTemplet(tName);
    const matches = data.filter((r) =>
      Object.values(r).some((v) => typeof v === 'string' && v.includes(id)),
    );
    if (matches.length > 0) {
      textEntries[tName] = matches.map((r) => {
        const sym = r.IDSymbol ?? r.ID ?? '';
        const en = r.English ?? '';
        return `${sym}: ${en.substring(0, 150)}`;
      });
    }
  }
  if (Object.keys(textEntries).length > 0) sections.texts = textEntries;

  // 4. CharacterSkillTemplet — check if skills exist
  const skillTemplet = await readTemplet('CharacterSkillTemplet');
  const charSkills = skillTemplet.data.filter((r) => sids.includes(r.NameIDSymbol));
  if (charSkills.length > 0) {
    sections.skills = charSkills.map((r) => ({
      id: r.NameIDSymbol,
      type: r.SkillType,
      requireAP: r.RequireAP,
    }));
  }

  // 5. CharacterSkillLevelTemplet — check for level data
  const skillLevelTemplet = await readTemplet('CharacterSkillLevelTemplet');
  const charSkillLevels = skillLevelTemplet.data.filter((r) => sids.includes(r.SkillID));
  if (charSkillLevels.length > 0) {
    sections.skillLevels = `${charSkillLevels.length} entries across ${new Set(charSkillLevels.map((r) => r.SkillID)).size} skills`;
  }

  // 6. BuffTemplet — search for any buff with this character ID
  const buffTemplet = await readTemplet('BuffTemplet');
  const charBuffs = buffTemplet.data.filter((r) => r.BuffID && r.BuffID.startsWith(`${id}_`));
  if (charBuffs.length > 0) {
    const byPrefix: Record<string, { type: string; bdType: string }[]> = {};
    for (const b of charBuffs) {
      const prefix = b.BuffID.split('_').slice(0, 2).join('_');
      if (!byPrefix[prefix]) byPrefix[prefix] = [];
      const key = `${b.Type}|${b.BuffDebuffType}`;
      if (!byPrefix[prefix].some((x) => `${x.type}|${x.bdType}` === key)) {
        byPrefix[prefix].push({ type: b.Type, bdType: b.BuffDebuffType });
      }
    }
    sections.buffs = byPrefix;
  }

  // 7. EE (Exclusive Equipment) from BuffTemplet
  const eeBuffs = buffTemplet.data.filter((r) => r.BuffID && r.BuffID.includes(`CEQUIP_${id}`));
  if (eeBuffs.length > 0) {
    sections.exclusiveEquipment = [...new Set(eeBuffs.map((r) => r.BuffID))].map((bid) => {
      const row = eeBuffs.find((r) => r.BuffID === bid);
      return { buffId: bid, type: row?.Type, statType: row?.StatType };
    });
  }

  // 8. RecruitGroupTemplet — banner info
  const recruitTemplet = await readTemplet('RecruitGroupTemplet');
  const banners = recruitTemplet.data.filter((r) => r.EndDateTime === id);
  if (banners.length > 0) {
    sections.banners = banners.map((r) => ({
      bannerType: r.RollingBannerImage,
      showDateMarker: r.ShowDate_fallback1,
      showDateFb2: r.ShowDate_fallback2,
    }));
  }

  // 9. CharacterFusionTemplet
  const fusionTemplet = await readTemplet('CharacterFusionTemplet');
  const fusionRow = fusionTemplet.data.find((r) => r.ChangeCharID === id || r.RecruitID === id);
  if (fusionRow) sections.fusion = fusionRow;

  // 10. CharacterTranscendentTemplet
  const transcendTemplet = await readTemplet('CharacterTranscendentTemplet');
  const transcendRows = transcendTemplet.data.filter((r) =>
    Object.values(r).includes(id),
  );
  if (transcendRows.length > 0) sections.transcend = `${transcendRows.length} entries`;

  // 11. ItemTemplet — EE item
  const itemTemplet = await readTemplet('ItemTemplet');
  const eeItem = itemTemplet.data.find((r) => r.ID === id || r.LevelLimit === id);
  if (eeItem) sections.eeItem = { id: eeItem.ID, name: eeItem.DescIDSymbol, icon: eeItem.IconName };

  // 12. ArchiveCharacterProfileTemplet — birthday, height, weight
  const archiveTemplet = await readTemplet('ArchiveCharacterProfileTemplet');
  const archiveRow = archiveTemplet.data.find((r) => r.CharacterID === id);
  if (archiveRow) {
    sections.profile = {
      birthday: archiveRow.Birthday,
      height: archiveRow.Height,
      weight: archiveRow.Weight,
    };
  }

  // 13. TrustRewardTemplet — gift/trust rewards
  const trustRewardTemplet = await readTemplet('TrustRewardTemplet');
  const trustRewards = trustRewardTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v === id),
  );
  if (trustRewards.length > 0) {
    sections.trustRewards = trustRewards.map((r) => ({
      id: r.ID,
      level: r.TrustLevel,
      rewardId: r.RewardID,
    }));
  }

  // 14. CharacterEvolutionStatTemplet — stats per star
  const evoStatTemplet = await readTemplet('CharacterEvolutionStatTemplet');
  const evoStats = evoStatTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v === id),
  );
  if (evoStats.length > 0) {
    sections.evolutionStats = evoStats.map((r) => ({
      star: r.BasicStar ?? r.NextStar,
      hp: r.RewardHPRate,
      atk: r.RewardAtkRate,
      def: r.RewardDefRate,
    }));
  }

  // 15. CharacterDamageTemplet
  const dmgTemplet = await readTemplet('CharacterDamageTemplet');
  const dmgRows = dmgTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v === id),
  );
  if (dmgRows.length > 0) sections.damageEntries = `${dmgRows.length} entries`;

  // 16. CostumeTemplet — skins
  const costumeTemplet = await readTemplet('CostumeTemplet');
  const costumes = costumeTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v === id),
  );
  if (costumes.length > 0) {
    sections.costumes = costumes.map((r) => ({
      id: r.ID,
      name: r.CostumeNameID ?? r.NameIDSymbol,
    }));
  }

  // 17. ChainCombinationTemplet — chain combos
  const chainTemplet = await readTemplet('ChainCombinationTemplet');
  const chainRows = chainTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v === id),
  );
  if (chainRows.length > 0) {
    sections.chainCombinations = chainRows.map((r) => {
      const members: string[] = [];
      for (let i = 0; i <= 5; i++) {
        const m = r[`MemberID${i}`] ?? r[`MemberID_${i}`];
        if (m) members.push(m);
      }
      return { id: r.ID, members };
    });
  }

  // 18. ItemSpecialOptionTemplet — special item options
  const specialOptTemplet = await readTemplet('ItemSpecialOptionTemplet');
  const specialOpts = specialOptTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v.includes(id)),
  );
  if (specialOpts.length > 0) sections.itemSpecialOptions = specialOpts;

  // 19. RageTemplet — burst/rage data
  const rageTemplet = await readTemplet('RageTemplet');
  const rageRows = rageTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v === id),
  );
  if (rageRows.length > 0) sections.rage = rageRows;

  // 20. StateTemplet — state/passive data
  const stateTemplet = await readTemplet('StateTemplet');
  const stateRows = stateTemplet.data.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && v.includes(id)),
  );
  if (stateRows.length > 0) sections.states = `${stateRows.length} entries`;

  return NextResponse.json({ id, sections });
}

// ── Image copy ───────────────────────────────────────────────────────

const DATAMINE_ROOT = path.join(process.cwd(), 'datamine', 'extracted_astudio', 'assets', 'editor', 'resources');
const PUBLIC_IMAGES = path.join(process.cwd(), 'public', 'images', 'characters');

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

type CopyResult = 'copied' | 'exists' | 'missing';

async function copyIfMissing(src: string, dest: string): Promise<CopyResult> {
  if (await fileExists(dest)) return 'exists';
  if (!(await fileExists(src))) return 'missing';
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return 'copied';
}

async function copyCharacterImages(id: string, skillIcons?: string[]): Promise<{ copied: number; exists: number; missing: number }> {
  const jobs: [string, string][] = [
    // ATB portraits
    [
      path.join(DATAMINE_ROOT, 'sprite', 'at_dungeonruntime', `IG_Turn_${id}.png`),
      path.join(PUBLIC_IMAGES, 'atb', `IG_Turn_${id}.png`),
    ],
    [
      path.join(DATAMINE_ROOT, 'sprite', 'at_dungeonruntime', `IG_Turn_${id}_E.png`),
      path.join(PUBLIC_IMAGES, 'atb', `IG_Turn_${id}_E.png`),
    ],
    // Full art
    [
      path.join(DATAMINE_ROOT, 'prefabs', 'ui', 'illust', `illust_${id}`, `IMG_${id}.png`),
      path.join(PUBLIC_IMAGES, 'full', `IMG_${id}.png`),
    ],
    // Portrait
    [
      path.join(DATAMINE_ROOT, 'sprite', 'at_thumbnailcharacterruntime', `CT_${id}.png`),
      path.join(PUBLIC_IMAGES, 'portrait', `CT_${id}.png`),
    ],
  ];

  // Skill icons from actual IconName fields
  const icons = skillIcons ?? [`Skill_First_${id}`, `Skill_Second_${id}`, `Skill_Ultimate_${id}`];
  for (const icon of icons) {
    jobs.push([
      path.join(DATAMINE_ROOT, 'sprite', 'at_skillruntime', `${icon}.png`),
      path.join(PUBLIC_IMAGES, 'skills', `${icon}.png`),
    ]);
  }

  const results = await Promise.all(jobs.map(([src, dest]) => copyIfMissing(src, dest)));
  const missingFiles = jobs.filter((_, i) => results[i] === 'missing').map(([src]) => src);
  if (missingFiles.length > 0) {
    console.log(`[copyCharacterImages] ${id} missing:`, missingFiles);
  }
  return {
    copied: results.filter(r => r === 'copied').length,
    exists: results.filter(r => r === 'exists').length,
    missing: results.filter(r => r === 'missing').length,
  };
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
        isFree?: boolean;
        isLimited?: boolean;
        rank_by_transcend?: Record<string, string> | null;
        role_by_transcend?: Record<string, string> | null;
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
    let existingRaw: string | undefined;
    try {
      existingRaw = await fs.readFile(existingPath, 'utf-8');
      existing = JSON.parse(existingRaw);
    } catch { /* new character */ }

    // Merge skills: extracted + preserve existing buff/debuff/true_desc/burnEffect
    const mergedSkills: Record<string, unknown> = {};
    for (const sk of ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE']) {
      const extracted = skillsData.skills?.[sk];
      if (!extracted) continue;

      const merged: Record<string, unknown> = { ...extracted };

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

    // Build final character JSON (exclude profile fields — they go in character-profiles.json)
    const { birthday: _b, height: _h, weight: _w, story: _s, ...infoWithoutProfile } = info;
    const character = orderKeys({
      ...infoWithoutProfile,
      rank: manual.rank ?? existing.rank ?? null,
      rank_pvp: info.Rarity > 2 ? (manual.rank_pvp ?? existing.rank_pvp ?? null) : undefined,
      role: manual.role ?? existing.role ?? null,
      // tags: auto-detected from info + 'free' preserved from existing or manual checkbox
      tags: (() => {
        const hasFree = manual.isFree !== undefined
          ? manual.isFree
          : Array.isArray(existing.tags) && existing.tags.includes('free');
        const t = sortTags([...new Set([...(info.tags ?? []), ...(hasFree ? ['free'] : [])])]);
        return t.length > 0 ? t : undefined;
      })(),
      skill_priority: manual.skill_priority ?? existing.skill_priority ?? { First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 } },
      video: manual.video ?? existing.video ?? undefined,
      limited: manual.isLimited ? true : (existing.limited === true ? true : undefined),
      rank_by_transcend: manual.rank_by_transcend ?? existing.rank_by_transcend ?? undefined,
      role_by_transcend: manual.role_by_transcend ?? existing.role_by_transcend ?? undefined,
      transcend: groupByLang(transcendData.transcend),
      skills: mergedSkills,
    }, TOP_LEVEL_KEY_ORDER);

    // Remove undefined values
    for (const key of Object.keys(character)) {
      if (character[key] === undefined) delete character[key];
    }

    // Write character file
    const outputDir = path.join(process.cwd(), 'data', 'character');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, `${id}.json`),
      stringifyCharacter(character, existingRaw),
      'utf-8',
    );

    // Update character-profiles.json (serialized via mutex to avoid race conditions during Extract All)
    if (info.birthday || info.height || info.weight || info.story) {
      await profileMutex(async () => {
        const profilesPath = path.join(process.cwd(), 'data', 'character-profiles.json');
        let profilesRaw = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let profiles: Record<string, any> = {};
        try {
          profilesRaw = await fs.readFile(profilesPath, 'utf-8');
          profiles = JSON.parse(profilesRaw);
        } catch { /* */ }

        profiles[id] = {
          fullname: {
            en: info.Fullname ?? '',
            jp: info.Fullname_jp ?? '',
            kr: info.Fullname_kr ?? '',
            zh: info.Fullname_zh ?? '',
          },
          birthday: info.birthday ?? '',
          height: info.height ?? '',
          weight: info.weight ?? '',
          story: info.story ?? {},
        };

        const eol = profilesRaw.includes('\r\n') ? '\r\n' : '\n';
        let output = JSON.stringify(profiles, null, 2) + '\n';
        if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
        await fs.writeFile(profilesPath, output, 'utf-8');
      });
    }

    // Copy images if missing — use actual IconName from extracted skills
    const skillIcons: string[] = [];
    for (const sk of ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE']) {
      const icon = (mergedSkills[sk] as Record<string, unknown>)?.IconName;
      if (icon && typeof icon === 'string') skillIcons.push(icon);
    }
    const imagesCopied = await copyCharacterImages(id, skillIcons.length > 0 ? skillIcons : undefined);

    return NextResponse.json({ ok: true, id, imagesCopied });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

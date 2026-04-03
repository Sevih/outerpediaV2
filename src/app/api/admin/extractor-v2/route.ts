import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { stringifyCharacter, orderKeys, TOP_LEVEL_KEY_ORDER, SKILL_KEY_ORDER } from '@/app/api/admin/lib/character-json';
import {
  LANGS, DEFAULT_LANG, SUFFIX_LANGS, type Lang, type LangTexts,
  readTemplet, buildTextMap, expandLang,
  resolveElement, resolveClass, resolveSubClass,
  buildBuffIndex, resolveBuffPlaceholders, extractBuffDebuff, collectBuffGroupIds, collectFusionPassiveBuffIds, collectBuffGroupIdsByPattern,
  resolveTarget, GIFT_MAP, resolveChainType,
  detectTags, sortTags,
} from '@/app/admin/lib/config-v2';

// Simple async mutex for serializing writes to shared files
function createMutex() {
  let chain = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn, fn);
    chain = p.then(() => {}, () => {});
    return p;
  };
}
const profileMutex = createMutex();

function groupByLang(obj: Record<string, string>): Record<string, string> {
  const langSuffixes = SUFFIX_LANGS.map(l => `_${l}`);
  const defaultKeys: string[] = [];
  const langGroups: Record<string, string[]> = {};
  for (const lang of SUFFIX_LANGS) langGroups[lang] = [];

  for (const key of Object.keys(obj)) {
    const matchedLang = SUFFIX_LANGS.find(l => key.endsWith(`_${l}`));
    if (matchedLang) langGroups[matchedLang].push(key);
    else defaultKeys.push(key);
  }

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

// ── GET ─────────────────────────────────────────────────────────────

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

// ── Shared helpers ──────────────────────────────────────────────────

/** Extract skill IDs referenced by a character row */
function getSkillIds(charRow: Record<string, string>): string[] {
  const ids: string[] = [];
  for (let i = 1; i <= 23; i++) {
    const sid = charRow[`Skill_${i}`];
    if (sid) ids.push(sid);
  }
  return ids;
}

// ── List ─────────────────────────────────────────────────────────────

async function handleList() {
  const [charData, textChar, textSys, extraData, changeData] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('CharacterChangeTemplet'),
  ]);

  const textMap = buildTextMap(textChar);
  const textSysMap = buildTextMap(textSys);

  const showNickIds = new Set(
    extraData.filter(r => r.ShowNickName === 'True').map(r => r.CharacterID)
  );

  const changeTargetIds = new Set(
    changeData.map(r => r.ChangeCharacterID).filter(Boolean)
  );

  const pcOnly = charData.filter(r => {
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

  const seen = new Set<string>();
  const characters: { id: string; name: string; element: string; class: string; rarity: number; exists: boolean }[] = [];
  for (const row of pcOnly) {
    const id = row.ModelID ?? '';
    if (seen.has(id)) continue;
    seen.add(id);
    const names = textMap[row.NameID ?? ''];
    let name = names?.[DEFAULT_LANG] ?? row.NameID ?? '';
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
      rarity: parseInt(row.BasicStar) || 0,
      exists: existingIds.has(id),
    });
  }

  characters.sort((a, b) => a.id.localeCompare(b.id));
  return NextResponse.json({ characters });
}

// ── Info ─────────────────────────────────────────────────────────────

async function handleInfo(id: string) {
  const [charData, textChar, textSys, textSkill, extraData, skillData, trustData, fusionData, recruitData, profileData] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSystem'),
    readTemplet('TextSkill'),
    readTemplet('CharacterExtraTemplet'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('TrustTemplet'),
    readTemplet('CharacterFusionTemplet'),
    readTemplet('RecruitGroupTemplet'),
    readTemplet('ArchiveCharacterProfileTemplet'),
  ]);

  const textMap = buildTextMap(textChar);
  const textSysMap = buildTextMap(textSys);
  const charRow = charData.find(r => r.ModelID === id);
  if (!charRow) {
    return NextResponse.json({ error: `Character ${id} not found` }, { status: 404 });
  }

  const isCoreFusion = id.startsWith('2700');
  const names = textMap[charRow.NameID ?? ''];

  const showNick = extraData.some(r => r.CharacterID === id && r.ShowNickName === 'True');
  const nickNames = showNick ? textMap[`${id}_NickName`] : null;
  const fusionPrefix = isCoreFusion ? textSysMap['SYS_CHARACTER_FUSION_TITLE'] : null;

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

  // Voice actors
  const baseId = isCoreFusion
    ? fusionData.find(r => r.ChangeCharID === id)?.CharacterID ?? id
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

  // Chain type
  const skillIds = getSkillIds(charRow);
  const textSkillMap = buildTextMap(textSkill);
  let chainDesc = '';
  let chainIconName = '';
  for (const row of skillData) {
    if (row.SkillType === 'SKT_CHAIN_PASSIVE' && row.ID && skillIds.includes(row.ID)) {
      chainIconName = row.IconName ?? '';
      const descSym = (row.DescID ?? '').split(',')[0]?.trim();
      if (descSym) chainDesc = textSkillMap[descSym]?.[DEFAULT_LANG] ?? '';
      break;
    }
  }
  const chainType = resolveChainType(chainDesc, chainIconName);

  // Gift
  const trustRow = trustData.find(r => r.ID === id);
  const gift = GIFT_MAP[trustRow?.PresentTypeLike ?? ''] ?? null;

  // Core fusion check
  const fusionRow = fusionData.find(r => r.CharacterID === id);
  const hasCoreFusion = !!fusionRow;
  const coreFusionId = fusionRow?.ChangeCharID ?? undefined;

  const tags = sortTags(detectTags(id, recruitData, extraData));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {
    ID: id,
    ...expandLang('Fullname', fullnameTexts),
    Rarity: parseInt(charRow.BasicStar) || 0,
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

  // Core fusion fields
  if (id.startsWith('2700')) {
    const cfRow = fusionData.find(r => r.ChangeCharID === id);
    if (cfRow) {
      const fusionLevelData = await readTemplet('CharacterFusionLevelTemplet');
      const levels = fusionLevelData.filter(r => r.FusionGroupID === cfRow.FusionGroupID);

      const materialItemId = levels[0]?.RequireItemID ?? '';
      const itemData = await readTemplet('ItemTemplet');
      const textItem = await readTemplet('TextItem');
      const itemRow = itemData.find(r => r.ID === materialItemId);
      const itemName = itemRow?.NameID
        ? (buildTextMap(textItem)[itemRow.NameID]?.en ?? materialItemId)
        : materialItemId;

      result.fusionType = 'core-fusion';
      result.originalCharacter = cfRow.CharacterID;
      result.fusionRequirements = {
        transcendence: (parseInt(cfRow.CharacterTransStar) || 1) - 1,
        material: { id: itemName, quantity: parseInt(levels[0]?.Skill_1) || 0 },
      };
      const costPerLevel: Record<number, { item: string; nb: number }> = {};
      levels.forEach((lv, i) => {
        costPerLevel[i + 1] = { item: materialItemId, nb: parseInt(lv.Skill_1) || 0 };
      });
      result.costPerLevel = costPerLevel;
    }
  }

  // Profile
  const profileRow = profileData.find(r => r.CharacterID === id)
    ?? (isCoreFusion ? profileData.find(r => r.CharacterID === baseId) : undefined);
  if (profileRow) {
    const bday = profileRow.Birth ?? '';
    const month = bday.length >= 8 ? bday.slice(4, 6) : '';
    const day = bday.length >= 8 ? bday.slice(6, 8) : '';
    result.birthday = month && day ? `${month}/${day}` : '';
    result.height = profileRow.Height ? `${profileRow.Height} cm` : '';
    result.weight = profileRow.Weight ? `${profileRow.Weight} kg` : '';

    const storySym = textSysMap[`SYS_ACHIEVE_PROFILE_${id}`] ? `SYS_ACHIEVE_PROFILE_${id}` : (profileRow.ProfileScenario ?? '');
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
  const [charData, textSkill, skillData, skillLevelData, buffData, changeData] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('TextSkill'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('CharacterSkillLevelTemplet'),
    readTemplet('BuffTemplet'),
    readTemplet('CharacterChangeTemplet'),
  ]);

  const textSkillMap = buildTextMap(textSkill);
  const buffIndex = buildBuffIndex(buffData);

  const charRow = charData.find(r => r.ModelID === id);
  if (!charRow) {
    return NextResponse.json({ error: `Character ${id} not found` }, { status: 404 });
  }

  const changeRow = changeData.find(r => r.ID === id);
  const changeId = changeRow?.ChangeCharacterID ?? null;
  const changeCharRow = changeId ? charData.find(r => r.ModelID === changeId) : null;

  const skillIds = getSkillIds(charRow);
  const sidToSlot = new Map<string, string>();
  for (let i = 1; i <= 23; i++) {
    const sid = charRow[`Skill_${i}`];
    if (sid) sidToSlot.set(sid, `Skill_${i}`);
  }

  const skillRows = new Map<string, Record<string, string>>();
  for (const row of skillData) {
    if (row.ID && skillIds.includes(row.ID)) {
      skillRows.set(row.ID, row);
    }
  }

  const skillLevelRows = new Map<string, Record<string, string>[]>();
  for (const row of skillLevelData) {
    if (row.SkillID && skillIds.includes(row.SkillID)) {
      const arr = skillLevelRows.get(row.SkillID) ?? [];
      arr.push(row);
      skillLevelRows.set(row.SkillID, arr);
    }
  }

  // Change character skill index
  const changeSkillsByType = new Map<string, { levels: Record<string, string>[]; row: Record<string, string> }>();
  if (changeCharRow) {
    const changeSids = getSkillIds(changeCharRow);
    for (const row of skillData) {
      if (row.ID && changeSids.includes(row.ID) && row.SkillType && WANTED_SKILL_TYPES.has(row.SkillType)) {
        const lvs = skillLevelData.filter(lv => lv.SkillID === row.ID);
        changeSkillsByType.set(row.SkillType, { levels: lvs, row });
      }
    }
  }

  const skills: Record<string, unknown> = {};

  for (const [sid, sRow] of skillRows) {
    const skillType = sRow.SkillType;
    if (!skillType || !WANTED_SKILL_TYPES.has(skillType)) continue;

    const skipNameId = sRow.SkipNameID ?? sRow.NameID ?? '';
    const resolvedNames = textSkillMap[skipNameId];

    // Descriptions per level
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

    const levels = skillLevelRows.get(sid) ?? [];
    const firstLevel = levels[0];

    // Cooldown — read directly from StartCool
    const hasCd = skillType === 'SKT_SECOND' || skillType === 'SKT_ULTIMATE';
    const rawCd = hasCd ? firstLevel?.StartCool ?? '' : '';
    const cd = rawCd && /^\d+$/.test(rawCd) ? parseInt(rawCd) : null;

    // Enhancement descriptions from DescID field in level rows
    const enhancement: Record<string, string[]> = {};
    for (const lv of levels) {
      const lvNum = lv.SkillLevel ?? '1';
      if (lvNum === '1') continue;
      const descId = lv.DescID ?? '';
      if (!descId) continue;
      const descs = descId.split(',').map(d => d.trim()).filter(d => d.startsWith('SE_DESC_') || d.startsWith('SKILL_DESC_B_') || d.startsWith('SKILL_NAME_B_'));
      if (descs.length === 0) continue;
      enhancement[lvNum] = descs.map(d => textSkillMap[d]?.[DEFAULT_LANG] ?? d);
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
      wgr = 3;
      offensive = true;
      target = 'multi';
    } else {
      let rangeType = sRow.RangeType ?? '';
      if (changeCharRow) {
        const changeSkillIds = getSkillIds(changeCharRow);
        const changeSRow = skillData.find(r =>
          r.SkillType === skillType && r.ID && changeSkillIds.includes(r.ID)
        );
        if (changeSRow?.RangeType && changeSRow.RangeType !== rangeType) {
          rangeType = `${rangeType},${changeSRow.RangeType}`;
        }
      }
      target = resolveTarget(rangeType);
      offensive = (sRow.TargetTeamType ?? '').includes('ENEMY');
      const rawWgr = offensive ? (parseInt(firstLevel?.WGReduce ?? '0') || 0) : null;
      wgr = rawWgr;
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
        ? extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'chain', buffData), buffData)
        : skillType === 'SKT_FUSION_PASSIVE'
          ? extractBuffDebuff(collectFusionPassiveBuffIds(levels, buffData), buffData)
          : extractBuffDebuff(collectBuffGroupIds(levels), buffData)),
    };

    // Merge transform character's buffs
    const changeSkill = changeSkillsByType.get(skillType);
    if (changeSkill) {
      const changeBD = isChain
        ? extractBuffDebuff(collectBuffGroupIdsByPattern(changeId!, 'chain', buffData), buffData)
        : extractBuffDebuff(collectBuffGroupIds(changeSkill.levels), buffData);
      const curBuff = (skillEntry.buff as string[]) ?? [];
      const curDebuff = (skillEntry.debuff as string[]) ?? [];
      for (const b of changeBD.buff) { if (!curBuff.includes(b)) curBuff.push(b); }
      for (const d of changeBD.debuff) { if (!curDebuff.includes(d)) curDebuff.push(d); }
      skillEntry.buff = curBuff;
      skillEntry.debuff = curDebuff;
    }

    // Chain passive: dual attack fields
    if (isChain) {
      const dualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'backup', buffData), buffData);
      if (changeId) {
        const changeDualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(changeId, 'backup', buffData), buffData);
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

  // ── burnEffect: burst skills
  const burstTypes = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'] as const;
  const burstRows: Record<string, Record<string, string>> = {};
  for (const row of skillData) {
    if (row.ID && skillIds.includes(row.ID) && burstTypes.includes(row.SkillType as typeof burstTypes[number])) {
      burstRows[row.SkillType] = row;
    }
  }

  if (Object.keys(burstRows).length > 0) {
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
      const targetSkill = skills[burnTarget] as any;
      targetSkill.burnEffect = burnEffect;

      // Merge burst buff/debuff into main skill
      const mainBuffs = new Set<string>(targetSkill.buff ?? []);
      const mainDebuffs = new Set<string>(targetSkill.debuff ?? []);
      for (const bt of burstTypes) {
        const bRow = burstRows[bt];
        if (!bRow) continue;
        const bLevels = skillLevelRows.get(bRow.ID) ?? [];
        if (bLevels.length > 0) {
          const bd = extractBuffDebuff(collectBuffGroupIds(bLevels), buffData);
          for (const b of bd.buff) mainBuffs.add(b);
          for (const d of bd.debuff) mainDebuffs.add(d);
        }
      }
      targetSkill.buff = [...mainBuffs];
      targetSkill.debuff = [...mainDebuffs];
    }
  }

  return NextResponse.json({ skills });
}

// ── Transcend ────────────────────────────────────────────────────────

function buildTranscend(
  id: string,
  charRow: Record<string, string>,
  transcendData: Record<string, string>[],
  skillTempletData: Record<string, string>[],
  skillLevelData: Record<string, string>[],
  textSkillMap: Record<string, LangTexts>,
): Record<string, string | null> {
  const rarity = parseInt(charRow.BasicStar) || 0;

  const charSpecific = transcendData.filter(r => r.CharacterID === id);
  // Generic transcend steps: filter by rarity range
  const bsOffset = rarity >= 3 ? 17 : 0;
  const steps = charSpecific.length > 0
    ? charSpecific
    : transcendData.filter(r => {
        if (r.CharacterID !== '0') return false;
        const bs = parseInt(r.BasicStar) || 0;
        return bs > bsOffset && bs <= bsOffset + 9;
      });

  steps.sort((a, b) => (parseInt(a.UseTransStar) || 0) - (parseInt(b.UseTransStar) || 0));

  const skillIds = getSkillIds(charRow);

  let uniquePassiveId: string | null = null;
  for (const row of skillTempletData) {
    if (row.SkillType === 'SKT_UNIQUE_PASSIVE' && row.ID && skillIds.includes(row.ID)) {
      uniquePassiveId = row.ID;
      break;
    }
  }

  const transcendDescs = new Map<number, string[]>();
  if (uniquePassiveId) {
    for (const row of skillLevelData) {
      if (row.SkillID === uniquePassiveId) {
        const sl = parseInt(row.SkillLevel) || 0;
        if (sl <= 0) continue;
        const descId = row.DescID ?? '';
        if (!descId) continue;
        const keys = descId.split(',').map(d => d.trim()).filter(d => d.startsWith('SE_DESC_') || d.startsWith('SKILL_DESC_B_') || d.startsWith('SKILL_NAME_B_'));
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
                const formatted = txt.replace(/\\n/g, '\n').trim();
                if (formatted) lines[lang].push(formatted);
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
  const [charData, transcendData, skillData, skillLevelData, textSkill] = await Promise.all([
    readTemplet('CharacterTemplet'),
    readTemplet('CharacterTranscendentTemplet'),
    readTemplet('CharacterSkillTemplet'),
    readTemplet('CharacterSkillLevelTemplet'),
    readTemplet('TextSkill'),
  ]);

  const charRow = charData.find(r => r.ModelID === id);
  if (!charRow) {
    return NextResponse.json({ error: `Character ${id} not found` }, { status: 404 });
  }

  const textSkillMap = buildTextMap(textSkill);
  const transcend = buildTranscend(id, charRow, transcendData, skillData, skillLevelData, textSkillMap);
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

const SKILL_ARRAY_FIELDS = ['buff', 'debuff', 'dual_buff', 'dual_debuff'];
const SKILL_KEYS = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE'];

async function handleCompare() {
  const [charData, textChar, textSys, textSkill, extraData,
    skillData, skillLevelData, buffData, trustData, fusionData, changeData,
    transcendData, recruitData, profileData,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingProfiles: Record<string, any> = {};
  try {
    existingProfiles = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'character-profiles.json'), 'utf-8'));
  } catch { /* */ }

  const profileByCharId = new Map<string, Record<string, string>>();
  for (const row of profileData) {
    if (row.CharacterID) profileByCharId.set(row.CharacterID, row);
  }

  const existingDir = path.join(process.cwd(), 'data', 'character');
  let existingFiles: string[] = [];
  try {
    existingFiles = (await fs.readdir(existingDir)).filter(f => f.endsWith('.json'));
  } catch { /* */ }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fusionLevelData: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemData: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let textItemData: any = null;

  const textMap = buildTextMap(textChar);
  const textSysMap = buildTextMap(textSys);
  const textSkillMap = buildTextMap(textSkill);
  const buffIndex = buildBuffIndex(buffData);

  const showNickIds = new Set(
    extraData.filter(r => r.ShowNickName === 'True').map(r => r.CharacterID)
  );

  const skillByID = new Map<string, Record<string, string>>();
  for (const row of skillData) {
    if (row.ID) skillByID.set(row.ID, row);
  }
  const skillLevelBySID = new Map<string, Record<string, string>[]>();
  for (const row of skillLevelData) {
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

    const charRow = charData.find(r => r.ModelID === id);
    if (!charRow) continue;

    const diffs: { field: string; existing: string; extracted: string }[] = [];

    const isCoreFusion = id.startsWith('2700');
    const names = textMap[charRow.NameID ?? ''];
    const showNick = showNickIds.has(id);
    const nickNames = showNick ? textMap[`${id}_NickName`] : null;
    const fusionPrefix = isCoreFusion ? textSysMap['SYS_CHARACTER_FUSION_TITLE'] : null;

    const fullnameTexts = {} as LangTexts;
    for (const lang of LANGS) {
      const n = names?.[lang] ?? '';
      const prefix = fusionPrefix?.[lang] ?? '';
      const nick = nickNames?.[lang] ?? '';
      if (prefix) fullnameTexts[lang] = `${prefix} ${n}`;
      else fullnameTexts[lang] = nick ? `${nick} ${n}` : n;
    }

    const baseId = isCoreFusion
      ? fusionData.find(r => r.ChangeCharID === id)?.CharacterID ?? id
      : id;
    const cvEntries: Record<Lang, LangTexts | undefined> = {} as Record<Lang, LangTexts | undefined>;
    for (const lang of LANGS) cvEntries[lang] = textMap[`${id}_CVName_${lang}`] ?? textMap[`${baseId}_CVName_${lang}`];
    const voiceActorTexts = {} as LangTexts;
    for (const lang of LANGS) {
      voiceActorTexts[lang] = cvEntries[lang]?.[lang] || cvEntries.jp?.[lang] || cvEntries[DEFAULT_LANG]?.[lang] || '';
    }

    const sids = getSkillIds(charRow);
    const sidSlotMap = new Map<string, string>();
    for (let i = 1; i <= 23; i++) {
      const s = charRow[`Skill_${i}`];
      if (s) sidSlotMap.set(s, `Skill_${i}`);
    }

    let chainDesc = '';
    let chainIconName = '';
    for (const row of skillData) {
      if (row.SkillType === 'SKT_CHAIN_PASSIVE' && row.ID && sids.includes(row.ID)) {
        chainIconName = row.IconName ?? '';
        const descSym = (row.DescID ?? '').split(',')[0]?.trim();
        if (descSym) chainDesc = textSkillMap[descSym]?.[DEFAULT_LANG] ?? '';
        break;
      }
    }
    const chainType = resolveChainType(chainDesc, chainIconName);

    const trustRow = trustData.find(r => r.ID === id);
    const gift = GIFT_MAP[trustRow?.PresentTypeLike ?? ''] ?? null;

    const fusionRow = fusionData.find(r => r.CharacterID === id);

    const autoTags = sortTags([...new Set([
      ...detectTags(id, recruitData, extraData),
      ...(Array.isArray(existing.tags) && existing.tags.includes('free') ? ['free'] : []),
    ])]);

    const extracted: Record<string, unknown> = {
      ...expandLang('Fullname', fullnameTexts),
      Rarity: parseInt(charRow.BasicStar) || 0,
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

    // Core fusion fields
    if (id.startsWith('2700')) {
      const cfRow = fusionData.find(r => r.ChangeCharID === id);
      if (cfRow) {
        if (!fusionLevelData) fusionLevelData = await readTemplet('CharacterFusionLevelTemplet');
        if (!itemData) {
          [itemData, textItemData] = await Promise.all([readTemplet('ItemTemplet'), readTemplet('TextItem')]);
        }
        const levels = fusionLevelData.filter((r: Record<string, string>) => r.FusionGroupID === cfRow.FusionGroupID);
        const materialItemId = levels[0]?.RequireItemID ?? '';
        const itemRow = itemData.find((r: Record<string, string>) => r.ID === materialItemId);
        const itemName = itemRow?.NameID
          ? (buildTextMap(textItemData)[itemRow.NameID]?.en ?? materialItemId)
          : materialItemId;

        extracted.fusionType = 'core-fusion';
        extracted.originalCharacter = cfRow.CharacterID;
        extracted.fusionRequirements = {
          transcendence: (parseInt(cfRow.CharacterTransStar) || 1) - 1,
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
      const eVal = existing[field] ?? '';
      const aVal = extracted[field] ?? '';
      const e = Array.isArray(eVal) ? [...eVal].sort().join(', ') : String(eVal);
      const a = Array.isArray(aVal) ? [...aVal].sort().join(', ') : String(aVal);
      if (e !== a) diffs.push({ field, existing: e, extracted: a });
    }

    // Profile comparison
    const cmpBaseId = isCoreFusion
      ? fusionData.find(r => r.ChangeCharID === id)?.CharacterID ?? id
      : id;
    const profileRow = profileByCharId.get(id) ?? (isCoreFusion ? profileByCharId.get(cmpBaseId) : undefined);
    const existingProfile = existingProfiles[id] ?? {};
    if (profileRow) {
      const bday = profileRow.Birth ?? '';
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

      const storySym = textSysMap[`SYS_ACHIEVE_PROFILE_${id}`] ? `SYS_ACHIEVE_PROFILE_${id}` : (profileRow.ProfileScenario ?? '');
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

      const existingFullname = existingProfile.fullname ?? {};
      for (const lang of LANGS) {
        const key = lang === DEFAULT_LANG ? 'en' : lang;
        const e = String(existingFullname[key] ?? '');
        const a = String(fullnameTexts[lang] ?? '');
        if (e && a && e !== a) diffs.push({ field: `profile.fullname_${lang}`, existing: e, extracted: a });
      }
    }

    // Fusion fields
    for (const field of ['fusionRequirements', 'costPerLevel']) {
      if (!(field in existing) && !(field in extracted)) continue;
      const e = JSON.stringify(existing[field] ?? null);
      const a = JSON.stringify(extracted[field] ?? null);
      if (e !== a) diffs.push({ field, existing: e, extracted: a });
    }

    // Skills comparison
    for (const sk of SKILL_KEYS) {
      const existingSkill = existing.skills?.[sk];
      if (!existingSkill) continue;

      const sid = sids.find(s => skillByID.get(s)?.SkillType === sk);
      if (!sid) continue;
      const sRow = skillByID.get(sid);
      if (!sRow) continue;

      const resolvedNames = textSkillMap[sRow.SkipNameID ?? sRow.NameID ?? ''];
      const levels = skillLevelBySID.get(sid) ?? [];
      const firstLevel = levels[0];

      const isChain = sk === 'SKT_CHAIN_PASSIVE';

      const hasCd = sk === 'SKT_SECOND' || sk === 'SKT_ULTIMATE';
      const rawCd = hasCd ? firstLevel?.StartCool ?? '' : '';
      const cd = rawCd && /^\d+$/.test(rawCd) ? parseInt(rawCd) : null;

      let rangeType = sRow.RangeType ?? '';
      if (!isChain) {
        const chRow = changeData.find(r => r.ID === id);
        const chId = chRow?.ChangeCharacterID;
        if (chId) {
          const chCharRow = charData.find(r => r.ModelID === chId);
          if (chCharRow) {
            const chSids = getSkillIds(chCharRow);
            const chSRow = skillData.find(r => r.SkillType === sk && r.ID && chSids.includes(r.ID));
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
        wgr = 3; offensive = true; target = 'multi';
      } else {
        target = resolveTarget(rangeType);
        offensive = (sRow.TargetTeamType ?? '').includes('ENEMY');
        const rawWgr = offensive ? (parseInt(firstLevel?.WGReduce ?? '0') || 0) : null;
        wgr = rawWgr;
      }

      const skillBD = isChain
        ? extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'chain', buffData), buffData)
        : sk === 'SKT_FUSION_PASSIVE'
          ? extractBuffDebuff(collectFusionPassiveBuffIds(levels, buffData), buffData)
          : extractBuffDebuff(collectBuffGroupIds(levels), buffData);

      // Merge transform buffs
      const chRow = changeData.find(r => r.ID === id);
      const changeId = chRow?.ChangeCharacterID ?? null;
      if (changeId) {
        const changeCharRow2 = charData.find(r => r.ModelID === changeId);
        if (changeCharRow2) {
          const changeSids2 = getSkillIds(changeCharRow2);
          const changeSRow = skillData.find(r => r.SkillType === sk && r.ID && changeSids2.includes(r.ID));
          if (changeSRow) {
            const changeLevels = skillLevelData.filter(r => r.SkillID === changeSRow.ID);
            const changeBD = isChain
              ? extractBuffDebuff(collectBuffGroupIdsByPattern(changeId, 'chain', buffData), buffData)
              : extractBuffDebuff(collectBuffGroupIds(changeLevels), buffData);
            for (const b of changeBD.buff) { if (!skillBD.buff.includes(b)) skillBD.buff.push(b); }
            for (const d of changeBD.debuff) { if (!skillBD.debuff.includes(d)) skillBD.debuff.push(d); }
          }
        }
      }

      let dualData: Record<string, unknown> = {};
      if (isChain) {
        const dualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(id, 'backup', buffData), buffData);
        if (changeId) {
          const changeDualBD = extractBuffDebuff(collectBuffGroupIdsByPattern(changeId, 'backup', buffData), buffData);
          for (const b of changeDualBD.buff) { if (!dualBD.buff.includes(b)) dualBD.buff.push(b); }
          for (const d of changeDualBD.debuff) { if (!dualBD.debuff.includes(d)) dualBD.debuff.push(d); }
        }
        dualData = { wgr_dual: 1, dual_offensive: true, dual_target: 'mono', dual_buff: dualBD.buff, dual_debuff: dualBD.debuff };
      }

      // Merge burst buffs
      const rapCheck = sRow.RequireAP ?? '';
      if (/^\d+,\d+,\d+$/.test(rapCheck)) {
        const burstTypes2 = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'];
        for (const bt of burstTypes2) {
          const bRow = skillData.find(r => r.SkillType === bt && r.ID && sids.includes(r.ID));
          if (!bRow) continue;
          const bLevels = skillLevelBySID.get(bRow.ID) ?? [];
          if (bLevels.length > 0) {
            const bd = extractBuffDebuff(collectBuffGroupIds(bLevels), buffData);
            for (const b of bd.buff) skillBD.buff.push(b);
            for (const d of bd.debuff) skillBD.debuff.push(d);
          }
        }
        skillBD.buff = [...new Set(skillBD.buff)];
        skillBD.debuff = [...new Set(skillBD.debuff)];
      }

      const extractedSkill: Record<string, unknown> = {
        ...expandLang('name', resolvedNames),
        wgr, cd, offensive, target, ...dualData,
      };

      for (const sf of SKILL_FIELDS) {
        if (!(sf in existingSkill)) continue;
        const e = String(existingSkill[sf] ?? '');
        const a = String(extractedSkill[sf] ?? '');
        if (e !== a) diffs.push({ field: `${sk}.${sf}`, existing: e, extracted: a });
      }

      const extractedArrays: Record<string, string[]> = {
        buff: skillBD.buff, debuff: skillBD.debuff,
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

      // Desc levels
      const descSymbols = (sRow.DescID ?? '').split(',');
      for (let lvl = 0; lvl < descSymbols.length; lvl++) {
        const sym = descSymbols[lvl]?.trim();
        if (!sym) continue;
        const texts = textSkillMap[sym];
        if (!texts) continue;
        const skillLv = lvl + 1;

        const resolved = resolveBuffPlaceholders(texts[DEFAULT_LANG], skillLv, buffIndex);
        const existingDesc = existingSkill.true_desc_levels?.[String(skillLv)] ?? '';
        if (existingDesc && resolved && existingDesc !== resolved) {
          diffs.push({ field: `${sk}.desc_lv${skillLv}`, existing: existingDesc, extracted: resolved });
        }

        for (const lang of SUFFIX_LANGS) {
          const resolvedLang = resolveBuffPlaceholders(texts[lang], skillLv, buffIndex);
          const existingLang = existingSkill.true_desc_levels?.[`${skillLv}_${lang}`] ?? '';
          if (existingLang && resolvedLang && existingLang !== resolvedLang) {
            diffs.push({ field: `${sk}.desc_lv${skillLv}_${lang}`, existing: existingLang, extracted: resolvedLang });
          }
        }
      }

      // Enhancement
      const existingEnh = existingSkill.enhancement ?? {};
      const extractedEnh: Record<string, string[]> = {};
      for (const lv of levels) {
        const lvNum = lv.SkillLevel ?? '1';
        if (lvNum === '1') continue;
        const descId = lv.DescID ?? '';
        if (!descId) continue;
        const descs = descId.split(',').map(d => d.trim()).filter(d => d.startsWith('SE_DESC_') || d.startsWith('SKILL_DESC_B_') || d.startsWith('SKILL_NAME_B_'));
        if (descs.length === 0) continue;
        extractedEnh[lvNum] = descs.map(d => textSkillMap[d]?.[DEFAULT_LANG] ?? d);
        for (const lang of SUFFIX_LANGS) {
          const langDescs = descs.map(d => textSkillMap[d]?.[lang] ?? '').filter(Boolean);
          if (langDescs.length > 0) extractedEnh[`${lvNum}_${lang}`] = langDescs;
        }
      }
      for (const k of Object.keys(existingEnh)) {
        const eVal = JSON.stringify(existingEnh[k] ?? null);
        const aVal = JSON.stringify(extractedEnh[k] ?? null);
        if (eVal !== aVal) {
          diffs.push({ field: `${sk}.enh_${k}`, existing: existingEnh[k]?.join(', ') ?? '', extracted: extractedEnh[k]?.join(', ') ?? '' });
        }
      }

      // burnEffect
      const existingBurn = existingSkill.burnEffect ?? {};
      const rap = sRow.RequireAP ?? '';
      if (/^\d+,\d+,\d+$/.test(rap)) {
        const burstCosts = rap.split(',').map(Number);
        const burstTypes2 = ['SKT_BURST_1', 'SKT_BURST_2', 'SKT_BURST_3'];
        for (let bi = 0; bi < burstTypes2.length; bi++) {
          const bt = burstTypes2[bi];
          const exBurst = existingBurn[bt] ?? {};
          const bRow = skillData.find(r => r.SkillType === bt && r.ID && sids.includes(r.ID));
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
            if (eVal !== aVal) diffs.push({ field: `${sk}.burn.${bt}.${bf}`, existing: eVal, extracted: aVal });
          }
        }
      }
    }

    // Transcend
    const existingTranscend = existing.transcend ?? {};
    const extractedTranscend = buildTranscend(id, charRow, transcendData, skillData, skillLevelData, textSkillMap);

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
    [path.join(DATAMINE_ROOT, 'sprite', 'at_dungeonruntime', `IG_Turn_${id}.png`), path.join(PUBLIC_IMAGES, 'atb', `IG_Turn_${id}.png`)],
    [path.join(DATAMINE_ROOT, 'sprite', 'at_dungeonruntime', `IG_Turn_${id}_E.png`), path.join(PUBLIC_IMAGES, 'atb', `IG_Turn_${id}_E.png`)],
    [path.join(DATAMINE_ROOT, 'prefabs', 'ui', 'illust', `illust_${id}`, `IMG_${id}.png`), path.join(PUBLIC_IMAGES, 'full', `IMG_${id}.png`)],
    [path.join(DATAMINE_ROOT, 'sprite', 'at_thumbnailcharacterruntime', `CT_${id}.png`), path.join(PUBLIC_IMAGES, 'portrait', `CT_${id}.png`)],
  ];

  const icons = skillIcons ?? [`Skill_First_${id}`, `Skill_Second_${id}`, `Skill_Ultimate_${id}`];
  for (const icon of icons) {
    jobs.push([
      path.join(DATAMINE_ROOT, 'sprite', 'at_skillruntime', `${icon}.png`),
      path.join(PUBLIC_IMAGES, 'skills', `${icon}.png`),
    ]);
  }

  const results = await Promise.all(jobs.map(([src, dest]) => copyIfMissing(src, dest)));
  return {
    copied: results.filter(r => r === 'copied').length,
    exists: results.filter(r => r === 'exists').length,
    missing: results.filter(r => r === 'missing').length,
  };
}

// ── Save ─────────────────────────────────────────────────────────────

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

    const existingPath = path.join(process.cwd(), 'data', 'character', `${id}.json`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existing: Record<string, any> = {};
    let existingRaw: string | undefined;
    try {
      existingRaw = await fs.readFile(existingPath, 'utf-8');
      existing = JSON.parse(existingRaw);
    } catch { /* new character */ }

    const mergedSkills: Record<string, unknown> = {};
    for (const sk of ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_CHAIN_PASSIVE', 'SKT_FUSION_PASSIVE']) {
      const extracted = skillsData.skills?.[sk];
      if (!extracted) continue;

      const merged: Record<string, unknown> = { ...extracted };
      if (merged.true_desc_levels) merged.true_desc_levels = groupByLang(merged.true_desc_levels as Record<string, string>);
      if (merged.enhancement) merged.enhancement = groupByLang(merged.enhancement as Record<string, string>);

      mergedSkills[sk] = orderKeys(merged, SKILL_KEY_ORDER);

      const skill = mergedSkills[sk] as Record<string, unknown>;
      for (const key of Object.keys(skill)) {
        if (skill[key] === undefined) delete skill[key];
      }
    }

    const { birthday: _b, height: _h, weight: _w, story: _s, ...infoWithoutProfile } = info;
    const character = orderKeys({
      ...infoWithoutProfile,
      rank: manual.rank ?? existing.rank ?? null,
      rank_pvp: info.Rarity > 2 ? (manual.rank_pvp ?? existing.rank_pvp ?? null) : undefined,
      role: manual.role ?? existing.role ?? null,
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

    for (const key of Object.keys(character)) {
      if (character[key] === undefined) delete character[key];
    }

    const outputDir = path.join(process.cwd(), 'data', 'character');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, `${id}.json`),
      stringifyCharacter(character, existingRaw),
      'utf-8',
    );

    // Update character-profiles.json
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

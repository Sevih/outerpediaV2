import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  readTemplet, buildTextMap,
  LANGS, type LangTexts,
  resolveClass, resolveElement,
  buildBuffIndex, resolveBuffPlaceholders,
} from '@/app/admin/lib/text';
import {
  extractBuffDebuff as extractBD,
} from '@/app/admin/lib/config';

const BOSS_DIR = path.join(process.cwd(), 'data', 'boss');

// DungeonMode → TextSystem key for label resolution
// Aligned with datamine/ParserV3/boss_finder_v2.py DUNGEON_MODE_MAP
const MODE_TO_SYS_KEY: Record<string, string> = {
  DM_NORMAL: 'SYS_ADVENTURE_NORMAL',  // Dynamic: overridden to SYS_ADVENTURE_HARD via AreaTemplet
  DM_REMAINS: 'SYS_PVE_REMAINS',
  DM_SIDESTORY: 'SYS_GUIDE_MENU_SIDESTORY',
  DM_EVENT: 'SYS_EVENT',
  DM_EVENT_BOSS: 'SYS_EVENT_BOSS_TITLE',
  DM_EVENT_CHALLENGE: 'SYS_EVENT_BOSS_CHALLENGE',
  DM_RAID_1: 'SYS_RAID_1_TITLE',
  DM_RAID_2: 'SYS_RAID_2_TITLE',
  DM_WORLD_BOSS: 'SYS_WORLD_BOSS',
  DM_GUILD_RAID_MAIN_BOSS: 'SYS_GUILD_RAID_TITLE',
  DM_GUILD_RAID_SUB_BOSS: 'SYS_GUILD_RAID_TITLE',
  DM_GUILD_DUNGEON: 'SYS_GUILD_DUNGEON_TITLE',
  DM_EXPLORATION_MAIN_BOSS: 'SYS_RUIN_ISLAND_EXPLORATION',
  DM_EXPLORATION_NORMAL: 'SYS_RUIN_ISLAND_EXPLORATION',
  DM_EXPLORATION_SPOT_BOSS: 'SYS_RUIN_ISLAND_EXPLORATION',
  DM_TOWER: 'SYS_PVE_TOWER',
  DM_TOWER_ELEMENT: 'SYS_PVE_TOWER_ELEMENTAL',
  DM_TOWER_HARD: 'SYS_CONTENS_LOCK_PVE_TOWER_HARD',
  DM_TOWER_VERY_HARD: 'SYS_INFINITE_DUNGEON_V_HARD_01',
  DM_IRREGULAR_CHASE: 'SYS_GUIDE_IRREGULAR_CHASE_TITLE',
  DM_IRREGULAR_INFILTRATE: 'SYS_GUIDE_IRREGULAR_INVADE_TITLE',
  DM_IVANEZ_DUNGEON: 'SYS_IVANEZ_FESTIVAL',
  DM_MONAD_BATTLE_1: 'SYS_MONAD_GATE',
  DM_DAYOFWEEK: 'SYS_DAYOFWEEK_DUNGEON',
  DM_EXP: 'SYS_EXP_DUNGEON',
  DM_GOLD: 'SYS_GOLD_DUNGEON',
  DM_CHAR_PIECE: 'SYS_PIECE_DUNGEON',
  DM_ADVENTURE_MISSION: 'SYS_ADVENTURE_LICENSE',
  DM_ADVENTURE_CHALLENGE: 'SYS_ADVENTURE_CHALLENGE',
  DM_TUTORIAL: 'SYS_CONTENS_LOCK_EVA_BATTLE_TUTORIAL',
};

function resolveModeLabel(textSystemMap: Record<string, LangTexts>, mode: string): string {
  const sysKey = MODE_TO_SYS_KEY[mode];
  if (sysKey) {
    const texts = textSystemMap[sysKey];
    if (texts?.en) return texts.en;
  }
  return mode.replace('DM_', '');
}

/** Refine mode label for display grouping (splits Elemental Tower by element, resolves SYS_ keys) */
function refineMode(modeEn: string, dungeonEn: string, textSystemMap: Record<string, LangTexts>): string {
  let mode = modeEn || 'Unknown';
  if (mode === 'Elemental Tower' && dungeonEn) {
    const elem = dungeonEn.match(/^(Fire|Water|Earth|Light|Dark)\s+Tower/)?.[1]
      ?? dungeonEn.match(/Tower\s+of\s+(Light|Dark)/)?.[1];
    if (elem) mode = `Elemental Tower (${elem})`;
  }
  if (mode.startsWith('SYS_')) {
    const normalized = mode.replace(/\s+/g, '');
    let resolved = '';
    for (const [key, texts] of Object.entries(textSystemMap)) {
      if (key.replace(/\s+/g, '') === normalized && texts.en) { resolved = texts.en; break; }
    }
    mode = resolved || mode.replace(/^SYS_/, '').replace(/_/g, ' ');
  }
  return mode;
}

// ── Types ─────────────────────────────────────────────────────────

type Row = Record<string, string>;

interface GameData {
  monsters: Row[];
  monsterSkills: Row[];
  monsterSkillLevels: Row[];
  dungeons: Row[];
  spawns: Row[];
  buffData: Row[];
  areas: Row[];
  worldBossLeagues: Row[];
  textCharMap: Record<string, LangTexts>;
  textSkillMap: Record<string, LangTexts>;
  textSystemMap: Record<string, LangTexts>;
  buffIndex: Map<string, Map<number, Row>>;
}

interface SearchResult {
  monsterId: string;
  name: Record<string, string>;
  type: string;
  element: string;
  class: string;
  race: string;
  dungeons: { mode: string; name: Record<string, string>; dungeonId: string }[];
}

// ── Load game data ────────────────────────────────────────────────

let cachedGD: GameData | null = null; // reset on reload

async function loadGameData(): Promise<GameData> {
  if (cachedGD) return cachedGD;

  const [monsterT, monsterSkillT, monsterSkillLevelT, dungeonT, spawnT,
    buffT, areaT, worldBossLeagueT, textChar, textSkill, textSystem] = await Promise.all([
    readTemplet('MonsterTemplet'),
    readTemplet('MonsterSkillTemplet'),
    readTemplet('MonsterSkillLevelTemplet'),
    readTemplet('DungeonTemplet'),
    readTemplet('DungeonSpawnTemplet'),
    readTemplet('BuffTemplet'),
    readTemplet('AreaTemplet'),
    readTemplet('WorldBossLeagueTemplet'),
    readTemplet('TextCharacter'),
    readTemplet('TextSkill'),
    readTemplet('TextSystem'),
  ]);

  cachedGD = {
    monsters: monsterT.data,
    monsterSkills: monsterSkillT.data,
    monsterSkillLevels: monsterSkillLevelT.data,
    dungeons: dungeonT.data,
    spawns: spawnT.data,
    buffData: buffT.data,
    areas: areaT.data,
    worldBossLeagues: worldBossLeagueT.data,
    textCharMap: buildTextMap(textChar.data),
    textSkillMap: buildTextMap(textSkill.data),
    textSystemMap: buildTextMap(textSystem.data),
    buffIndex: buildBuffIndex(buffT.data),
  };
  return cachedGD;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Resolve monster name: prefer NameIDSymbol, fallback to FirstMeetIDSymbol */
function resolveMonsterName(gd: GameData, m: Row): LangTexts | undefined {
  const nms = m.NameIDSymbol ?? '';
  if (nms) {
    const t = gd.textCharMap[nms] ?? gd.textCharMap[nms + '_Name'];
    if (t) return t;
  }
  const fms = m.FirstMeetIDSymbol ?? '';
  return gd.textCharMap[fms] ?? gd.textCharMap[fms.replace('_Name', '')] ?? gd.textCharMap[fms + '_Name'];
}

/** Resolve monster surname from FirstMeetIDSymbol (only if different from name) */
function resolveMonsterSurname(gd: GameData, m: Row): LangTexts | null {
  const nms = m.NameIDSymbol ?? '';
  const fms = m.FirstMeetIDSymbol ?? '';
  if (!nms || !fms || nms === fms) return null;
  const nameTexts = gd.textCharMap[nms] ?? gd.textCharMap[nms + '_Name'];
  const surnameTexts = gd.textCharMap[fms] ?? gd.textCharMap[fms.replace('_Name', '')];
  if (!surnameTexts || !nameTexts) return null;
  // Only return if different from name
  if (surnameTexts.en === nameTexts.en) return null;
  return surnameTexts;
}


interface DungeonLink {
  mode: string;
  name: LangTexts;
  dungeonId: string;
  areaId: LangTexts | null;    // e.g. "3-14" from SYS_DUNGEON_SHORT_NAME_*
  modeLabel: LangTexts | null; // resolved from MODE_TO_SYS_KEY
  level: number;               // from spawn GroupID
}

function buildMonsterToDungeons(gd: GameData): Map<string, DungeonLink[]> {
  // Collect all spawn IDs referenced by dungeons (to distinguish spawn refs from monster IDs)
  const dungeonSpawnRefs = new Set<string>();
  for (const d of gd.dungeons) {
    for (const pos of ['SpawnID_Pos0', 'SpawnID_Pos1', 'SpawnID_Pos2', 'StoryTeamSpawn_fallback1', 'StoryTeamSpawn_fallback2']) {
      const raw = d[pos];
      if (!raw || /^(TRUE|FALSE|True|False)$/i.test(raw)) continue;
      for (const part of raw.split(',')) {
        const p = part.trim();
        if (p && p.length >= 5) dungeonSpawnRefs.add(p);
      }
    }
  }

  const monsterIds = new Set(gd.monsters.map(m => m.ID));

  // Build spawn lookup → { monsterIds, spawn row }
  const spawnMap = new Map<string, { mids: Set<string>; row: Row }>();
  for (const s of gd.spawns) {
    const mids = new Set<string>();
    const keys: string[] = [];
    if (s.HPLineCount) keys.push(s.HPLineCount);

    for (const idx of ['ID0', 'ID1', 'ID2', 'ID3']) {
      const val = s[idx];
      if (!val) continue;
      // If the value is a known dungeon spawn ref, it's a spawn key, not a monster ID
      // Also: if HPLineCount is missing and the value is NOT a known monster ID, treat it as a spawn key
      // (bytes parser column shift puts HPLineCount into ID0)
      if (dungeonSpawnRefs.has(val) || (!s.HPLineCount && !monsterIds.has(val))) {
        keys.push(val);
      } else {
        mids.add(val);
      }
    }

    // Fallback: also index by spawn.ID
    if (s.ID && !keys.length) keys.push(s.ID);

    const entry = { mids, row: s };
    for (const k of keys) spawnMap.set(k, entry);
  }

  // World boss league lookup: DungeonID → LeagueName (TextSystem key)
  // Multiple entries per DungeonID exist (old/new names), take the last one (most recent)
  const worldBossLeagueByDungeon = new Map<string, string>();
  for (const wbl of gd.worldBossLeagues) {
    const did = wbl.DungeonID;
    const ln = wbl.LeagueName;
    if (did && ln) worldBossLeagueByDungeon.set(did, ln);
  }

  const result = new Map<string, DungeonLink[]>();

  for (const d of gd.dungeons) {
    const mode = d.DungeonMode;
    if (!mode) continue;
    const dungeonId = d.ID ?? '';

    // For world boss: use league name instead of season name
    let nameLangs: LangTexts | undefined;
    if (mode === 'DM_WORLD_BOSS') {
      const friendSupport = d.FriendSupportUse ?? '';
      const leagueKey = worldBossLeagueByDungeon.get(friendSupport);
      if (leagueKey) nameLangs = gd.textSystemMap[leagueKey];
    }
    if (!nameLangs) nameLangs = gd.textSystemMap[d.SeasonFullName ?? ''];
    if (!nameLangs) continue;

    // area_id: from FriendSupportUse → TextSystem (e.g. SYS_DUNGEON_SHORT_NAME_0314 → "3-14")
    // Skip for world boss (FriendSupportUse is a DungeonID, not a TextSystem key)
    const friendSupport = d.FriendSupportUse ?? '';
    const areaId = mode === 'DM_WORLD_BOSS' ? null : (gd.textSystemMap[friendSupport] ?? null);

    // mode label — for DM_NORMAL, detect Story (Hard) vs Story (Normal) via AreaTemplet
    let modeLabel: LangTexts | null = null;
    if (mode === 'DM_NORMAL') {
      const areaId = d.AreaID ?? '';
      const area = gd.areas.find(a => a.SeasonID === areaId);
      if (area) {
        // Check raw ShortNameIDSymbol for _HARD_ pattern (same as boss_finder_v2.py)
        const shortNameSymbol = area.ShortNameIDSymbol ?? '';
        const isHard = shortNameSymbol.includes('_HARD_');
        modeLabel = gd.textSystemMap[isHard ? 'SYS_ADVENTURE_HARD' : 'SYS_ADVENTURE_NORMAL'] ?? null;
      }
    }
    if (!modeLabel) {
      const sysKey = MODE_TO_SYS_KEY[mode];
      modeLabel = sysKey ? (gd.textSystemMap[sysKey] ?? null) : null;
    }

    for (const pos of ['SpawnID_Pos0', 'SpawnID_Pos1', 'SpawnID_Pos2', 'StoryTeamSpawn', 'StoryTeamSpawn_fallback1', 'StoryTeamSpawn_fallback2']) {
      const raw = d[pos];
      if (!raw || /^(TRUE|FALSE|True|False)$/i.test(raw)) continue;
      // Skip short values in StoryTeamSpawn (team size, not spawn ID)
      if (pos.startsWith('StoryTeamSpawn') && raw.length < 5) continue;
      for (const part of raw.split(',')) {
        const sid = part.trim();
        const spawn = spawnMap.get(sid);
        if (!spawn) continue;
        const level = parseInt(spawn.row.GroupID ?? spawn.row.Level0 ?? '0') || 0;
        for (const mid of spawn.mids) {
          let arr = result.get(mid);
          if (!arr) { arr = []; result.set(mid, arr); }
          if (!arr.some(e => e.dungeonId === dungeonId && e.name.en === nameLangs.en)) {
            arr.push({ mode, name: nameLangs, dungeonId, areaId, modeLabel, level });
          }
        }
      }
    }
  }

  // World boss dedup: keep only the most recent dungeon per mode (highest dungeonId)
  for (const [, links] of result) {
    const wbLinks = links.filter(l => l.mode === 'DM_WORLD_BOSS');
    if (wbLinks.length <= 1) continue;
    // Group by level (same boss at same level = same league, old vs new)
    const byLevel = new Map<number, DungeonLink[]>();
    for (const l of wbLinks) {
      let arr = byLevel.get(l.level);
      if (!arr) { arr = []; byLevel.set(l.level, arr); }
      arr.push(l);
    }
    for (const [, group] of byLevel) {
      if (group.length <= 1) continue;
      // Keep the last one (most recent in file order), remove earlier ones
      for (let i = 0; i < group.length - 1; i++) {
        const idx = links.indexOf(group[i]);
        if (idx >= 0) links.splice(idx, 1);
      }
    }
  }

  // Second pass: for monsters in spawns without HPLineCount, try to inherit dungeon
  // from a nearby spawn with a sequential key (e.g. 706000002 inherits from 706000001)
  for (const s of gd.spawns) {
    if (s.HPLineCount) continue;
    const mids = new Set<string>();
    const spawnKeys: string[] = [];
    for (const idx of ['ID0', 'ID1', 'ID2', 'ID3']) {
      const val = s[idx];
      if (!val) continue;
      if (!monsterIds.has(val)) spawnKeys.push(val);
      else mids.add(val);
    }
    // Check if any monster in this spawn is already linked
    let anyLinked = false;
    for (const mid of mids) { if (result.has(mid)) { anyLinked = true; break; } }
    if (anyLinked) continue;

    // Try decrementing spawn keys to find a linked sibling
    for (const key of spawnKeys) {
      const num = parseInt(key);
      if (isNaN(num)) continue;
      for (let delta = 1; delta <= 5; delta++) {
        const siblingKey = String(num - delta);
        const sibling = spawnMap.get(siblingKey);
        if (!sibling) continue;
        // Find any monster in sibling that has a dungeon link
        for (const sibMid of sibling.mids) {
          const links = result.get(sibMid);
          if (!links?.length) continue;
          // Inherit dungeon links for our orphan monsters
          const level = parseInt(s.GroupID ?? s.Level0 ?? '0') || 0;
          for (const mid of mids) {
            if (result.has(mid)) continue;
            result.set(mid, links.map(l => ({ ...l, level })));
          }
          break;
        }
        break;
      }
    }
  }

  // Third pass: for monsters with HPLineCount not referenced by any dungeon,
  // try sequential HPLineCount inheritance (e.g. 551000032 inherits from 551000031)
  for (const s of gd.spawns) {
    if (!s.HPLineCount) continue;
    const mids = new Set<string>();
    for (const idx of ['ID0', 'ID1', 'ID2', 'ID3']) {
      const val = s[idx];
      if (val && monsterIds.has(val)) mids.add(val);
    }
    if (mids.size === 0) continue;
    let anyLinked = false;
    for (const mid of mids) { if (result.has(mid)) { anyLinked = true; break; } }
    if (anyLinked) continue;

    const hpc = parseInt(s.HPLineCount);
    if (isNaN(hpc)) continue;
    for (let delta = 1; delta <= 5; delta++) {
      const siblingKey = String(hpc - delta);
      const sibling = spawnMap.get(siblingKey);
      if (!sibling) continue;
      for (const sibMid of sibling.mids) {
        const links = result.get(sibMid);
        if (!links?.length) continue;
        const level = parseInt(s.GroupID ?? s.Level0 ?? '0') || 0;
        for (const mid of mids) {
          if (result.has(mid)) continue;
          result.set(mid, links.map(l => ({ ...l, level })));
        }
        break;
      }
      break;
    }
  }

  return result;
}

// ── Buff/debuff extraction (reuses character extractor logic) ────

const MONSTER_BUFF_ID_BLACKLIST = new Set<string>([]);
const MONSTER_BUFF_TYPE_BLACKLIST = new Set([
  'BT_DMG_CASTER_STAT',
]);

// ── Skill overrides (from data/admin/monster-skill-overrides.json) ──
// Key = "name_en|desc_en", value = { add_buff, add_debuff, remove_buff, remove_debuff }
type SkillOverride = { add_buff?: string[]; add_debuff?: string[]; remove_buff?: string[]; remove_debuff?: string[] };

async function loadSkillOverrides(): Promise<Record<string, SkillOverride>> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'admin', 'monster-skill-overrides.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

type SkillPattern = { regex: RegExp; add_buff?: string[]; add_debuff?: string[]; remove_buff?: string[]; remove_debuff?: string[] };

async function loadSkillPatterns(): Promise<SkillPattern[]> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'admin', 'monster-skill-patterns.json'), 'utf-8');
    const data = JSON.parse(raw) as { pattern: string; add_buff?: string[]; add_debuff?: string[]; remove_buff?: string[]; remove_debuff?: string[] }[];
    return data.map(d => ({ ...d, regex: new RegExp(d.pattern, 'i') }));
  } catch {
    return [];
  }
}

/** Normalize desc by replacing numbers outside HTML tags with '#' for fuzzy matching */
function normalizeDesc(desc: string): string {
  // Replace numbers that are NOT inside <color=...> tag attributes
  // Keep tag attributes intact, replace numeric values in text
  return desc.replace(/<color=[^>]*>|<\/color>|[\d.]+%?/g, (match) => {
    if (match.startsWith('<')) return match; // preserve HTML tags
    return '#';
  });
}

function applySkillOverrides(
  descEn: string,
  buff: string[],
  debuff: string[],
  overrides: Record<string, SkillOverride>,
): void {
  // Exact match first
  let override = overrides[descEn];
  // Fuzzy match: normalize both sides and compare
  if (!override) {
    const normalizedDesc = normalizeDesc(descEn);
    for (const [key, val] of Object.entries(overrides)) {
      if (normalizeDesc(key) === normalizedDesc) {
        override = val;
        break;
      }
    }
  }
  if (!override) return;
  if (override.add_buff) for (const b of override.add_buff) { if (!buff.includes(b)) buff.push(b); }
  if (override.add_debuff) for (const d of override.add_debuff) { if (!debuff.includes(d)) debuff.push(d); }
  if (override.remove_buff) for (const b of override.remove_buff) { const idx = buff.indexOf(b); if (idx >= 0) buff.splice(idx, 1); }
  if (override.remove_debuff) for (const d of override.remove_debuff) { const idx = debuff.indexOf(d); if (idx >= 0) debuff.splice(idx, 1); }
}

function applySkillPatterns(
  descEn: string,
  buff: string[],
  debuff: string[],
  patterns: SkillPattern[],
): void {
  for (const p of patterns) {
    if (!p.regex.test(descEn)) continue;
    if (p.add_buff) for (const b of p.add_buff) { if (!buff.includes(b)) buff.push(b); }
    if (p.add_debuff) for (const d of p.add_debuff) { if (!debuff.includes(d)) debuff.push(d); }
    if (p.remove_buff) for (const b of p.remove_buff) { const idx = buff.indexOf(b); if (idx >= 0) buff.splice(idx, 1); }
    if (p.remove_debuff) for (const d of p.remove_debuff) { const idx = debuff.indexOf(d); if (idx >= 0) debuff.splice(idx, 1); }
  }
}

/** Collect buff IDs from MonsterSkillLevelTemplet rows.
 *  Reads the BuffID field (now correctly assigned after parser fix).
 */
function collectMonsterBuffIds(lvls: Row[]): string[] {
  const ids = new Set<string>();
  for (const row of lvls) {
    const buffField = row.BuffID ?? '';
    if (!buffField) continue;
    for (const part of buffField.split(',')) {
      const trimmed = part.trim();
      if (trimmed && !MONSTER_BUFF_ID_BLACKLIST.has(trimmed)) ids.add(trimmed);
    }
  }
  return [...ids];
}

/**
 * Convert IG_Buff_*_Interruption icon tags to _IR format used in boss JSONs.
 * Builds the mapping dynamically from BuffTemplet data.
 */
function buildIconToIRMap(buffData: Row[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of buffData) {
    const icon = row.IconName ?? '';
    if (!icon.includes('_Interruption')) continue;
    const type = row.Type ?? '';
    const stat = row.StatType ?? '';
    const isDebuff = icon.endsWith('_D');

    let tag: string;
    if (type === 'BT_STAT' && stat && stat !== 'ST_NONE') {
      tag = `BT_STAT|${stat}_IR`;
    } else if (type && type !== 'BT_NONE' && type !== 'BT_DMG_REDUCE' && type !== 'BT_DMG' && type !== 'BT_DMG_TO_BOSS' && type !== 'BT_GROUP') {
      tag = `${type}_IR`;
    } else {
      continue;
    }

    // Only map if not already set (first match wins)
    if (!map.has(icon)) {
      map.set(icon, isDebuff ? tag : tag);
    }
  }
  return map;
}

// Post-conversion renames to match the site's effect naming
const IR_RENAME: Record<string, string> = {
  'BT_STAT|ST_DMG_REDUCE_RATE_IR': 'BT_DAMGE_TAKEN',
};

function convertToIRFormat(tags: string[], iconToIR: Map<string, string>): string[] {
  return tags.map(t => {
    const ir = iconToIR.get(t) ?? t;
    return IR_RENAME[ir] ?? ir;
  });
}

// ── Skill extraction ──────────────────────────────────────────────

const WANTED_SKILL_TYPES = new Set([
  'SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE',
  'SKT_MONSTER_1', 'SKT_MONSTER_2', 'SKT_MONSTER_3',
  'SKT_RAGE_ENTER1', 'SKT_RAGE_ENTER2',
  'SKT_RAGE_FINISH1', 'SKT_RAGE_FINISH2',
  'SKT_CLASS_PASSIVE', 'SKT_CHAIN_PASSIVE',
]);

async function extractMonsterSkills(gd: GameData, monster: Row) {
  const overrides = await loadSkillOverrides();
  const patterns = await loadSkillPatterns();
  const skillByNs: Record<string, Row> = {};
  for (const s of gd.monsterSkills) skillByNs[s.NameIDSymbol] = s;
  const iconToIR = buildIconToIRMap(gd.buffData);

  const skills: Record<string, unknown>[] = [];
  const processedSids = new Set<string>();

  // Collect skill IDs from Skill_1..23 + UseEntryJIggleBone
  const skillSlots: string[] = [];
  for (let i = 1; i <= 23; i++) {
    const sid = monster[`Skill_${i}`];
    if (sid && sid !== '0') skillSlots.push(sid);
  }
  // Add skills from shifted fields (UseEntryJIggleBone, PushUp, PushBack)
  // The bytes parser puts skill IDs in these fields due to column shifts
  for (const field of ['UseEntryJIggleBone', 'PushUp', 'PushBack']) {
    const sid = monster[field];
    if (sid && sid !== '0' && sid !== 'true' && sid !== 'True' && skillByNs[sid] && !skillSlots.includes(sid)) {
      skillSlots.push(sid);
    }
  }

  for (const sid of skillSlots) {
    if (processedSids.has(sid)) continue;
    processedSids.add(sid);

    const skillRow = skillByNs[sid];
    if (!skillRow) continue;

    const skillType = skillRow.SkillType ?? '';
    if (!WANTED_SKILL_TYPES.has(skillType)) continue;

    const nameSymbol = skillRow.SkipNameID ?? '';
    const descSymbol = skillRow.DescID ?? '';
    const iconName = skillRow.IconName ?? '';

    const nameTexts = gd.textSkillMap[nameSymbol];
    // DescID can be empty; fallback to SKILL_DESC_{last digits of ns}
    let descTexts = gd.textSkillMap[descSymbol];
    if (!descTexts && sid.length >= 5) {
      descTexts = gd.textSkillMap[`SKILL_DESC_${sid.slice(-5)}`];
    }

    // Resolve placeholders in description
    const resolvedDesc: Record<string, string> = {};
    if (descTexts) {
      for (const lang of LANGS) {
        const raw = descTexts[lang] ?? '';
        // Monster skills use level 1 for placeholder resolution
        resolvedDesc[lang] = resolveBuffPlaceholders(raw, 1, gd.buffIndex);
      }
    }

    // Get buff IDs from MonsterSkillLevelTemplet
    const lvls = gd.monsterSkillLevels.filter(l => l.SkillID === sid);
    const buffIds = collectMonsterBuffIds(lvls);
    const raw = extractBD(buffIds, gd.buffData, { expandInterruption: false });
    const buff = convertToIRFormat(raw.buff, iconToIR).filter(t => !MONSTER_BUFF_TYPE_BLACKLIST.has(t));
    const debuff = convertToIRFormat(raw.debuff, iconToIR).filter(t => !MONSTER_BUFF_TYPE_BLACKLIST.has(t));

    const skill: Record<string, unknown> = {
      name: nameTexts ? Object.fromEntries(LANGS.map(l => [l, nameTexts[l] ?? ''])) : {},
      type: skillType,
      description: resolvedDesc,
      icon: iconName,
    };
    // Apply overrides and patterns from admin JSON files
    const descEn = resolvedDesc.en ?? '';
    applySkillOverrides(descEn, buff, debuff, overrides);
    applySkillPatterns(descEn, buff, debuff, patterns);

    if (buff.length > 0) skill.buff = buff;
    if (debuff.length > 0) skill.debuff = debuff;

    skills.push(skill);
  }

  // Merge RAGE_FINISH into RAGE_ENTER when finish has no description and same icon
  const mergeFinishIntoEnter = (finishType: string, enterType: string) => {
    const finishIdx = skills.findIndex(s => s.type === finishType);
    if (finishIdx < 0) return;
    const finish = skills[finishIdx];
    const finishDesc = finish.description as Record<string, string>;
    const finishDescEn = finishDesc?.en ?? '';

    const finishNameEn = ((finish.name as Record<string, string>)?.en ?? '').trim();

    const enter = skills.find(s => s.type === enterType);
    if (!enter) {
      // No enter: discard orphan finish (no desc or no name)
      if (!finishDescEn) skills.splice(finishIdx, 1);
      return;
    }
    if (finish.icon !== enter.icon) return; // different icon, keep separate

    // Keep separate only if finish has unique content not already in enter
    // Check: finish name or description core is mentioned in enter's description
    const enterDescEn = ((enter.description as Record<string, string>) ?? {}).en ?? '';
    const finishCore = finishDescEn.replace(/[.\s]+$/, '');
    const nameInEnter = finishNameEn && enterDescEn.includes(finishNameEn);
    const descInEnter = finishCore && enterDescEn.includes(finishCore);
    if (finishDescEn && !nameInEnter && !descInEnter) {
      // No match but no name → just discard the finish entry
      if (!finishNameEn) { skills.splice(finishIdx, 1); }
      return;
    }

    // Merge buffs/debuffs from finish into enter
    const enterBuff = (enter.buff as string[]) ?? [];
    const enterDebuff = (enter.debuff as string[]) ?? [];
    for (const b of (finish.buff as string[]) ?? []) { if (!enterBuff.includes(b)) enterBuff.push(b); }
    for (const d of (finish.debuff as string[]) ?? []) { if (!enterDebuff.includes(d)) enterDebuff.push(d); }
    if (enterBuff.length > 0) enter.buff = enterBuff;
    if (enterDebuff.length > 0) enter.debuff = enterDebuff;

    // Remove finish from skills
    skills.splice(finishIdx, 1);
  };

  mergeFinishIntoEnter('SKT_RAGE_FINISH1', 'SKT_RAGE_ENTER1');
  mergeFinishIntoEnter('SKT_RAGE_FINISH2', 'SKT_RAGE_ENTER2');

  return skills;
}

// ── Full monster extraction ───────────────────────────────────────

async function extractMonster(
  gd: GameData, monster: Row, dungeonList: DungeonLink[],
  selectedDungeonId?: string,
  parentBoss?: { id: string; location: DungeonLink },
  existingLevel?: number | null,
) {
  const nameTexts = resolveMonsterName(gd, monster);
  const cls = resolveClass(gd.textSystemMap, monster.Class ?? '');
  const element = resolveElement(gd.textSystemMap, monster.Element ?? '');
  const statBuffImmune = monster.StatBuffImmune ?? '';

  // Pick location: parent boss for minions, selected dungeon, or match existing level
  let location: DungeonLink | null = null;
  if (parentBoss) {
    location = parentBoss.location;
  } else if (selectedDungeonId) {
    location = dungeonList.find(d => d.dungeonId === selectedDungeonId) ?? null;
  } else if (existingLevel != null && dungeonList.length > 1) {
    location = dungeonList.find(d => d.level === existingLevel) ?? dungeonList[0] ?? null;
  } else {
    location = dungeonList[0] ?? null;
  }

  const skills = await extractMonsterSkills(gd, monster);

  const langObj = (texts: LangTexts | null, fallback = '') =>
    Object.fromEntries(LANGS.map(l => [l, texts?.[l] ?? fallback]));

  const surnameTexts = resolveMonsterSurname(gd, monster);

  const compositeId = parentBoss ? `${monster.ID}S${parentBoss.id}` : monster.ID;

  const result: Record<string, unknown> = {
    id: compositeId,
    Name: nameTexts ? langObj(nameTexts) : {},
    Surname: surnameTexts ? langObj(surnameTexts) : null,
    IncludeSurname: false,
    class: cls,
    element,
    level: location?.level ?? null,
    icons: monster.FaceIconID ?? monster.ID,
    BuffImmune: monster.BuffImmune ?? '',
    StatBuffImmune: statBuffImmune,
    location: location ? {
      dungeon: langObj(location.name),
      mode: langObj(location.modeLabel, location.mode),
      area_id: langObj(location.areaId),
    } : null,
    ...(parentBoss ? { summoned_by: parentBoss.id } : {}),
    skills,
  };

  return result;
}

// ── Search ────────────────────────────────────────────────────────

function searchMonsters(gd: GameData, query: string, monsterToDungeons: Map<string, DungeonLink[]>, filterMode = '', filterDungeonId = '', exact = false): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q && !filterMode && !filterDungeonId) return [];

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  function matchesDungeonFilter(dungeons: { mode: string; dungeonId: string }[]): boolean {
    if (!filterMode && !filterDungeonId) return true;
    return dungeons.some(d =>
      (!filterMode || d.mode === filterMode) &&
      (!filterDungeonId || d.dungeonId === filterDungeonId)
    );
  }

  function pushResult(m: Row) {
    if (seen.has(m.ID)) return;
    const nameTexts = resolveMonsterName(gd, m);
    if (!nameTexts) return;
    const dungeons = monsterToDungeons.get(m.ID) ?? [];
    if (!matchesDungeonFilter(dungeons)) return;

    // Text match (skip if we have dungeon filters and no query)
    if (q) {
      if (exact) {
        const nameMatch = LANGS.some(l => (nameTexts[l] ?? '').toLowerCase() === q);
        const idMatch = m.ID === query;
        if (!nameMatch && !idMatch) return;
      } else {
        const nameMatch = LANGS.some(l => (nameTexts[l] ?? '').toLowerCase().includes(q));
        const idMatch = m.ID.includes(q);
        if (!nameMatch && !idMatch) return;
      }
    }

    seen.add(m.ID);
    results.push({
      monsterId: m.ID,
      name: Object.fromEntries(LANGS.map(l => [l, nameTexts[l] ?? ''])),
      type: m.Type ?? '',
      element: m.Element ?? '',
      class: m.Class ?? '',
      race: m.Race ?? '',
      dungeons: dungeons.map(d => ({
        mode: d.mode,
        name: Object.fromEntries(LANGS.map(l => [l, d.name[l] ?? ''])),
        dungeonId: d.dungeonId,
      })),
    });
  }

  for (const m of gd.monsters) {
    if (results.length >= 100) break;
    pushResult(m);
  }

  return results;
}

// ── Route handlers ────────────────────────────────────────────────

function devOnly() {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const action = req.nextUrl.searchParams.get('action') ?? '';

  try {
    const gd = await loadGameData();

    if (action === 'filters') {
      const monsterToDungeons = buildMonsterToDungeons(gd);

      // Collect all modes
      const modes = new Set<string>();
      // Collect all dungeons grouped by mode: mode → { id, name }[]
      const dungeonsByMode: Record<string, Map<string, LangTexts>> = {};

      for (const entries of monsterToDungeons.values()) {
        for (const e of entries) {
          modes.add(e.mode);
          if (!dungeonsByMode[e.mode]) dungeonsByMode[e.mode] = new Map();
          if (!dungeonsByMode[e.mode].has(e.dungeonId)) {
            dungeonsByMode[e.mode].set(e.dungeonId, e.name);
          }
        }
      }

      const dungeons: Record<string, { id: string; name: Record<string, string> }[]> = {};
      for (const [mode, map] of Object.entries(dungeonsByMode)) {
        dungeons[mode] = [...map.entries()].map(([id, name]) => ({
          id,
          name: Object.fromEntries(LANGS.map(l => [l, name[l] ?? ''])),
        })).sort((a, b) => a.name.en.localeCompare(b.name.en));
      }

      const modeList = [...modes].sort().map(m => ({ id: m, label: resolveModeLabel(gd.textSystemMap, m) }));
      return NextResponse.json({ modes: modeList, dungeons });
    }

    if (action === 'search') {
      const q = req.nextUrl.searchParams.get('q') ?? '';
      const mode = req.nextUrl.searchParams.get('mode') ?? '';
      const dungeonId = req.nextUrl.searchParams.get('dungeonId') ?? '';
      const exact = req.nextUrl.searchParams.get('exact') === '1';
      const monsterToDungeons = buildMonsterToDungeons(gd);
      const results = searchMonsters(gd, q, monsterToDungeons, mode, dungeonId, exact);
      return NextResponse.json({ results });
    }

    if (action === 'extract') {
      const id = req.nextUrl.searchParams.get('id') ?? '';
      const selectedDungeonId = req.nextUrl.searchParams.get('dungeonId') ?? '';
      const parentBossId = req.nextUrl.searchParams.get('parentBossId') ?? '';
      const monster = gd.monsters.find(m => m.ID === id);
      if (!monster) return NextResponse.json({ error: `Monster ${id} not found` }, { status: 404 });

      const monsterToDungeons = buildMonsterToDungeons(gd);
      const dungeons = monsterToDungeons.get(id) ?? [];

      // Minion mode: inherit location/level from parent boss
      let parentBoss: { id: string; location: DungeonLink } | undefined;
      if (parentBossId) {
        const parentDungeons = monsterToDungeons.get(parentBossId) ?? [];
        const parentLoc = parentDungeons[0];
        if (parentLoc) parentBoss = { id: parentBossId, location: parentLoc };
      }

      // Load existing to match level for multi-dungeon monsters
      const compositeId = parentBossId ? `${id}S${parentBossId}` : id;
      const filePath = path.join(BOSS_DIR, `${compositeId}.json`);
      let existing = null;
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        existing = JSON.parse(raw);
      } catch { /* not found */ }

      const existingLevel = existing?.level ?? null;
      const extracted = await extractMonster(gd, monster, dungeons, selectedDungeonId || undefined, parentBoss, existingLevel);

      return NextResponse.json({ extracted, existing, allDungeons: dungeons.map(d => ({
        mode: d.mode,
        modeLabel: resolveModeLabel(gd.textSystemMap, d.mode),
        name: Object.fromEntries(LANGS.map(l => [l, d.name[l] ?? ''])),
        areaId: d.areaId ? Object.fromEntries(LANGS.map(l => [l, d.areaId![l] ?? ''])) : null,
        dungeonId: d.dungeonId,
        level: d.level,
      }))});
    }

    if (action === 'apply-overrides') {
      const overrides = await loadSkillOverrides();
      const patterns = await loadSkillPatterns();
      if (Object.keys(overrides).length === 0 && patterns.length === 0) {
        return NextResponse.json({ ok: true, modified: 0, message: 'No overrides or patterns found' });
      }

      let files: string[] = [];
      try { files = (await fs.readdir(BOSS_DIR)).filter(f => f.endsWith('.json') && f !== 'index.json'); } catch { /* empty */ }

      let modified = 0;
      for (const file of files) {
        const fpath = path.join(BOSS_DIR, file);
        const raw = await fs.readFile(fpath, 'utf-8');
        const data = JSON.parse(raw);
        const skills = data.skills as Record<string, unknown>[] | undefined;
        if (!skills) continue;

        let changed = false;
        for (const skill of skills) {
          const descEn = (skill.description as Record<string, string>)?.en ?? '';
          if (!descEn) continue;

          const buff: string[] = [...((skill.buff as string[]) ?? [])];
          const debuff: string[] = [...((skill.debuff as string[]) ?? [])];
          const origBuff = JSON.stringify(buff);
          const origDebuff = JSON.stringify(debuff);

          applySkillOverrides(descEn, buff, debuff, overrides);
          applySkillPatterns(descEn, buff, debuff, patterns);

          if (JSON.stringify(buff) !== origBuff) {
            if (buff.length > 0) skill.buff = buff; else delete skill.buff;
            changed = true;
          }
          if (JSON.stringify(debuff) !== origDebuff) {
            if (debuff.length > 0) skill.debuff = debuff; else delete skill.debuff;
            changed = true;
          }
        }

        if (changed) {
          const eol = raw.includes('\r\n') ? '\r\n' : '\n';
          let output = JSON.stringify(data, null, 2) + '\n';
          if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
          await fs.writeFile(fpath, output, 'utf-8');
          modified++;
        }
      }

      return NextResponse.json({ ok: true, modified, total: files.length });
    }

    if (action === 'compare') {
      const filterMode = req.nextUrl.searchParams.get('mode') ?? '';
      const monsterToDungeons = buildMonsterToDungeons(gd);
      const monsterById = new Map(gd.monsters.map(m => [m.ID, m]));

      // Read all existing boss JSONs (skip versioned files like {id}-{YYMM}.json and index.json)
      let files: string[] = [];
      try { files = (await fs.readdir(BOSS_DIR)).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.replace('.json', '').includes('-')); } catch { /* empty */ }

      type CompareEntry = { id: string; file: string; name: string; diffs: { field: string; existing: string; extracted: string }[]; notInGame?: boolean };

      async function compareOne(file: string, existing: Record<string, unknown>): Promise<CompareEntry | 'ok'> {
        const rawId = String(existing.id ?? file.replace(/\.json$/, ''));
        // Extract base monster ID: "440400079-B-1" → "440400079", "414103191S404400150" → "414103191"
        const id = rawId.split('-')[0].split('S')[0];
        const monster = monsterById.get(id);
        if (!monster) {
          const name = (existing.Name as Record<string, string>)?.en ?? rawId;
          return { id: rawId, file, name, diffs: [], notInGame: true };
        }

        // Minion: resolve parent boss for location/level
        let parentBoss: { id: string; location: DungeonLink } | undefined;
        const sIdx = rawId.indexOf('S');
        if (sIdx > 0) {
          const parentBossId = rawId.slice(sIdx + 1);
          const parentDungeons = monsterToDungeons.get(parentBossId) ?? [];
          if (parentDungeons[0]) parentBoss = { id: parentBossId, location: parentDungeons[0] };
        }

        const dungeons = monsterToDungeons.get(id) ?? [];
        const existingLevel = typeof existing.level === 'number' ? existing.level : null;
        const ext = await extractMonster(gd, monster, dungeons, undefined, parentBoss, existingLevel);

        const diffs: { field: string; existing: string; extracted: string }[] = [];

        // Simple fields
        for (const field of ['class', 'element', 'level', 'icons', 'BuffImmune', 'StatBuffImmune'] as const) {
          const e = String((existing as Record<string, unknown>)[field] ?? '');
          const x = String((ext as Record<string, unknown>)[field] ?? '');
          if (e !== x) diffs.push({ field, existing: e, extracted: x });
        }

        // Localized fields (Name, Surname)
        for (const field of ['Name', 'Surname'] as const) {
          const eLang = (existing as Record<string, unknown>)[field] as Record<string, string> | null;
          const xLang = (ext as Record<string, unknown>)[field] as Record<string, string> | null;
          if (JSON.stringify(eLang) !== JSON.stringify(xLang)) {
            diffs.push({ field, existing: eLang?.en ?? String(eLang ?? ''), extracted: xLang?.en ?? String(xLang ?? '') });
          }
        }

        // Location
        const eLoc = JSON.stringify((existing as Record<string, unknown>).location ?? null);
        const xLoc = JSON.stringify((ext as Record<string, unknown>).location ?? null);
        if (eLoc !== xLoc) {
          const eLocObj = (existing as Record<string, unknown>).location as Record<string, Record<string, string>> | null;
          const xLocObj = (ext as Record<string, unknown>).location as Record<string, Record<string, string>> | null;
          diffs.push({ field: 'location', existing: eLocObj?.dungeon?.en ?? '(null)', extracted: xLocObj?.dungeon?.en ?? '(null)' });
        }

        const extSkills = ext.skills as Record<string, unknown>[];
        const exSkills = (existing.skills ?? []) as Record<string, unknown>[];
        for (const es of extSkills) {
          const match = exSkills.find(s =>
            s.type === es.type && (s.name as Record<string, string>)?.en === (es.name as Record<string, string>)?.en
          );
          if (!match) {
            diffs.push({ field: 'skill (new)', existing: '', extracted: `${es.type}: ${(es.name as Record<string, string>)?.en}` });
            continue;
          }
          const extBuff = JSON.stringify([...((es.buff as string[]) ?? [])].sort());
          const curBuff = JSON.stringify([...((match.buff as string[]) ?? [])].sort());
          if (extBuff !== curBuff) diffs.push({ field: `${(es.name as Record<string, string>)?.en} buff`, existing: curBuff, extracted: extBuff });
          const extDebuff = JSON.stringify([...((es.debuff as string[]) ?? [])].sort());
          const curDebuff = JSON.stringify([...((match.debuff as string[]) ?? [])].sort());
          if (extDebuff !== curDebuff) diffs.push({ field: `${(es.name as Record<string, string>)?.en} debuff`, existing: curDebuff, extracted: extDebuff });
          for (const lang of LANGS) {
            const extDesc = ((es.description as Record<string, string>) ?? {})[lang] ?? '';
            const curDesc = ((match.description as Record<string, string>) ?? {})[lang] ?? '';
            if (extDesc && curDesc && extDesc !== curDesc) {
              diffs.push({ field: `${(es.name as Record<string, string>)?.en} desc_${lang}`, existing: curDesc, extracted: extDesc });
            }
          }
        }
        for (const s of exSkills) {
          const match = extSkills.find(es =>
            es.type === s.type && (es.name as Record<string, string>)?.en === (s.name as Record<string, string>)?.en
          );
          if (!match) {
            diffs.push({ field: 'skill (missing)', existing: `${s.type}: ${(s.name as Record<string, string>)?.en}`, extracted: '' });
          }
        }

        if (diffs.length === 0) return 'ok';
        const name = (existing.Name as Record<string, string>)?.en ?? id;
        return { id: rawId, file, name, diffs };
      }

      // Read and compare in parallel batches
      const BATCH = 10;
      const results: CompareEntry[] = [];
      let ok = 0;
      let notFound = 0;

      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const batchResults = await Promise.all(batch.map(async (file) => {
          try {
            const raw = await fs.readFile(path.join(BOSS_DIR, file), 'utf-8');
            return { file, data: JSON.parse(raw) as Record<string, unknown> };
          } catch { return null; }
        }));

        for (const entry of batchResults) {
          if (!entry) continue;
          const loc = entry.data.location as Record<string, unknown> | null;
          const modeEn = ((loc?.mode as Record<string, string>)?.en ?? '');
          const dungeonEn = ((loc?.dungeon as Record<string, string>)?.en ?? '');

          if (filterMode) {
            // Mode filter: compute refined mode and skip non-matching files
            if (!modeEn && !dungeonEn) continue;
            const refined = refineMode(modeEn, dungeonEn, gd.textSystemMap);
            if (refined !== filterMode) continue;
          } else {
            // Default: skip empty-location and tower/skyward bosses
            if (!modeEn && !dungeonEn) { ok++; continue; }
            if (modeEn.includes('Tower') || modeEn.includes('Skyward') || dungeonEn.includes('Tower') || dungeonEn.includes('Skyward')) { ok++; continue; }
          }

          const res = await compareOne(entry.file, entry.data);
          if (res === 'ok') ok++;
          else if (res.notInGame) { notFound++; results.unshift(res); }
          else results.push(res);
        }
      }

      return NextResponse.json({ total: ok + results.length + notFound, ok, withDiffs: results.length, notFound, results });
    }

    if (action === 'compare-by-mode') {
      const monsterToDungeons = buildMonsterToDungeons(gd);
      const monsterById = new Map(gd.monsters.map(m => [m.ID, m]));

      let files: string[] = [];
      try { files = (await fs.readdir(BOSS_DIR)).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.replace('.json', '').includes('-')); } catch { /* empty */ }

      const byMode: Record<string, { total: number; ok: number; withDiffs: number; diffs: { file: string; name: string; notInGame?: boolean }[] }> = {};

      const BATCH = 10;
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const batchResults = await Promise.all(batch.map(async (file) => {
          try {
            const raw = await fs.readFile(path.join(BOSS_DIR, file), 'utf-8');
            return { file, data: JSON.parse(raw) as Record<string, unknown> };
          } catch { return null; }
        }));

        for (const entry of batchResults) {
          if (!entry) continue;
          const loc = entry.data.location as Record<string, unknown> | null;
          const modeEn = ((loc?.mode as Record<string, string>)?.en ?? '');
          const dungeonEn = ((loc?.dungeon as Record<string, string>)?.en ?? '');

          // Skip empty location
          if (!modeEn && !dungeonEn) continue;

          const mode = refineMode(modeEn, dungeonEn, gd.textSystemMap);
          if (!byMode[mode]) byMode[mode] = { total: 0, ok: 0, withDiffs: 0, diffs: [] };
          byMode[mode].total++;

          const rawId = String(entry.data.id ?? entry.file.replace(/\.json$/, ''));
          const id = rawId.split('-')[0].split('S')[0];
          const monster = monsterById.get(id);
          if (!monster) { byMode[mode].withDiffs++; byMode[mode].diffs.push({ file: entry.file, name: rawId, notInGame: true }); continue; }

          // Minion: resolve parent boss for location/level
          let parentBoss: { id: string; location: DungeonLink } | undefined;
          const sIdx = rawId.indexOf('S');
          if (sIdx > 0) {
            const parentBossId = rawId.slice(sIdx + 1);
            const parentDungeons = monsterToDungeons.get(parentBossId) ?? [];
            if (parentDungeons[0]) parentBoss = { id: parentBossId, location: parentDungeons[0] };
          }

          const dungeons = monsterToDungeons.get(id) ?? [];
          const existingLevel = typeof entry.data.level === 'number' ? entry.data.level : null;
          const ext = await extractMonster(gd, monster, dungeons, undefined, parentBoss, existingLevel);

          // Quick diff check (same logic as compare)
          let hasDiff = false;
          for (const field of ['class', 'element', 'level', 'icons', 'BuffImmune', 'StatBuffImmune'] as const) {
            if (String((entry.data as Record<string, unknown>)[field] ?? '') !== String((ext as Record<string, unknown>)[field] ?? '')) { hasDiff = true; break; }
          }
          if (!hasDiff) {
            // Localized fields
            for (const field of ['Name', 'Surname'] as const) {
              if (JSON.stringify((entry.data as Record<string, unknown>)[field]) !== JSON.stringify((ext as Record<string, unknown>)[field])) { hasDiff = true; break; }
            }
          }
          if (!hasDiff) {
            // Location
            if (JSON.stringify((entry.data as Record<string, unknown>).location) !== JSON.stringify((ext as Record<string, unknown>).location)) hasDiff = true;
          }
          if (!hasDiff) {
            const extSkills = ext.skills as Record<string, unknown>[];
            const exSkills = (entry.data.skills ?? []) as Record<string, unknown>[];
            for (const es of extSkills) {
              const match = exSkills.find(s => s.type === es.type && (s.name as Record<string, string>)?.en === (es.name as Record<string, string>)?.en);
              if (!match) { hasDiff = true; break; }
              if (JSON.stringify([...((es.buff as string[]) ?? [])].sort()) !== JSON.stringify([...((match.buff as string[]) ?? [])].sort())) { hasDiff = true; break; }
              if (JSON.stringify([...((es.debuff as string[]) ?? [])].sort()) !== JSON.stringify([...((match.debuff as string[]) ?? [])].sort())) { hasDiff = true; break; }
              for (const lang of LANGS) {
                const ed = ((es.description as Record<string, string>) ?? {})[lang] ?? '';
                const cd = ((match.description as Record<string, string>) ?? {})[lang] ?? '';
                if (ed && cd && ed !== cd) { hasDiff = true; break; }
              }
              if (hasDiff) break;
            }
            if (!hasDiff) {
              for (const s of exSkills) {
                if (!extSkills.find(es => es.type === s.type && (es.name as Record<string, string>)?.en === (s.name as Record<string, string>)?.en)) { hasDiff = true; break; }
              }
            }
          }

          if (hasDiff) {
            byMode[mode].withDiffs++;
            const name = (entry.data.Name as Record<string, string>)?.en ?? rawId;
            byMode[mode].diffs.push({ file: entry.file, name });
          } else {
            byMode[mode].ok++;
          }
        }
      }

      return NextResponse.json({ byMode });
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
    const data = body.data;
    const version = body.version === true;
    const id = data?.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await fs.mkdir(BOSS_DIR, { recursive: true });
    const filePath = path.join(BOSS_DIR, `${id}.json`);

    // Version: copy existing file to {id}-{YYMM}.json before overwriting
    if (version) {
      try {
        await fs.access(filePath);
        const now = new Date();
        const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
        const versionPath = path.join(BOSS_DIR, `${id}-${yymm}.json`);
        await fs.copyFile(filePath, versionPath);
      } catch { /* no existing file to version */ }
    }

    // Detect EOL from existing file or default to \r\n on Windows
    let eol = '\r\n';
    try {
      const existingRaw = await fs.readFile(filePath, 'utf-8');
      eol = existingRaw.includes('\r\n') ? '\r\n' : '\n';
    } catch { /* new file */ }

    let output = JSON.stringify(data, null, 2) + '\n';
    if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
    await fs.writeFile(filePath, output, 'utf-8');

    return NextResponse.json({ ok: true, id, versioned: version });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  readTemplet, buildTextMap,
  LANGS, type LangTexts,
  resolveClass, resolveElement,
  buildBuffIndex, resolveBuffPlaceholders,
} from '@/app/admin/lib/text';

const BOSS_DIR = path.join(process.cwd(), 'data', 'boss');

// ── Types ─────────────────────────────────────────────────────────

type Row = Record<string, string>;

interface GameData {
  monsters: Row[];
  monsterSkills: Row[];
  monsterSkillLevels: Row[];
  dungeons: Row[];
  spawns: Row[];
  buffData: Row[];
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

let cachedGD: GameData | null = null;

async function loadGameData(): Promise<GameData> {
  if (cachedGD) return cachedGD;

  const [monsterT, monsterSkillT, monsterSkillLevelT, dungeonT, spawnT,
    buffT, textChar, textSkill, textSystem] = await Promise.all([
    readTemplet('MonsterTemplet'),
    readTemplet('MonsterSkillTemplet'),
    readTemplet('MonsterSkillLevelTemplet'),
    readTemplet('DungeonTemplet'),
    readTemplet('DungeonSpawnTemplet'),
    readTemplet('BuffTemplet'),
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
    textCharMap: buildTextMap(textChar.data),
    textSkillMap: buildTextMap(textSkill.data),
    textSystemMap: buildTextMap(textSystem.data),
    buffIndex: buildBuffIndex(buffT.data),
  };
  return cachedGD;
}

// ── Helpers ───────────────────────────────────────────────────────

function resolveMonsterName(gd: GameData, m: Row): LangTexts | undefined {
  const fms = m.FirstMeetIDSymbol ?? '';
  return gd.textCharMap[fms] ?? gd.textCharMap[fms.replace('_Name', '')] ?? gd.textCharMap[fms + '_Name'];
}

function buildSpawnToMonsters(gd: GameData): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const s of gd.spawns) {
    const hpc = s.HPLineCount;
    if (!hpc) continue;
    const mids = new Set<string>();
    for (const idx of ['ID0', 'ID1', 'ID2', 'ID3']) {
      if (s[idx]) mids.add(s[idx]);
    }
    map.set(hpc, mids);
  }
  return map;
}

function buildMonsterToDungeons(gd: GameData): Map<string, { mode: string; name: LangTexts; dungeonId: string }[]> {
  const spawnToMonsters = buildSpawnToMonsters(gd);
  const result = new Map<string, { mode: string; name: LangTexts; dungeonId: string }[]>();

  for (const d of gd.dungeons) {
    const mode = d.DungeonMode;
    if (!mode) continue;
    const nameLangs = gd.textSystemMap[d.SeasonFullName ?? ''];
    if (!nameLangs) continue;
    const dungeonId = d.ID ?? d.FriendSupportUse ?? '';

    for (const pos of ['SpawnID_Pos0', 'SpawnID_Pos1', 'SpawnID_Pos2']) {
      const raw = d[pos];
      if (!raw || raw === 'TRUE' || raw === 'FALSE' || raw === 'True' || raw === 'False') continue;
      for (const part of raw.split(',')) {
        const sid = part.trim();
        const mids = spawnToMonsters.get(sid);
        if (!mids) continue;
        for (const mid of mids) {
          let arr = result.get(mid);
          if (!arr) { arr = []; result.set(mid, arr); }
          // Avoid duplicate dungeon entries
          if (!arr.some(e => e.dungeonId === dungeonId)) {
            arr.push({ mode, name: nameLangs, dungeonId });
          }
        }
      }
    }
  }

  return result;
}

// ── Buff/debuff extraction (same logic as character extractor) ───

const BUFF_BLACKLIST_TYPES = new Set([
  'BT_DAMAGE_SHARE', 'BT_DMG', 'BT_DMG_CASTER_STAT', 'BT_DMG_CASTER_LOST_HP_RATE',
  'BT_DMG_TARGET_LOST_HP_RATE', 'BT_DMG_TO_BOSS', 'BT_DMG_REDUCE',
  'BT_STAT_PREMIUM', 'BT_WG_DMG', 'BT_EXTRA_DMG',
]);

function resolveBuffTag(row: Row): string {
  const type = row.Type ?? '';
  if (BUFF_BLACKLIST_TYPES.has(type)) return '';

  const stat = row.StatType ?? '';
  const icon = row.IconName ?? '';

  // Interruption suffix
  const isIR = icon.includes('Interruption');
  const irSuffix = isIR ? '_IR' : '';

  if (type === 'BT_STAT' && stat && stat !== 'ST_NONE') {
    return `BT_STAT|${stat}${irSuffix}`;
  }
  if (type === 'BT_DOT_POISON' && icon.includes('Poison02')) {
    return 'BT_DOT_POISON2';
  }
  return type ? `${type}${irSuffix}` : '';
}

function extractBuffDebuff(gd: GameData, buffIdStr: string): { buff: string[]; debuff: string[] } {
  const buff = new Set<string>();
  const debuff = new Set<string>();

  const ids = buffIdStr.split(',').map(s => s.trim()).filter(Boolean);
  for (const bid of ids) {
    const rows = gd.buffData.filter(r => r.BuffID === bid);
    for (const row of rows) {
      const tag = resolveBuffTag(row);
      if (!tag) continue;
      const bd = row.BuffDebuffType ?? '';
      if (bd.startsWith('DEBUFF')) debuff.add(tag);
      else buff.add(tag);
    }
  }

  return { buff: [...buff], debuff: [...debuff] };
}

// ── Skill extraction ──────────────────────────────────────────────

const WANTED_SKILL_TYPES = new Set([
  'SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE',
  'SKT_MONSTER_1', 'SKT_MONSTER_2', 'SKT_MONSTER_3',
  'SKT_RAGE_ENTER1', 'SKT_RAGE_ENTER2',
  'SKT_RAGE_FINISH1', 'SKT_RAGE_FINISH2',
  'SKT_CLASS_PASSIVE', 'SKT_CHAIN_PASSIVE',
]);

function extractMonsterSkills(gd: GameData, monster: Row) {
  const skillByNs: Record<string, Row> = {};
  for (const s of gd.monsterSkills) skillByNs[s.NameIDSymbol] = s;

  const skills: Record<string, unknown>[] = [];

  for (let i = 1; i <= 23; i++) {
    const sid = monster[`Skill_${i}`];
    if (!sid || sid === '0') continue;

    const skillRow = skillByNs[sid];
    if (!skillRow) continue;

    const skillType = skillRow.SkillType ?? '';
    if (!WANTED_SKILL_TYPES.has(skillType)) continue;

    const nameSymbol = skillRow.SkipNameID ?? '';
    const descSymbol = skillRow.DescID ?? '';
    const iconName = skillRow.IconName ?? '';

    const nameTexts = gd.textSkillMap[nameSymbol];
    const descTexts = gd.textSkillMap[descSymbol];

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
    const buffIdStr = lvls.map(l => l.BuffID ?? '').filter(Boolean).join(',');
    const { buff, debuff } = extractBuffDebuff(gd, buffIdStr);

    const skill: Record<string, unknown> = {
      name: nameTexts ? Object.fromEntries(LANGS.map(l => [l, nameTexts[l] ?? ''])) : {},
      type: skillType,
      description: resolvedDesc,
      icon: iconName,
    };
    if (buff.length > 0) skill.buff = buff;
    if (debuff.length > 0) skill.debuff = debuff;

    skills.push(skill);
  }

  return skills;
}

// ── Full monster extraction ───────────────────────────────────────

function extractMonster(gd: GameData, monster: Row, dungeonList: { mode: string; name: LangTexts; dungeonId: string }[]) {
  const nameTexts = resolveMonsterName(gd, monster);
  const cls = resolveClass(gd.textSystemMap, monster.Class ?? '');
  const element = resolveElement(gd.textSystemMap, monster.Element ?? '');
  // StatBuffImmune
  const statBuffImmune = monster.StatBuffImmune ?? '';

  // Location (first dungeon entry)
  const location = dungeonList.length > 0 ? dungeonList[0] : null;

  // Mode label resolution
  const modeLabels: Record<string, LangTexts> = {};
  for (const d of dungeonList) {
    if (!modeLabels[d.mode]) {
      // Try to resolve mode name from TextSystem
      const modeKey = `SYS_DUNGEON_MODE_${d.mode.replace('DM_', '')}`;
      modeLabels[d.mode] = gd.textSystemMap[modeKey] ?? { en: d.mode, jp: d.mode, kr: d.mode, zh: d.mode } as LangTexts;
    }
  }

  const skills = extractMonsterSkills(gd, monster);

  const result: Record<string, unknown> = {
    id: monster.ID,
    Name: nameTexts ? Object.fromEntries(LANGS.map(l => [l, nameTexts[l] ?? ''])) : {},
    Surname: null,
    IncludeSurname: false,
    class: cls,
    element,
    level: null,
    icons: monster.FaceIconID ?? monster.ID,
    BuffImmune: '',
    StatBuffImmune: statBuffImmune,
    location: location ? {
      dungeon: Object.fromEntries(LANGS.map(l => [l, location.name[l] ?? ''])),
      mode: Object.fromEntries(LANGS.map(l => [l, (modeLabels[location.mode] ?? {})[l] ?? location.mode])),
      area_id: { en: '', kr: '', jp: '', zh: '' },
    } : null,
    skills,
  };

  return result;
}

// ── Search ────────────────────────────────────────────────────────

function searchMonsters(gd: GameData, query: string, monsterToDungeons: Map<string, { mode: string; name: LangTexts; dungeonId: string }[]>): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Search by monster name
  for (const m of gd.monsters) {
    if (seen.has(m.ID)) continue;
    const nameTexts = resolveMonsterName(gd, m);
    if (!nameTexts) continue;

    const nameMatch = LANGS.some(l => (nameTexts[l] ?? '').toLowerCase().includes(q));
    const idMatch = m.ID.includes(q);

    if (!nameMatch && !idMatch) continue;

    seen.add(m.ID);
    const dungeons = monsterToDungeons.get(m.ID) ?? [];
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

    if (results.length >= 100) break;
  }

  // Search by dungeon name
  if (results.length < 100) {
    for (const d of gd.dungeons) {
      const dName = gd.textSystemMap[d.SeasonFullName ?? ''];
      if (!dName) continue;
      const dungeonMatch = LANGS.some(l => (dName[l] ?? '').toLowerCase().includes(q));
      if (!dungeonMatch) continue;

      // Find monsters in this dungeon
      for (const pos of ['SpawnID_Pos0', 'SpawnID_Pos1', 'SpawnID_Pos2']) {
        const raw = d[pos];
        if (!raw || raw === 'TRUE' || raw === 'FALSE' || raw === 'True' || raw === 'False') continue;
        for (const part of raw.split(',')) {
          const sid = part.trim();
          for (const s of gd.spawns) {
            if (s.HPLineCount !== sid) continue;
            for (const idx of ['ID0', 'ID1', 'ID2', 'ID3']) {
              const mid = s[idx];
              if (!mid || seen.has(mid)) continue;
              seen.add(mid);
              const monster = gd.monsters.find(m => m.ID === mid);
              if (!monster) continue;
              const nameTexts = resolveMonsterName(gd, monster);
              if (!nameTexts) continue;
              const dungeons = monsterToDungeons.get(mid) ?? [];
              results.push({
                monsterId: mid,
                name: Object.fromEntries(LANGS.map(l => [l, nameTexts[l] ?? ''])),
                type: monster.Type ?? '',
                element: monster.Element ?? '',
                class: monster.Class ?? '',
                race: monster.Race ?? '',
                dungeons: dungeons.map(dd => ({
                  mode: dd.mode,
                  name: Object.fromEntries(LANGS.map(l => [l, dd.name[l] ?? ''])),
                  dungeonId: dd.dungeonId,
                })),
              });
            }
          }
        }
      }
      if (results.length >= 100) break;
    }
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

    if (action === 'search') {
      const q = req.nextUrl.searchParams.get('q') ?? '';
      const monsterToDungeons = buildMonsterToDungeons(gd);
      const results = searchMonsters(gd, q, monsterToDungeons);
      return NextResponse.json({ results });
    }

    if (action === 'extract') {
      const id = req.nextUrl.searchParams.get('id') ?? '';
      const monster = gd.monsters.find(m => m.ID === id);
      if (!monster) return NextResponse.json({ error: `Monster ${id} not found` }, { status: 404 });

      const monsterToDungeons = buildMonsterToDungeons(gd);
      const dungeons = monsterToDungeons.get(id) ?? [];
      const extracted = extractMonster(gd, monster, dungeons);

      // Check if already saved
      const filePath = path.join(BOSS_DIR, `${id}.json`);
      let existing = null;
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        existing = JSON.parse(raw);
      } catch { /* not found */ }

      return NextResponse.json({ extracted, existing, allDungeons: dungeons.map(d => ({
        mode: d.mode,
        name: Object.fromEntries(LANGS.map(l => [l, d.name[l] ?? ''])),
        dungeonId: d.dungeonId,
      }))});
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
    const id = data?.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await fs.mkdir(BOSS_DIR, { recursive: true });
    const filePath = path.join(BOSS_DIR, `${id}.json`);

    // Detect EOL from existing file or default to \r\n on Windows
    let eol = '\r\n';
    try {
      const existingRaw = await fs.readFile(filePath, 'utf-8');
      eol = existingRaw.includes('\r\n') ? '\r\n' : '\n';
    } catch { /* new file */ }

    let output = JSON.stringify(data, null, 2) + '\n';
    if (eol === '\r\n') output = output.replace(/\n/g, '\r\n');
    await fs.writeFile(filePath, output, 'utf-8');

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

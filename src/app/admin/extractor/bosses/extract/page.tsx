'use client';

import { useState, useCallback, useEffect } from 'react';
import { DiffHighlight } from '@/app/admin/components/diff-highlight';
import { LangRow, Section } from '@/app/admin/components/extractor-ui';

// ── Types ───────────────────────────────────────────────────────────

interface SearchResult {
  monsterId: string;
  name: Record<string, string>;
  type: string;
  element: string;
  class: string;
  race: string;
  dungeons: { mode: string; name: Record<string, string>; dungeonId: string }[];
}

interface SkillData {
  name: Record<string, string>;
  type: string;
  description: Record<string, string>;
  icon: string;
  buff?: string[];
  debuff?: string[];
}

interface ExtractedMonster {
  id: string;
  Name: Record<string, string>;
  Surname: string | null;
  IncludeSurname: boolean;
  class: string;
  element: string;
  level: number | null;
  icons: string;
  BuffImmune: string;
  StatBuffImmune: string;
  location: {
    dungeon: Record<string, string>;
    mode: Record<string, string>;
    area_id: Record<string, string>;
  } | null;
  skills: SkillData[];
}

interface DungeonEntry {
  mode: string;
  modeLabel: string;
  name: Record<string, string>;
  areaId: Record<string, string> | null;
  dungeonId: string;
  level: number;
}

const API = '/api/admin/extractor/monster';

const TYPE_LABELS: Record<string, string> = {
  CT_MONSTER: 'Mob',
  CT_BOSS_MONSTER: 'Boss',
  CT_AREA_BOSS_MONSTER: 'Area Boss',
  CT_NAMED_MONSTER: 'Named',
  CT_SEASON_BOSS_MONSTER: 'Season Boss',
};

const TYPE_COLORS: Record<string, string> = {
  CT_MONSTER: 'bg-zinc-700/50 text-zinc-400',
  CT_BOSS_MONSTER: 'bg-amber-900/30 text-amber-400',
  CT_AREA_BOSS_MONSTER: 'bg-red-900/30 text-red-400',
  CT_NAMED_MONSTER: 'bg-purple-900/30 text-purple-400',
  CT_SEASON_BOSS_MONSTER: 'bg-cyan-900/30 text-cyan-400',
};

const ELEMENT_COLORS: Record<string, string> = {
  CET_FIRE: 'text-red-400',
  CET_WATER: 'text-blue-400',
  CET_EARTH: 'text-green-400',
  CET_LIGHT: 'text-yellow-300',
  CET_DARK: 'text-purple-400',
};

// ── Page ────────────────────────────────────────────────────────────

export default function BossExtractorPage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  // Filters
  const [modes, setModes] = useState<{ id: string; label: string }[]>([]);
  const [dungeonsByMode, setDungeonsByMode] = useState<Record<string, { id: string; name: Record<string, string> }[]>>({});
  const [filterMode, setFilterMode] = useState('');
  const [filterDungeonId, setFilterDungeonId] = useState('');
  const [exactMatch, setExactMatch] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedMonster | null>(null);
  const [existing, setExisting] = useState<ExtractedMonster | null>(null);
  const [allDungeons, setAllDungeons] = useState<DungeonEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [versionOnSave, setVersionOnSave] = useState(false);
  const [minionMode, setMinionMode] = useState(false);
  const [parentBossId, setParentBossId] = useState('');
  const [refs, setRefs] = useState<{ file: string; line: number; text: string }[] | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);

  // Load filters on mount
  useEffect(() => {
    fetch(`${API}?action=filters`).then(r => r.json()).then(data => {
      setModes(data.modes ?? []);
      setDungeonsByMode(data.dungeons ?? {});
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !filterMode && !filterDungeonId) return;
    setSearching(true);
    setSelectedId(null);
    setExtracted(null);
    setExisting(null);
    try {
      const params = new URLSearchParams({ action: 'search' });
      if (query.trim()) params.set('q', query);
      if (filterMode) params.set('mode', filterMode);
      if (filterDungeonId) params.set('dungeonId', filterDungeonId);
      if (exactMatch) params.set('exact', '1');
      const res = await fetch(`${API}?${params}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }, [query, filterMode, filterDungeonId, exactMatch]);

  async function handleExtract(id: string, dungeonId?: string) {
    setSelectedId(id);
    setExtracting(true);
    setExtracted(null);
    setExisting(null);
    setSaveMsg('');
    try {
      const params = new URLSearchParams({ action: 'extract', id });
      if (dungeonId) params.set('dungeonId', dungeonId);
      if (minionMode && parentBossId.trim()) params.set('parentBossId', parentBossId.trim());
      const res = await fetch(`${API}?${params}`);
      const data = await res.json();
      setExtracted(data.extracted ?? null);
      setExisting(data.existing ?? null);
      setAllDungeons(data.allDungeons ?? []);
    } finally {
      setExtracting(false);
    }
  }

  async function handleFindRefs() {
    if (!selectedId) return;
    setRefsLoading(true);
    setRefs(null);
    try {
      const res = await fetch(`${API}?action=find-references&id=${selectedId}`);
      const data = await res.json();
      setRefs(data.refs ?? []);
    } finally {
      setRefsLoading(false);
    }
  }

  async function handleSave() {
    if (!extracted) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: extracted, version: versionOnSave }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveMsg(`Saved ${data.id}.json${data.versioned ? ' (versioned)' : ''}`);
        setExisting(extracted);
      } else {
        setSaveMsg(`Error: ${data.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters + Search */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={filterMode}
          onChange={e => { setFilterMode(e.target.value); setFilterDungeonId(''); }}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All modes</option>
          {modes.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>

        <select
          value={filterDungeonId}
          onChange={e => setFilterDungeonId(e.target.value)}
          disabled={!filterMode}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none disabled:opacity-40 max-w-xs truncate"
        >
          <option value="">All dungeons</option>
          {(dungeonsByMode[filterMode] ?? []).map(d => (
            <option key={d.id} value={d.id}>{d.name.en}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
          <input type="checkbox" checked={exactMatch} onChange={e => setExactMatch(e.target.checked)}
            className="rounded border-zinc-600" />
          Exact
        </label>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name or ID..."
          className="flex-1 min-w-48 rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={searching || (!query.trim() && !filterMode && !filterDungeonId)}
          className="rounded bg-blue-600/80 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500 disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Minion mode */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
          <input type="checkbox" checked={minionMode} onChange={e => setMinionMode(e.target.checked)}
            className="rounded border-zinc-600" />
          Extract as minion of
        </label>
        {minionMode && (
          <input
            type="text"
            value={parentBossId}
            onChange={e => setParentBossId(e.target.value)}
            placeholder="Parent boss ID (e.g. 404400150)"
            className="w-64 rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        )}
        {minionMode && parentBossId && selectedId && (
          <>
            <button
              onClick={() => handleExtract(selectedId)}
              disabled={extracting}
              className="rounded bg-amber-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-amber-500 disabled:opacity-50"
            >
              Re-extract
            </button>
            <span className="text-[10px] text-zinc-600">File: {selectedId}S{parentBossId}.json</span>
          </>
        )}
      </div>

      <div className="flex gap-6 h-[calc(100vh-300px)]">
        {/* Left panel — search results */}
        <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
          <div className="mb-2 text-xs text-zinc-500">{results.length} result(s)</div>
          <div className="overflow-y-auto flex-1 space-y-0.5">
            {results.map(r => (
              <button
                key={r.monsterId}
                onClick={() => handleExtract(r.monsterId)}
                className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm transition-colors ${
                  selectedId === r.monsterId ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{r.name.en || '(unnamed)'}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${TYPE_COLORS[r.type] ?? 'bg-zinc-700 text-zinc-400'}`}>
                      {TYPE_LABELS[r.type] ?? r.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-zinc-600">{r.monsterId}</span>
                    <span className={`text-[10px] ${ELEMENT_COLORS[r.element] ?? 'text-zinc-500'}`}>{r.element.replace('CET_', '')}</span>
                    <span className="text-[10px] text-zinc-600">{r.class.replace('CCT_', '')}</span>
                  </div>
                  {r.dungeons.length > 0 && (
                    <div className="mt-1 text-[10px] text-zinc-600 truncate">
                      {r.dungeons.slice(0, 2).map(d => `[${d.mode.replace('DM_', '')}] ${d.name.en}`).join(' · ')}
                      {r.dungeons.length > 2 && ` +${r.dungeons.length - 2}`}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — extracted data */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {!selectedId && <div className="flex items-center justify-center h-full text-zinc-600">Search and select a monster to extract</div>}
          {extracting && <div className="flex items-center justify-center h-full text-zinc-400">Extracting...</div>}

          {extracted && !extracting && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{extracted.Name?.en}</h2>
                <span className="font-mono text-sm text-zinc-600">{extracted.id}</span>
                <span className={`text-sm ${ELEMENT_COLORS[results.find(r => r.monsterId === selectedId)?.element ?? ''] ?? ''}`}>
                  {extracted.element}
                </span>
                <span className="text-sm text-zinc-500">{extracted.class}</span>
                {existing && <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs text-green-400">Exists</span>}
                {!existing && <span className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400">New</span>}
                <div className="flex-1" />
                {existing && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                    <input type="checkbox" checked={versionOnSave} onChange={e => setVersionOnSave(e.target.checked)}
                      className="rounded border-zinc-600" />
                    Version
                  </label>
                )}
                <button
                  onClick={handleFindRefs}
                  disabled={refsLoading}
                  className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm font-semibold shadow transition hover:bg-zinc-600 disabled:opacity-50"
                >
                  {refsLoading ? 'Searching...' : 'Refs'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold shadow transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              {saveMsg && <div className="text-sm text-green-400">{saveMsg}</div>}

              {/* References modal */}
              {refs !== null && (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-300">{refs.length} reference(s) in guides</span>
                    <button onClick={() => setRefs(null)} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300">Close</button>
                  </div>
                  {refs.length === 0 && <p className="text-xs text-zinc-500">No references found.</p>}
                  {refs.map((r, i) => (
                    <div key={i} className="text-xs border-t border-zinc-800 pt-1">
                      <span className="font-mono text-blue-400">{r.file}:{r.line}</span>
                      <div className="text-zinc-500 truncate">{r.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Global diff with existing */}
              {existing && (() => {
                const diffs: { field: string; existing: string; extracted: string }[] = [];
                if (extracted.class !== existing.class) diffs.push({ field: 'class', existing: existing.class ?? '', extracted: extracted.class ?? '' });
                if (extracted.element !== existing.element) diffs.push({ field: 'element', existing: existing.element ?? '', extracted: extracted.element ?? '' });
                if (String(extracted.level ?? '') !== String(existing.level ?? '')) diffs.push({ field: 'level', existing: String(existing.level ?? ''), extracted: String(extracted.level ?? '') });
                if (extracted.StatBuffImmune !== existing.StatBuffImmune) diffs.push({ field: 'StatBuffImmune', existing: existing.StatBuffImmune ?? '', extracted: extracted.StatBuffImmune ?? '' });
                const extLoc = JSON.stringify(extracted.location);
                const curLoc = JSON.stringify(existing.location);
                if (extLoc !== curLoc) diffs.push({ field: 'location', existing: existing.location?.dungeon?.en ?? '', extracted: extracted.location?.dungeon?.en ?? '' });
                // Skills count
                const extSkillCount = extracted.skills?.length ?? 0;
                const curSkillCount = (existing.skills as SkillData[])?.length ?? 0;
                if (extSkillCount !== curSkillCount) diffs.push({ field: 'skills count', existing: String(curSkillCount), extracted: String(extSkillCount) });
                // New/missing skills
                for (const s of extracted.skills) {
                  const match = (existing.skills as SkillData[])?.find(es => es.type === s.type && es.name?.en === s.name?.en);
                  if (!match) diffs.push({ field: `skill (new)`, existing: '', extracted: `${s.type}: ${s.name?.en}` });
                }
                for (const es of (existing.skills as SkillData[]) ?? []) {
                  const match = extracted.skills.find(s => s.type === es.type && s.name?.en === es.name?.en);
                  if (!match) diffs.push({ field: `skill (missing)`, existing: `${es.type}: ${es.name?.en}`, extracted: '' });
                }
                if (diffs.length === 0) return null;
                return (
                  <div className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-3 space-y-2">
                    <span className="text-sm font-semibold text-amber-400">{diffs.length} diff(s) with existing</span>
                    {diffs.map((d, i) => (
                      <div key={i}>
                        <span className="font-mono text-[10px] text-zinc-500">{d.field}</span>
                        <DiffHighlight existing={d.existing} extracted={d.extracted} />
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Location */}
              {extracted.location && (
                <Section title="Location">
                  <div className="space-y-1 text-sm text-zinc-400">
                    <div><span className="text-zinc-500">Mode:</span> {extracted.location.mode.en}</div>
                    <div><span className="text-zinc-500">Dungeon:</span> {extracted.location.dungeon.en}</div>
                    {extracted.location.area_id?.en && <div><span className="text-zinc-500">Area:</span> {extracted.location.area_id.en}</div>}
                    {extracted.level && <div><span className="text-zinc-500">Level:</span> {extracted.level}</div>}
                  </div>
                  {allDungeons.length > 1 && (
                    <div className="mt-2 text-[10px] text-zinc-600">
                      Also in: {allDungeons.slice(1).map(d => `[${d.modeLabel}] ${d.name.en}`).join(' · ')}
                    </div>
                  )}
                </Section>
              )}

              {/* Immunities */}
              {extracted.StatBuffImmune && (
                <Section title="Immunities">
                  <div className="flex flex-wrap gap-1">
                    {extracted.StatBuffImmune.split(',').map((s, i) => (
                      <span key={i} className="rounded bg-red-900/20 px-2 py-0.5 text-xs text-red-400">{s.trim()}</span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Skills */}
              {extracted.skills.map((skill, i) => (
                <Section key={i} title={`${skill.type} — ${skill.name?.en ?? '(unnamed)'}`}>
                  <div className="space-y-2">
                    <LangRow field="name" data={{ name: skill.name?.en ?? '', name_jp: skill.name?.jp ?? '', name_kr: skill.name?.kr ?? '', name_zh: skill.name?.zh ?? '' }} />
                    <div className="space-y-1">
                      {(['en', 'jp', 'kr', 'zh'] as const).map(lang => {
                        const desc = skill.description?.[lang] ?? '';
                        if (!desc) return null;
                        return (
                          <div key={lang} className="text-xs">
                            <span className="mr-1.5 font-semibold text-zinc-600 uppercase">{lang}</span>
                            <span className="text-zinc-400 whitespace-pre-wrap" dangerouslySetInnerHTML={{
                              __html: desc
                                .replace(/\\n/g, '\n')
                                .replace(/<[Cc]olor=(#[0-9a-fA-F]+)>/g, '<span style="color:$1">')
                                .replace(/<\/[Cc]olor>/g, '</span>')
                            }} />
                          </div>
                        );
                      })}
                    </div>
                    {skill.icon && <div className="text-xs text-zinc-600">Icon: {skill.icon}</div>}
                    {skill.buff && skill.buff.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skill.buff.map((b, j) => (
                          <span key={j} className="rounded bg-blue-900/20 px-2 py-0.5 text-[10px] text-blue-400">{b}</span>
                        ))}
                      </div>
                    )}
                    {skill.debuff && skill.debuff.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skill.debuff.map((b, j) => (
                          <span key={j} className="rounded bg-red-900/20 px-2 py-0.5 text-[10px] text-red-400">{b}</span>
                        ))}
                      </div>
                    )}
                    {/* Diff with existing */}
                    {existing && (() => {
                      const existingSkill = (existing.skills ?? []).find((s: SkillData) => s.type === skill.type && s.name?.en === skill.name?.en);
                      if (!existingSkill) return null;
                      const diffs: { field: string; existing: string; extracted: string }[] = [];
                      for (const lang of ['en', 'jp', 'kr', 'zh'] as const) {
                        const ext = skill.description?.[lang] ?? '';
                        const cur = existingSkill.description?.[lang] ?? '';
                        if (ext && cur && ext !== cur) diffs.push({ field: `desc_${lang}`, existing: cur, extracted: ext });
                      }
                      const extBuff = JSON.stringify(skill.buff ?? []);
                      const curBuff = JSON.stringify(existingSkill.buff ?? []);
                      if (extBuff !== curBuff) diffs.push({ field: 'buff', existing: curBuff, extracted: extBuff });
                      const extDebuff = JSON.stringify(skill.debuff ?? []);
                      const curDebuff = JSON.stringify(existingSkill.debuff ?? []);
                      if (extDebuff !== curDebuff) diffs.push({ field: 'debuff', existing: curDebuff, extracted: extDebuff });
                      if (diffs.length === 0) return null;
                      return (
                        <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
                          <span className="text-xs font-semibold text-amber-400">Diff with existing:</span>
                          {diffs.map((d, k) => (
                            <div key={k}>
                              <span className="font-mono text-[10px] text-zinc-500">{d.field}</span>
                              <DiffHighlight existing={d.existing} extracted={d.extracted} />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </Section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

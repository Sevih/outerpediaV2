'use client';

import { useState, useEffect, useMemo, useRef, DragEvent } from 'react';
import parseText from '@/app/admin/lib/parse-text-admin';
import buffsData from '@data/effects/buffs.json';
import debuffsData from '@data/effects/debuffs.json';
import restrictionsData from '@data/tower/restrictions.json';
import type { CharacterListEntry } from '@/types/character';
import CharacterPortrait from '@/app/components/character/CharacterPortrait';
import { CharacterPicker } from '@/app/components/character/CharacterPicker';
import RestrictionIcons, { RestrictionIcon } from '@/app/components/guides/tower/RestrictionIcons';
import { l } from '@/lib/i18n/localize';

// ── Types ───────────────────────────────────────────────────────────

interface LangText { en: string; jp: string; kr: string; zh: string }

interface RecommendedGroup {
  names: string[];
  reason: LangText;
}

interface RestrictionSet {
  restrictions: string[];
  recommended: RecommendedGroup[];
}

interface PoolEntry {
  boss_id: string;
  minions?: string[];
  reason: LangText[];
  restrictionSets: RestrictionSet[];
}

interface FloorSet {
  boss_id: string;
  minions?: string[];
  reason: LangText[];
  restrictions: string[];
  recommended: RecommendedGroup[];
  restrictionSets?: RestrictionSet[];
}

interface Floor {
  floor: number;
  random?: boolean;
  sets?: FloorSet[];
  boss_id?: string;
  minions?: string[];
  restrictions?: string[];
  reason?: LangText[];
  recommended?: RecommendedGroup[];
  restrictionSets?: RestrictionSet[];
}

interface TowerData {
  disclaimer: LangText;
  floors: Floor[];
  randomPool: PoolEntry[];
}

const API = '/api/admin/utils/tower';
const EMPTY_LANG: LangText = { en: '', jp: '', kr: '', zh: '' };

const restrictionLabels = restrictionsData as Record<string, { en: string }>;

type RestrictionGroup = { label: string; col: 'left' | 'right' | 'full'; keys: string[] };
const RESTRICTION_GROUPS: RestrictionGroup[] = [
  { label: 'Element — Ban', col: 'left', keys: ['BanFire', 'BanWater', 'BanEarth', 'BanLight', 'BanDark'] },
  { label: 'Element — Force', col: 'right', keys: ['ForceFire', 'ForceWater', 'ForceEarth', 'ForceLight', 'ForceDark'] },
  { label: 'Class — Ban', col: 'left', keys: ['BanStriker', 'BanDefender', 'BanRanger', 'BanHealer', 'BanMage'] },
  { label: 'Class — Force', col: 'right', keys: ['ForceStriker', 'ForceDefender', 'ForceRanger', 'ForceHealer', 'ForceMage'] },
  { label: 'Element — At least', col: 'left', keys: ['AtLeast1_Fire', 'AtLeast2_Fire', 'AtLeast1_Water', 'AtLeast2_Water', 'AtLeast1_Earth', 'AtLeast2_Earth', 'AtLeast1_Light', 'AtLeast2_Light', 'AtLeast1_Dark', 'AtLeast2_Dark'] },
  { label: 'Class — At least', col: 'right', keys: ['AtLeast1_Striker', 'AtLeast2_Striker', 'AtLeast1_Defender', 'AtLeast2_Defender', 'AtLeast1_Ranger', 'AtLeast2_Ranger', 'AtLeast1_Healer', 'AtLeast2_Healer', 'AtLeast1_Mage', 'AtLeast2_Mage'] },
  { label: 'Rarity', col: 'full', keys: ['Only3Star', 'AtLeast1_1Star', 'AtLeast2_1Star', 'AtLeast1_2Star', 'AtLeast2_2Star', 'AtLeast1_3Star'] },
  { label: 'Other', col: 'full', keys: ['Max3'] },
];

const DRAG_MIME = 'application/x-outerpedia-char';
const DRAG_REASON_MIME = 'application/x-outerpedia-reason';

// ── Page ─────────────────────────────────────────────────────────────

export default function TowerEditorPage() {
  const [data, setData] = useState<TowerData | null>(null);
  const [characters, setCharacters] = useState<CharacterListEntry[]>([]);
  const [bossNames, setBossNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBoss, setSelectedBoss] = useState<string | null>(null);
  const [activeSetIdx, setActiveSetIdx] = useState(0);
  const [pickerCtx, setPickerCtx] = useState<{ groupIdx: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}?file=very-hard`).then(r => r.json()),
      fetch('/api/admin/utils/characters?full=1').then(r => r.json()),
      fetch('/api/admin/utils/bosses').then(r => r.json()),
    ]).then(([t, c, b]) => {
      setData(t);
      setCharacters(c as CharacterListEntry[]);
      setBossNames(b);
      setLoading(false);
    });
  }, []);

  const charMap = useMemo(() => {
    const m: Record<string, CharacterListEntry> = {};
    for (const c of characters) m[c.ID] = c;
    return m;
  }, [characters]);

  async function save(updated: TowerData) {
    setData(updated);
    setSaving(true);
    try {
      await fetch(`${API}?file=very-hard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) return <div className="flex justify-center py-10 text-zinc-500">Loading...</div>;

  // Build flat list of all bosses: floors + randomPool
  interface BossEntry {
    key: string;
    label: string;
    bossId: string;
    section: 'floors' | 'randomPool';
    restrictionSets: RestrictionSet[];
    reason: LangText[];
    recommended: RecommendedGroup[];
  }

  const allBosses: BossEntry[] = [];

  for (const fl of data.floors) {
    if (fl.random && fl.sets) {
      for (const s of fl.sets) {
        allBosses.push({
          key: `floor-${fl.floor}-${s.boss_id}`,
          label: `Floor ${fl.floor}`,
          bossId: s.boss_id,
          section: 'floors',
          restrictionSets: s.restrictionSets ?? [],
          reason: s.reason ?? [],
          recommended: s.recommended ?? [],
        });
      }
    } else if (fl.boss_id) {
      allBosses.push({
        key: `floor-${fl.floor}`,
        label: `Floor ${fl.floor}`,
        bossId: fl.boss_id,
        section: 'floors',
        restrictionSets: fl.restrictionSets ?? [],
        reason: fl.reason ?? [],
        recommended: fl.recommended ?? [],
      });
    }
  }

  for (const p of data.randomPool) {
    allBosses.push({
      key: `pool-${p.boss_id}`,
      label: 'Random',
      bossId: p.boss_id,
      section: 'randomPool',
      restrictionSets: p.restrictionSets,
      reason: p.reason ?? [],
      recommended: [],
    });
  }

  const selected = allBosses.find(b => b.key === selectedBoss);

  // ── mutation helpers (randomPool) ────────────────────────────────

  function mutatePoolEntry(bossId: string, fn: (entry: PoolEntry) => void) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;
    const entry = updated.randomPool.find(p => p.boss_id === bossId);
    if (entry) {
      fn(entry);
      save(updated);
    }
  }

  function mutateActiveSet(bossId: string, setIdx: number, fn: (rs: RestrictionSet) => void) {
    mutatePoolEntry(bossId, entry => {
      const rs = entry.restrictionSets[setIdx];
      if (rs) fn(rs);
    });
  }

  // ── floor recommended editing (kept from original) ──────────────

  function addCharToFloorRecommended(bossKey: string, recIdx: number, charId: string) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;
    const parts = bossKey.split('-');
    const floorNum = parseInt(parts[1]);
    const bossId = parts[2];
    const fl = updated.floors.find(f => f.floor === floorNum);
    if (!fl) return;
    let recommended: RecommendedGroup[] | undefined;
    if (bossId && fl.sets) recommended = fl.sets.find(s => s.boss_id === bossId)?.recommended;
    else recommended = fl.recommended;
    if (recommended?.[recIdx] && !recommended[recIdx].names.includes(charId)) {
      recommended[recIdx].names.push(charId);
      save(updated);
    }
  }

  function removeCharFromFloorRecommended(bossKey: string, recIdx: number, charId: string) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;
    const parts = bossKey.split('-');
    const floorNum = parseInt(parts[1]);
    const bossId = parts[2];
    const fl = updated.floors.find(f => f.floor === floorNum);
    if (!fl) return;
    let recommended: RecommendedGroup[] | undefined;
    if (bossId && fl.sets) recommended = fl.sets.find(s => s.boss_id === bossId)?.recommended;
    else recommended = fl.recommended;
    if (recommended?.[recIdx]) {
      recommended[recIdx].names = recommended[recIdx].names.filter(n => n !== charId);
      save(updated);
    }
  }

  return (
    <div className="mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Tower Very Hard</h1>
        {saving && <span className="text-xs text-zinc-500 animate-pulse">Saving...</span>}
      </div>

      <div className="flex gap-6 h-[calc(100vh-160px)]">
        {/* Boss list */}
        <div className="w-64 shrink-0 flex flex-col border-r border-zinc-800 pr-3 overflow-y-auto">
          {(() => {
            const floor20 = allBosses.filter(b => b.label === 'Floor 20');
            const fixedFloors = allBosses.filter(b => b.section === 'floors' && b.label !== 'Floor 20');
            const pool = allBosses.filter(b => b.section === 'randomPool');

            const renderBoss = (b: BossEntry) => (
              <button key={b.key} onClick={() => { setSelectedBoss(b.key); setActiveSetIdx(0); setPickerCtx(null); }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  selectedBoss === b.key ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}>
                <span className="flex-1 truncate font-medium">{bossNames[b.bossId] ?? b.bossId}</span>
                <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{b.restrictionSets.length}</span>
              </button>
            );

            return (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Floor 20</div>
                <div className="space-y-0.5 mb-2">{floor20.map(renderBoss)}</div>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border-t border-zinc-800 mt-1 pt-2">Fixed Floors</div>
                <div className="space-y-0.5 mb-2">{fixedFloors.map(renderBoss)}</div>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border-t border-zinc-800 mt-1 pt-2">Random Pool ({pool.length})</div>
                <div className="space-y-0.5">{pool.map(renderBoss)}</div>
              </>
            );
          })()}
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto min-w-0 pr-1">
          {!selected && <div className="flex items-center justify-center h-full text-zinc-600">Select a boss to edit restriction sets</div>}

          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{bossNames[selected.bossId] ?? selected.bossId}</h2>
                <span className="text-sm font-mono text-zinc-600">{selected.bossId}</span>
                <span className="text-sm text-zinc-500">{selected.label}</span>
                <span className="text-sm text-zinc-500">{selected.restrictionSets.length} set(s)</span>
              </div>

              {/* Strategy (reason, read-only) */}
              {selected.reason.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase">Strategy</h3>
                  {selected.reason.map((r, i) => (
                    <p key={i} className="text-sm text-zinc-300">{parseText(r.en)}</p>
                  ))}
                </div>
              )}

              {/* Floor recommended (editable) */}
              {selected.section === 'floors' && selected.recommended.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase">Recommended</h3>
                  {selected.recommended.map((rec, i) => (
                    <div key={i} className="pl-2 border-l border-zinc-700 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rec.names.map(n => (
                          <span key={n} className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">
                            {charMap[n]?.Fullname || n}
                            <button onClick={() => removeCharFromFloorRecommended(selected.key, i, n)}
                              className="text-zinc-500 hover:text-red-400 ml-0.5">x</button>
                          </span>
                        ))}
                        {rec.reason.en && <span className="text-xs text-zinc-500">— {parseText(rec.reason.en)}</span>}
                      </div>
                      <InlineCharPicker characters={characters} onSelect={(c) => addCharToFloorRecommended(selected.key, i, c.ID)} />
                    </div>
                  ))}
                </div>
              )}

              {/* RandomPool editor */}
              {selected.section === 'randomPool' && (
                <RandomPoolEditor
                  bossId={selected.bossId}
                  bossKey={selected.key}
                  sets={selected.restrictionSets}
                  activeSetIdx={activeSetIdx}
                  setActiveSetIdx={setActiveSetIdx}
                  charMap={charMap}
                  pickerCtx={pickerCtx}
                  setPickerCtx={setPickerCtx}
                  characters={characters}
                  mutateActiveSet={mutateActiveSet}
                  mutatePoolEntry={mutatePoolEntry}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RandomPool Editor ────────────────────────────────────────────────

function RandomPoolEditor({
  bossId, sets, activeSetIdx, setActiveSetIdx, charMap, pickerCtx, setPickerCtx, characters, mutateActiveSet, mutatePoolEntry,
}: {
  bossId: string;
  bossKey: string;
  sets: RestrictionSet[];
  activeSetIdx: number;
  setActiveSetIdx: (n: number) => void;
  charMap: Record<string, CharacterListEntry>;
  pickerCtx: { groupIdx: number } | null;
  setPickerCtx: (p: { groupIdx: number } | null) => void;
  characters: CharacterListEntry[];
  mutateActiveSet: (bossId: string, setIdx: number, fn: (rs: RestrictionSet) => void) => void;
  mutatePoolEntry: (bossId: string, fn: (entry: PoolEntry) => void) => void;
}) {
  const safeIdx = Math.min(activeSetIdx, Math.max(sets.length - 1, 0));
  const activeSet = sets[safeIdx];

  function toggleRestriction(r: string) {
    mutateActiveSet(bossId, safeIdx, rs => {
      const i = rs.restrictions.indexOf(r);
      if (i >= 0) rs.restrictions.splice(i, 1);
      else rs.restrictions.push(r);
    });
  }

  function addCharToGroup(groupIdx: number, charId: string) {
    mutateActiveSet(bossId, safeIdx, rs => {
      const g = rs.recommended[groupIdx];
      if (g && !g.names.includes(charId)) g.names.push(charId);
    });
  }

  function removeCharFromGroup(groupIdx: number, charId: string) {
    mutateActiveSet(bossId, safeIdx, rs => {
      const g = rs.recommended[groupIdx];
      if (g) g.names = g.names.filter(n => n !== charId);
    });
  }

  function updateGroupReason(groupIdx: number, reason: Partial<LangText>) {
    mutateActiveSet(bossId, safeIdx, rs => {
      const g = rs.recommended[groupIdx];
      if (g) g.reason = { ...g.reason, ...reason };
    });
  }

  function addGroup() {
    mutateActiveSet(bossId, safeIdx, rs => {
      rs.recommended.push({ names: [], reason: { ...EMPTY_LANG } });
    });
  }

  function removeGroup(groupIdx: number) {
    mutateActiveSet(bossId, safeIdx, rs => {
      rs.recommended.splice(groupIdx, 1);
    });
  }

  function addSet() {
    mutatePoolEntry(bossId, entry => {
      entry.restrictionSets.push({ restrictions: [], recommended: [{ names: [], reason: { ...EMPTY_LANG } }] });
    });
    setActiveSetIdx(sets.length); // new set appended
  }

  function deleteSet(setIdx: number) {
    if (!confirm('Delete this restriction set?')) return;
    mutatePoolEntry(bossId, entry => {
      entry.restrictionSets.splice(setIdx, 1);
    });
    if (safeIdx >= sets.length - 1) setActiveSetIdx(Math.max(0, sets.length - 2));
  }

  function duplicateSet(setIdx: number) {
    mutatePoolEntry(bossId, entry => {
      const clone = JSON.parse(JSON.stringify(entry.restrictionSets[setIdx])) as RestrictionSet;
      entry.restrictionSets.splice(setIdx + 1, 0, clone);
    });
    setActiveSetIdx(setIdx + 1);
  }

  // Union pool: merged by reason.en text — all chars sharing the same reason appear in one row
  const unionRows: { reason: LangText; names: string[] }[] = (() => {
    const map = new Map<string, { reason: LangText; names: string[] }>();
    for (const s of sets) {
      for (const g of s.recommended) {
        if (g.names.length === 0) continue;
        const key = (g.reason.en || '').trim();
        const existing = map.get(key);
        if (existing) {
          for (const n of g.names) if (!existing.names.includes(n)) existing.names.push(n);
          // prefer a row that has translations filled in
          if (!existing.reason.jp && g.reason.jp) existing.reason = { ...existing.reason, ...g.reason };
        } else {
          map.set(key, { reason: { ...g.reason }, names: [...g.names] });
        }
      }
    }
    return Array.from(map.values());
  })();

  function onDropToGroup(e: DragEvent<HTMLDivElement>, groupIdx: number) {
    e.preventDefault();
    const reasonJson = e.dataTransfer.getData(DRAG_REASON_MIME);
    if (reasonJson) {
      try {
        const reason = JSON.parse(reasonJson) as LangText;
        mutateActiveSet(bossId, safeIdx, rs => {
          const g = rs.recommended[groupIdx];
          if (g) g.reason = { ...g.reason, ...reason };
        });
        return;
      } catch {
        // fallthrough
      }
    }
    const charId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (charId) addCharToGroup(groupIdx, charId);
  }

  return (
    <div className="space-y-4">
      {/* Union pool */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase">Full pool (drag to assign)</h3>
        {unionRows.length === 0 && <p className="text-xs text-zinc-600">No characters assigned yet.</p>}
        {unionRows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-start gap-2 pl-2 border-l border-zinc-700">
            <div className="flex flex-wrap gap-1.5 flex-1">
              {row.names.map(n => {
                const ch = charMap[n];
                return (
                  <div key={n}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, n);
                      e.dataTransfer.setData('text/plain', n);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    title={ch?.Fullname || n}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {ch ? (
                      <CharacterPortrait
                        id={ch.ID}
                        name={l(ch, 'Fullname', 'en')}
                        element={ch.Element}
                        classType={ch.Class}
                        size="sm"
                        showIcons
                      />
                    ) : (
                      <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{n}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {row.reason.en && (
              <span
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_REASON_MIME, JSON.stringify(row.reason));
                  e.dataTransfer.setData('text/plain', row.reason.en);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                title="Drag to assign reason"
                className="text-[11px] text-zinc-500 max-w-sm shrink cursor-grab active:cursor-grabbing rounded px-1 hover:bg-zinc-800 hover:text-zinc-300 transition"
              >
                {parseText(row.reason.en)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Set tabs */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-800">
        {sets.map((s, i) => (
          <button key={i} onClick={() => setActiveSetIdx(i)}
            className={`flex items-center gap-2 rounded-t px-3 py-1.5 text-xs font-medium transition border-b-2 ${
              i === safeIdx
                ? 'bg-zinc-800 text-zinc-100 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300 border-transparent'
            }`}>
            <span>Set {i + 1}</span>
            {s.restrictions.length > 0
              ? <RestrictionIcons restrictions={s.restrictions} />
              : <span className="text-[10px] text-zinc-600">(no restriction)</span>
            }
          </button>
        ))}
        <button onClick={addSet}
          className="rounded-t px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition border-b-2 border-transparent">
          + New Set
        </button>
      </div>

      {activeSet && (
        <div className="space-y-4">
          {/* Set actions */}
          <div className="flex gap-2">
            <button onClick={() => duplicateSet(safeIdx)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition">Duplicate set</button>
            <button onClick={() => deleteSet(safeIdx)}
              className="text-[11px] text-red-400 hover:text-red-300 transition">Delete set</button>
          </div>

          {/* Restrictions */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase">Restrictions</h3>
            {(() => {
              const renderButton = (r: string) => {
                const active = activeSet.restrictions.includes(r);
                return (
                  <button key={r} onClick={() => toggleRestriction(r)} title={restrictionLabels[r]?.en ?? r}
                    className={`flex items-center justify-center rounded px-1.5 py-1 transition ${
                      active
                        ? 'bg-zinc-700 ring-1 ring-amber-400/60'
                        : 'bg-zinc-800/40 opacity-40 hover:opacity-80'
                    }`}>
                    <RestrictionIcon id={r} />
                  </button>
                );
              };
              const renderGroup = (group: RestrictionGroup) => {
                const keys = group.keys.filter(r => r in restrictionLabels);
                const isAtLeast = group.label.includes('At least');
                return (
                  <div key={group.label}>
                    <div className="text-[10px] text-zinc-600 mb-1">{group.label}</div>
                    {isAtLeast ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">{keys.filter(k => k.startsWith('AtLeast1_')).map(renderButton)}</div>
                        <div className="flex flex-wrap gap-1">{keys.filter(k => k.startsWith('AtLeast2_')).map(renderButton)}</div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">{keys.map(renderButton)}</div>
                    )}
                  </div>
                );
              };
              const left = RESTRICTION_GROUPS.filter(g => g.col === 'left');
              const right = RESTRICTION_GROUPS.filter(g => g.col === 'right');
              const full = RESTRICTION_GROUPS.filter(g => g.col === 'full');
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <div className="space-y-3">{left.map(renderGroup)}</div>
                    <div className="space-y-3">{right.map(renderGroup)}</div>
                  </div>
                  {full.length > 0 && <div className="space-y-3 pt-2 border-t border-zinc-800">{full.map(renderGroup)}</div>}
                </>
              );
            })()}
          </div>

          {/* Recommended groups (drop zones) */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase">Recommended groups</h3>
            {activeSet.recommended.map((group, gi) => (
              <div key={gi}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={(e) => onDropToGroup(e, gi)}
                className="rounded border border-zinc-800 hover:border-zinc-600 p-3 space-y-2 transition">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 uppercase font-semibold">Group {gi + 1}</span>
                  <span className="text-[10px] text-zinc-700">(drop here)</span>
                  <div className="flex-1" />
                  {activeSet.recommended.length > 1 && (
                    <button onClick={() => removeGroup(gi)} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {group.names.map(n => {
                    const ch = charMap[n];
                    return (
                      <div key={n} className="relative group/char" title={ch?.Fullname || n}>
                        {ch ? (
                          <CharacterPortrait
                            id={ch.ID}
                            name={l(ch, 'Fullname', 'en')}
                            element={ch.Element}
                            classType={ch.Class}
                            size="sm"
                            showIcons
                          />
                        ) : (
                          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{n}</span>
                        )}
                        <button onClick={() => removeCharFromGroup(gi, n)}
                          className="absolute -top-1 -right-1 z-20 rounded-full bg-red-600 p-0.5 text-white opacity-0 group-hover/char:opacity-100 transition-opacity shadow">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {group.names.length === 0 && <span className="text-xs text-zinc-600">(drop characters here)</span>}
                  <button onClick={() => setPickerCtx({ groupIdx: gi })}
                    className="rounded border border-dashed border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition">
                    + Pick
                  </button>
                </div>

                <CollapsibleReason reason={group.reason} onChange={(v) => updateGroupReason(gi, v)} />
              </div>
            ))}
            <button onClick={addGroup}
              className="w-full rounded border border-dashed border-zinc-700 px-3 py-1.5 text-[10px] text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition">
              + Add recommended group
            </button>
          </div>
        </div>
      )}

      {pickerCtx && (
        <CharacterPicker
          characters={characters}
          onPick={(c) => { addCharToGroup(pickerCtx.groupIdx, c.ID); setPickerCtx(null); }}
          onClose={() => setPickerCtx(null)}
          labels={{ title: 'Pick a character' }}
        />
      )}
    </div>
  );
}

// ── Collapsible Reason (read-only by default, edit on click) ────────

function CollapsibleReason({ reason, onChange }: { reason: LangText; onChange: (v: Partial<LangText>) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="space-y-1">
        <ReasonInput reason={reason} onChange={onChange} />
        <button onClick={() => setEditing(false)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition">Done</button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0 text-xs text-zinc-400">
        {reason.en ? parseText(reason.en) : <span className="text-zinc-600 italic">(no reason)</span>}
      </div>
      <button onClick={() => setEditing(true)}
        className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 transition">
        Edit
      </button>
    </div>
  );
}

// ── Reason Input with Effect Picker ──────────────────────────────────

interface EffectEntry { name: string; label: string }
const allEffects: { type: 'B' | 'D'; name: string; label: string }[] = [
  ...(buffsData as EffectEntry[]).map(e => ({ type: 'B' as const, name: e.name, label: e.label })),
  ...(debuffsData as EffectEntry[]).map(e => ({ type: 'D' as const, name: e.name, label: e.label })),
];

function ReasonInput({ reason, onChange }: { reason: LangText; onChange: (v: Partial<LangText>) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const value = reason.en;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allEffects.slice(0, 30);
    const s = search.toLowerCase();
    return allEffects.filter(e => e.label.toLowerCase().includes(s) || e.name.toLowerCase().includes(s)).slice(0, 30);
  }, [search]);

  function insertEffect(type: 'B' | 'D', name: string) {
    const tag = `{${type}/${name}}`;
    const el = inputRef.current;
    if (el) {
      const pos = el.selectionStart ?? value.length;
      const before = value.slice(0, pos);
      const after = value.slice(pos);
      const spaceBefore = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
      const spaceAfter = after.length > 0 && !after.startsWith(' ') ? ' ' : '';
      onChange({ en: before + spaceBefore + tag + spaceAfter + after });
    } else {
      onChange({ en: value + (value && !value.endsWith(' ') ? ' ' : '') + tag });
    }
    setOpen(false);
    setSearch('');
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <label className="text-[10px] text-zinc-600">Reason (EN)</label>
        <div ref={pickerRef} className="relative">
          <button onClick={() => setOpen(v => !v)}
            className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 transition">
            + Effect
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1 z-40 w-72 rounded border border-zinc-700 bg-zinc-900 shadow-xl flex flex-col max-h-64 overflow-hidden">
              <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
                placeholder="Search effect..."
                className="m-1.5 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs placeholder-zinc-500 focus:border-zinc-500 focus:outline-none" />
              <div className="overflow-y-auto">
                {filtered.map((e, idx) => (
                  <button key={idx} onClick={() => insertEffect(e.type, e.name)}
                    className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-zinc-800 transition">
                    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
                      e.type === 'B' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                    }`}>{e.type}</span>
                    <span className="text-zinc-300 truncate">{e.label}</span>
                    <span className="ml-auto text-[10px] text-zinc-600 truncate">{e.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <input ref={inputRef} value={value} onChange={e => onChange({ en: e.target.value })}
        className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs focus:border-zinc-500 focus:outline-none"
        placeholder="e.g. {D/BT_STUN} options" />
      {value && <div className="mt-1 text-xs text-zinc-400">{parseText(value)}</div>}
    </div>
  );
}

// ── Inline Character Picker (compact search dropdown) ──────────────

function InlineCharPicker({ characters, onSelect }: { characters: CharacterListEntry[]; onSelect: (c: CharacterListEntry) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    return characters.filter(c => c.Fullname.toLowerCase().includes(s) || c.ID.includes(s)).slice(0, 20);
  }, [characters, search]);

  return (
    <div ref={ref} className="relative mt-1">
      <input value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { if (search.trim()) setOpen(true); }}
        placeholder="Search character to add..."
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs placeholder-zinc-500 focus:border-zinc-500 focus:outline-none" />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded border border-zinc-700 bg-zinc-900 shadow-xl">
          {results.map(c => (
            <button key={c.ID} onClick={() => { onSelect(c); setSearch(''); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition">
              <span className="truncate">{c.Fullname}</span>
              <span className="ml-auto text-zinc-600 font-mono">{c.ID}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

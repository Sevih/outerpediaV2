'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import parseText from '@/app/admin/lib/parse-text-admin';
import buffsData from '@data/effects/buffs.json';
import debuffsData from '@data/effects/debuffs.json';
import restrictionsData from '@data/tower/restrictions.json';

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

interface CharEntry { id: string; name: string }

const API = '/api/admin/utils/tower';
const EMPTY_LANG: LangText = { en: '', jp: '', kr: '', zh: '' };

const restrictionLabels = restrictionsData as Record<string, { en: string }>;

const RESTRICTION_GROUPS: { label: string; style: 'ban' | 'req'; keys: string[] }[] = [
  { label: 'Element — Force', style: 'ban', keys: ['ForceFire', 'ForceWater', 'ForceEarth', 'ForceLight', 'ForceDark'] },
  { label: 'Element — Ban', style: 'ban', keys: ['BanFire', 'BanWater', 'BanEarth', 'BanLight', 'BanDark'] },
  { label: 'Element — At least', style: 'req', keys: ['AtLeast1_Fire', 'AtLeast2_Fire', 'AtLeast1_Water', 'AtLeast2_Water', 'AtLeast1_Earth', 'AtLeast2_Earth', 'AtLeast1_Light', 'AtLeast2_Light', 'AtLeast1_Dark', 'AtLeast2_Dark'] },
  { label: 'Class — Force', style: 'ban', keys: ['ForceStriker', 'ForceDefender', 'ForceRanger', 'ForceHealer', 'ForceMage'] },
  { label: 'Class — Ban', style: 'ban', keys: ['BanStriker', 'BanDefender', 'BanRanger', 'BanHealer', 'BanMage'] },
  { label: 'Class — At least', style: 'req', keys: ['AtLeast1_Striker', 'AtLeast2_Striker', 'AtLeast1_Defender', 'AtLeast2_Defender', 'AtLeast1_Ranger', 'AtLeast2_Ranger', 'AtLeast1_Healer', 'AtLeast2_Healer', 'AtLeast1_Mage', 'AtLeast2_Mage'] },
  { label: 'Rarity', style: 'req', keys: ['Only3Star', 'AtLeast1_1Star', 'AtLeast2_1Star', 'AtLeast1_2Star', 'AtLeast2_2Star', 'AtLeast1_3Star'] },
  { label: 'Other', style: 'ban', keys: ['Max3'] },
];

// ── Page ─────────────────────────────────────────────────────────────

export default function TowerEditorPage() {
  const [data, setData] = useState<TowerData | null>(null);
  const [characters, setCharacters] = useState<CharEntry[]>([]);
  const [bossNames, setBossNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBoss, setSelectedBoss] = useState<string | null>(null);
  const [editingSetIdx, setEditingSetIdx] = useState<number | null>(null); // restriction set being edited
  const [addingSet, setAddingSet] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}?file=very-hard`).then(r => r.json()),
      fetch('/api/admin/utils/characters').then(r => r.json()),
      fetch('/api/admin/utils/bosses').then(r => r.json()),
    ]).then(([t, c, b]) => {
      setData(t);
      setCharacters(c);
      setBossNames(b);
      setLoading(false);
    });
  }, []);

  const charMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of characters) m[c.id] = c.name;
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
    section: string;
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

  function addRestrictionSet(bossKey: string, newSet: RestrictionSet) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;

    if (bossKey.startsWith('pool-')) {
      const bossId = bossKey.replace('pool-', '');
      const entry = updated.randomPool.find(p => p.boss_id === bossId);
      if (entry) entry.restrictionSets.push(newSet);
    } else {
      // floor-X or floor-X-bossId
      const parts = bossKey.split('-');
      const floorNum = parseInt(parts[1]);
      const bossId = parts[2];
      const fl = updated.floors.find(f => f.floor === floorNum);
      if (fl) {
        if (bossId && fl.sets) {
          const s = fl.sets.find(s => s.boss_id === bossId);
          if (s) {
            if (!s.restrictionSets) s.restrictionSets = [];
            s.restrictionSets.push(newSet);
          }
        } else {
          if (!fl.restrictionSets) fl.restrictionSets = [];
          fl.restrictionSets.push(newSet);
        }
      }
    }

    save(updated);
  }

  function deleteRestrictionSet(bossKey: string, setIdx: number) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;

    if (bossKey.startsWith('pool-')) {
      const bossId = bossKey.replace('pool-', '');
      const entry = updated.randomPool.find(p => p.boss_id === bossId);
      if (entry) entry.restrictionSets.splice(setIdx, 1);
    } else {
      const parts = bossKey.split('-');
      const floorNum = parseInt(parts[1]);
      const bossId = parts[2];
      const fl = updated.floors.find(f => f.floor === floorNum);
      if (fl) {
        if (bossId && fl.sets) {
          const s = fl.sets.find(s => s.boss_id === bossId);
          if (s?.restrictionSets) s.restrictionSets.splice(setIdx, 1);
        } else if (fl.restrictionSets) {
          fl.restrictionSets.splice(setIdx, 1);
        }
      }
    }

    save(updated);
  }

  function addCharToRecommended(bossKey: string, recIdx: number, charId: string) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;

    const parts = bossKey.split('-');
    const floorNum = parseInt(parts[1]);
    const bossId = parts[2];
    const fl = updated.floors.find(f => f.floor === floorNum);
    if (!fl) return;

    let recommended: RecommendedGroup[] | undefined;
    if (bossId && fl.sets) {
      const s = fl.sets.find(s => s.boss_id === bossId);
      recommended = s?.recommended;
    } else {
      recommended = fl.recommended;
    }

    if (recommended && recommended[recIdx]) {
      if (!recommended[recIdx].names.includes(charId)) {
        recommended[recIdx].names.push(charId);
        save(updated);
      }
    }
  }

  function removeCharFromRecommended(bossKey: string, recIdx: number, charId: string) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;

    const parts = bossKey.split('-');
    const floorNum = parseInt(parts[1]);
    const bossId = parts[2];
    const fl = updated.floors.find(f => f.floor === floorNum);
    if (!fl) return;

    let recommended: RecommendedGroup[] | undefined;
    if (bossId && fl.sets) {
      const s = fl.sets.find(s => s.boss_id === bossId);
      recommended = s?.recommended;
    } else {
      recommended = fl.recommended;
    }

    if (recommended && recommended[recIdx]) {
      recommended[recIdx].names = recommended[recIdx].names.filter(n => n !== charId);
      save(updated);
    }
  }

  function duplicateRestrictionSet(bossKey: string, setIdx: number) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;

    if (bossKey.startsWith('pool-')) {
      const bossId = bossKey.replace('pool-', '');
      const entry = updated.randomPool.find(p => p.boss_id === bossId);
      if (entry) {
        const clone = JSON.parse(JSON.stringify(entry.restrictionSets[setIdx])) as RestrictionSet;
        entry.restrictionSets.splice(setIdx + 1, 0, clone);
      }
    }

    save(updated);
  }

  function updateRestrictionSet(bossKey: string, setIdx: number, newSet: RestrictionSet) {
    if (!data) return;
    const updated = JSON.parse(JSON.stringify(data)) as TowerData;

    if (bossKey.startsWith('pool-')) {
      const bossId = bossKey.replace('pool-', '');
      const entry = updated.randomPool.find(p => p.boss_id === bossId);
      if (entry) entry.restrictionSets[setIdx] = newSet;
    }

    save(updated);
  }

  return (
    <div className="mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Tower Very Hard</h1>
        {saving && <span className="text-xs text-zinc-500 animate-pulse">Saving...</span>}
      </div>

      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Boss list */}
        <div className="w-72 shrink-0 flex flex-col border-r border-zinc-800 pr-4 overflow-y-auto">
          {(() => {
            const floor20 = allBosses.filter(b => b.label === 'Floor 20');
            const fixedFloors = allBosses.filter(b => b.section === 'floors' && b.label !== 'Floor 20');
            const pool = allBosses.filter(b => b.section === 'randomPool');

            const renderBoss = (b: typeof allBosses[0]) => (
              <button key={b.key} onClick={() => { setSelectedBoss(b.key); setEditingSetIdx(null); setAddingSet(false); }}
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
        <div className="flex-1 overflow-y-auto min-w-0">
          {!selected && <div className="flex items-center justify-center h-full text-zinc-600">Select a boss to edit restriction sets</div>}

          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{bossNames[selected.bossId] ?? selected.bossId}</h2>
                <span className="text-sm font-mono text-zinc-600">{selected.bossId}</span>
                <span className="text-sm text-zinc-500">{selected.label}</span>
                <span className="text-sm text-zinc-500">{selected.restrictionSets.length} restriction set(s)</span>
              </div>

              {/* Reasons */}
              {selected.reason.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase">Strategy</h3>
                  {selected.reason.map((r, i) => (
                    <p key={i} className="text-sm text-zinc-300">{parseText(r.en)}</p>
                  ))}
                </div>
              )}

              {/* Recommended (editable for floors) */}
              {selected.recommended.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase">Recommended</h3>
                  {selected.recommended.map((rec, i) => (
                    <div key={i} className="pl-2 border-l border-zinc-700 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rec.names.map(n => (
                          <span key={n} className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">
                            {charMap[n] || n}
                            {selected.section === 'floors' && (
                              <button onClick={() => removeCharFromRecommended(selected.key, i, n)}
                                className="text-zinc-500 hover:text-red-400 ml-0.5">x</button>
                            )}
                          </span>
                        ))}
                        {rec.reason.en && <span className="text-xs text-zinc-500">— {parseText(rec.reason.en)}</span>}
                      </div>
                      {selected.section === 'floors' && (
                        <CharPicker characters={characters} onSelect={(c) => addCharToRecommended(selected.key, i, c.id)} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Restriction sets (randomPool) */}
              {selected.section === 'randomPool' && editingSetIdx === null && !addingSet && (
                <>
                  {selected.restrictionSets.map((rs, i) => (
                    <div key={i} className="rounded-lg border border-zinc-800 hover:border-zinc-600 transition">
                      <button onClick={() => setEditingSetIdx(i)}
                        className="w-full p-3 text-left space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-wrap gap-1">
                            {rs.restrictions.map(r => (
                              <span key={r} className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                                r.startsWith('Ban') || r.startsWith('Force') ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
                              }`} title={r}>{restrictionLabels[r]?.en ?? r}</span>
                            ))}
                          </div>
                          <span className="ml-auto text-[10px] text-zinc-600">{rs.recommended.length} rec.</span>
                        </div>
                        {rs.recommended.map((rec, ri) => (
                          <div key={ri} className="text-xs text-zinc-400 pl-2 border-l border-zinc-800">
                            <span className="text-zinc-300">{rec.names.map(n => charMap[n] || n).join(', ') || '(none)'}</span>
                            {rec.reason.en && <span className="ml-2 text-zinc-600">— {parseText(rec.reason.en)}</span>}
                          </div>
                        ))}
                      </button>
                      <div className="flex gap-2 px-3 pb-2">
                        <button onClick={() => duplicateRestrictionSet(selected.key, i)}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition">Duplicate</button>
                        <button onClick={() => deleteRestrictionSet(selected.key, i)}
                          className="text-[10px] text-red-400 hover:text-red-300 transition">Delete</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setAddingSet(true)}
                    className="w-full rounded border border-dashed border-zinc-700 px-4 py-2 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition">
                    + Add Restriction Set
                  </button>
                </>
              )}

              {/* Restriction set editor (randomPool) */}
              {selected.section === 'randomPool' && (editingSetIdx !== null || addingSet) && (
                <RestrictionSetEditor
                  initial={editingSetIdx !== null ? selected.restrictionSets[editingSetIdx] : undefined}
                  characters={characters}
                  charMap={charMap}
                  onSave={(rs) => {
                    if (editingSetIdx !== null) {
                      updateRestrictionSet(selected.key, editingSetIdx, rs);
                    } else {
                      addRestrictionSet(selected.key, rs);
                    }
                    setEditingSetIdx(null);
                    setAddingSet(false);
                  }}
                  onDelete={editingSetIdx !== null ? () => {
                    deleteRestrictionSet(selected.key, editingSetIdx);
                    setEditingSetIdx(null);
                  } : undefined}
                  onCancel={() => { setEditingSetIdx(null); setAddingSet(false); }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Restriction Set Editor ──────────────────────────────────────────

function RestrictionSetEditor({ initial, characters, charMap, onSave, onDelete, onCancel }: {
  initial?: RestrictionSet;
  characters: CharEntry[];
  charMap: Record<string, string>;
  onSave: (rs: RestrictionSet) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [restrictions, setRestrictions] = useState<string[]>(initial?.restrictions ?? []);
  const [recommended, setRecommended] = useState<RecommendedGroup[]>(
    initial?.recommended ?? [{ names: [], reason: { ...EMPTY_LANG } }]
  );

  function toggleRestriction(r: string) {
    setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  function addCharToGroup(groupIdx: number, charId: string) {
    setRecommended(prev => prev.map((g, i) =>
      i === groupIdx && !g.names.includes(charId) ? { ...g, names: [...g.names, charId] } : g
    ));
  }

  function removeCharFromGroup(groupIdx: number, charId: string) {
    setRecommended(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, names: g.names.filter(n => n !== charId) } : g
    ));
  }

  function updateGroupReason(groupIdx: number, reason: Partial<LangText>) {
    setRecommended(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, reason: { ...g.reason, ...reason } } : g
    ));
  }

  function addGroup() {
    setRecommended(prev => [...prev, { names: [], reason: { ...EMPTY_LANG } }]);
  }

  function removeGroup(groupIdx: number) {
    setRecommended(prev => prev.filter((_, i) => i !== groupIdx));
  }

  function handleSave() {
    if (restrictions.length === 0) return;
    onSave({ restrictions, recommended });
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{initial ? 'Edit' : 'New'} Restriction Set</h3>
        <div className="flex-1" />
        {onDelete && (
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">Delete Set</button>
        )}
      </div>

      {/* Restriction picker */}
      <div>
        <label className="text-xs text-zinc-500">Restriction</label>
        <div className="mt-1 space-y-2">
          {RESTRICTION_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[10px] text-zinc-600 mb-1">{group.label}</div>
              <div className="flex flex-wrap gap-1">
                {group.keys.filter(r => r in restrictionLabels).map(r => (
                  <button key={r} onClick={() => toggleRestriction(r)} title={r}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                      restrictions.includes(r)
                        ? group.style === 'ban' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                        : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {restrictionLabels[r]?.en ?? r}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended groups */}
      <div className="space-y-3">
        <label className="text-xs text-zinc-500">Recommended Groups</label>
        {recommended.map((group, gi) => (
          <div key={gi} className="rounded border border-zinc-800 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 uppercase font-semibold">Group {gi + 1}</span>
              <div className="flex-1" />
              {recommended.length > 1 && (
                <button onClick={() => removeGroup(gi)} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
              )}
            </div>

            {/* Characters */}
            <div className="flex flex-wrap gap-1.5">
              {group.names.map(n => (
                <span key={n} className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">
                  {charMap[n] || n}
                  <button onClick={() => removeCharFromGroup(gi, n)} className="text-zinc-500 hover:text-red-400 ml-0.5">x</button>
                </span>
              ))}
              {group.names.length === 0 && <span className="text-xs text-zinc-600">(no characters)</span>}
            </div>
            <CharPicker characters={characters} onSelect={(c) => addCharToGroup(gi, c.id)} />

            {/* Reason */}
            <ReasonInput
              reason={group.reason}
              onChange={(v) => updateGroupReason(gi, v)}
            />
          </div>
        ))}

        <button onClick={addGroup}
          className="w-full rounded border border-dashed border-zinc-700 px-3 py-1.5 text-[10px] text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition">
          + Add Recommended Group
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <button onClick={handleSave} disabled={restrictions.length === 0}
          className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold hover:bg-blue-500 transition disabled:opacity-40">
          Save
        </button>
        <button onClick={onCancel}
          className="rounded border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition">
          Cancel
        </button>
      </div>
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

// ── Character Picker (compact) ──────────────────────────────────────

function CharPicker({ characters, onSelect }: { characters: CharEntry[]; onSelect: (c: CharEntry) => void }) {
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
    return characters.filter(c => c.name.toLowerCase().includes(s) || c.id.includes(s)).slice(0, 20);
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
            <button key={c.id} onClick={() => { onSelect(c); setSearch(''); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition">
              <span className="truncate">{c.name}</span>
              <span className="ml-auto text-zinc-600 font-mono">{c.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

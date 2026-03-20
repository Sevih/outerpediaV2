'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import parseText from '@/app/admin/lib/parse-text-admin';

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

const ALL_RESTRICTIONS = [
  'BanDefender', 'BanStriker', 'BanRanger', 'BanMage', 'BanHealer',
  'BanFire', 'BanWater', 'BanEarth', 'BanLight', 'BanDark',
  'AtLeast1_Defender', 'AtLeast1_Striker', 'AtLeast1_Ranger', 'AtLeast1_Mage', 'AtLeast1_Healer',
  'AtLeast1_Fire', 'AtLeast1_Water', 'AtLeast1_Earth', 'AtLeast1_Light', 'AtLeast1_Dark',
  'AtLeast1_1Star', 'AtLeast1_2Star', 'AtLeast1_3Star',
];

// ── Page ─────────────────────────────────────────────────────────────

export default function TowerEditorPage() {
  const [data, setData] = useState<TowerData | null>(null);
  const [characters, setCharacters] = useState<CharEntry[]>([]);
  const [bossNames, setBossNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBoss, setSelectedBoss] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
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
              <button key={b.key} onClick={() => setSelectedBoss(b.key)}
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

              {/* Existing restriction sets */}
              {selected.restrictionSets.map((rs, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1">
                      {rs.restrictions.map(r => (
                        <span key={r} className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          r.startsWith('Ban') ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
                        }`}>{r}</span>
                      ))}
                    </div>
                    <button onClick={() => deleteRestrictionSet(selected.key, i)}
                      className="ml-auto text-xs text-red-400 hover:text-red-300">Del</button>
                  </div>
                  {rs.recommended.map((rec, ri) => (
                    <div key={ri} className="text-xs text-zinc-400 pl-2 border-l border-zinc-800">
                      <span className="text-zinc-300">{rec.names.map(n => charMap[n] || n).join(', ') || '(none)'}</span>
                      {rec.reason.en && <span className="ml-2 text-zinc-600">— {parseText(rec.reason.en)}</span>}
                    </div>
                  ))}
                </div>
              ))}

              {/* Add new restriction set (randomPool only) */}
              {selected.section === 'randomPool' && (
                <AddRestrictionSet
                  characters={characters}
                  charMap={charMap}
                  onAdd={(rs) => addRestrictionSet(selected.key, rs)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Restriction Set Form ────────────────────────────────────────

function AddRestrictionSet({ characters, charMap, onAdd }: {
  characters: CharEntry[];
  charMap: Record<string, string>;
  onAdd: (rs: RestrictionSet) => void;
}) {
  const [open, setOpen] = useState(false);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [recNames, setRecNames] = useState<string[]>([]);
  const [recReason, setRecReason] = useState('');

  function reset() {
    setRestrictions([]);
    setRecNames([]);
    setRecReason('');
    setOpen(false);
  }

  function handleAdd() {
    if (restrictions.length === 0) return;
    const rs: RestrictionSet = {
      restrictions,
      recommended: [{
        names: recNames,
        reason: { en: recReason, jp: '', kr: '', zh: '' },
      }],
    };
    onAdd(rs);
    reset();
  }

  function toggleRestriction(r: string) {
    setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  function addChar(char: CharEntry) {
    if (!recNames.includes(char.id)) setRecNames(prev => [...prev, char.id]);
  }

  function removeChar(id: string) {
    setRecNames(prev => prev.filter(x => x !== id));
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="rounded border border-dashed border-zinc-700 px-4 py-2 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition w-full">
        + Add Restriction Set
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
      <h3 className="text-sm font-semibold">New Restriction Set</h3>

      {/* Restriction picker */}
      <div>
        <label className="text-xs text-zinc-500">Restrictions</label>
        <div className="mt-1 flex flex-wrap gap-1">
          {ALL_RESTRICTIONS.map(r => (
            <button key={r} onClick={() => toggleRestriction(r)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                restrictions.includes(r)
                  ? r.startsWith('Ban') ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Recommended characters */}
      <div>
        <label className="text-xs text-zinc-500">Recommended Characters</label>
        {recNames.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {recNames.map(id => (
              <span key={id} className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                {charMap[id] || id}
                <button onClick={() => removeChar(id)} className="text-zinc-500 hover:text-red-400">x</button>
              </span>
            ))}
          </div>
        )}
        <CharPicker characters={characters} onSelect={addChar} />
      </div>

      {/* Reason */}
      <div>
        <label className="text-xs text-zinc-500">Reason (EN)</label>
        <input value={recReason} onChange={e => setRecReason(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
          placeholder="e.g. {D/BT_STUN} options" />
      </div>

      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={restrictions.length === 0}
          className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold hover:bg-blue-500 transition disabled:opacity-40">
          Add
        </button>
        <button onClick={reset}
          className="rounded border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition">
          Cancel
        </button>
      </div>
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

'use client';

import { useState, useEffect, useCallback } from 'react';

interface CharacterEntry {
  id: string;
  name: string;
  element: string;
  class: string;
  rarity: number;
  exists: boolean;
}

interface Diff {
  field: string;
  existing: string;
  extracted: string;
}

interface CompareResult {
  total: number;
  withDiffs: number;
  ok: number;
  results: { id: string; name: string; diffs: Diff[] }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any>;

const RANKS = ['SS', 'S', 'A', 'B', 'C'];
const ROLES = ['dps', 'support', 'sustain'];

// ── Diff highlighting ────────────────────────────────────────────────

function DiffHighlight({ existing, extracted }: { existing: string; extracted: string }) {
  const tokenize = (s: string) => s.split(/(\s+|(?=<)|(?<=>))/);
  const aTokens = tokenize(existing);
  const bTokens = tokenize(extracted);

  const max = Math.max(aTokens.length, bTokens.length);
  const aResult: { text: string; type: 'same' | 'del' }[] = [];
  const bResult: { text: string; type: 'same' | 'add' }[] = [];

  let ai = 0, bi = 0;
  while (ai < aTokens.length || bi < bTokens.length) {
    if (ai < aTokens.length && bi < bTokens.length && aTokens[ai] === bTokens[bi]) {
      aResult.push({ text: aTokens[ai], type: 'same' });
      bResult.push({ text: bTokens[bi], type: 'same' });
      ai++; bi++;
    } else {
      let foundA = -1, foundB = -1;
      for (let look = 1; look < Math.min(20, max); look++) {
        if (foundA === -1 && bi + look < bTokens.length && aTokens[ai] === bTokens[bi + look]) foundA = look;
        if (foundB === -1 && ai + look < aTokens.length && aTokens[ai + look] === bTokens[bi]) foundB = look;
        if (foundA !== -1 || foundB !== -1) break;
      }
      if (foundA !== -1 && (foundB === -1 || foundA <= foundB)) {
        for (let j = 0; j < foundA; j++) bResult.push({ text: bTokens[bi++], type: 'add' });
      } else if (foundB !== -1) {
        for (let j = 0; j < foundB; j++) aResult.push({ text: aTokens[ai++], type: 'del' });
      } else {
        if (ai < aTokens.length) aResult.push({ text: aTokens[ai++], type: 'del' });
        if (bi < bTokens.length) bResult.push({ text: bTokens[bi++], type: 'add' });
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded bg-red-950/30 px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-all">
        <span className="mr-1.5 font-semibold text-red-400/70">existing</span>
        {aResult.map((t, i) => (
          <span key={i} className={t.type === 'del' ? 'bg-red-500/30 text-red-200' : 'text-zinc-400'}>{t.text}</span>
        ))}
      </div>
      <div className="rounded bg-green-950/30 px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-all">
        <span className="mr-1.5 font-semibold text-green-400/70">extracted</span>
        {bResult.map((t, i) => (
          <span key={i} className={t.type === 'add' ? 'bg-green-500/30 text-green-200' : 'text-zinc-400'}>{t.text}</span>
        ))}
      </div>
    </div>
  );
}

// ── Diff table (reused in compare-all and per-character) ─────────────

function DiffTable({ diffs }: { diffs: Diff[] }) {
  if (diffs.length === 0) return <p className="text-sm text-green-400">No diffs</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-zinc-500">
          <th className="py-0.5 pr-3 text-left font-medium">Field</th>
          <th className="py-0.5 pr-3 text-left font-medium">Existing</th>
          <th className="py-0.5 text-left font-medium">Extracted</th>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d, i) => {
          const isLongText = d.field.includes('desc_lv') || d.field.startsWith('transcend.');
          if (isLongText) {
            return (
              <tr key={i} className="border-t border-zinc-800/50">
                <td className="py-1 pr-3 font-mono text-zinc-400 whitespace-nowrap align-top">{d.field}</td>
                <td colSpan={2} className="py-1">
                  <DiffHighlight existing={d.existing} extracted={d.extracted} />
                </td>
              </tr>
            );
          }
          return (
            <tr key={i} className="border-t border-zinc-800/50">
              <td className="py-1 pr-3 font-mono text-zinc-400 whitespace-nowrap">{d.field}</td>
              <td className="py-1 pr-3 text-red-300 break-all">{d.existing || <span className="text-zinc-600">null</span>}</td>
              <td className="py-1 text-green-300 break-all">{d.extracted || <span className="text-zinc-600">null</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Character detail panel ───────────────────────────────────────────

function CharacterDetail({ id, name, exists, onSaved }: {
  id: string;
  name: string;
  exists: boolean;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [, setExisting] = useState<AnyData | null>(null);

  // Manual fields
  const [rank, setRank] = useState<string | null>(null);
  const [rankPvp, setRankPvp] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [video, setVideo] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [skillPriority, setSkillPriority] = useState<Record<string, { prio: number }>>({
    First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 },
  });

  // Load data on mount
  useEffect(() => {
    setStatus('loading');
    setError('');
    setSuccess('');
    setDiffs([]);

    const fetchAll = async () => {
      try {
        // Fetch existing character data if it exists
        let existingData: AnyData | null = null;
        if (exists) {
          const charRes = await fetch(`/api/admin/characters/${id}`);
          if (charRes.ok) existingData = await charRes.json();
        }
        setExisting(existingData);

        // Populate manual fields from existing data
        if (existingData) {
          setRank(existingData.rank ?? null);
          setRankPvp(existingData.rank_pvp ?? null);
          setRole(existingData.role ?? null);
          setVideo(existingData.video ?? '');
          setIsFree(existingData.tags?.includes('free') ?? false);
          setSkillPriority(existingData.skill_priority ?? { First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 } });
        } else {
          setRank(null);
          setRankPvp(null);
          setRole(null);
          setVideo('');
          setIsFree(false);
          setSkillPriority({ First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 } });
        }

        // Fetch per-character compare diffs if character exists
        if (exists) {
          const compareRes = await fetch('/api/admin/extractor?action=compare');
          const compareData = await compareRes.json();
          const charDiffs = compareData.results?.find((r: { id: string }) => r.id === id);
          setDiffs(charDiffs?.diffs ?? []);
        }

        setStatus('ready');
      } catch {
        setError('Failed to load data');
        setStatus('error');
      }
    };

    fetchAll();
  }, [id, exists]);

  async function handleSave() {
    setStatus('saving');
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/extractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          manual: {
            rank,
            rank_pvp: rankPvp,
            role,
            isFree,
            skill_priority: skillPriority,
            video: video || undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        setStatus('ready');
      } else {
        setSuccess('Saved!');
        setTimeout(() => setSuccess(''), 2000);
        setStatus('ready');
        onSaved();
      }
    } catch {
      setError('Save failed');
      setStatus('ready');
    }
  }

  if (status === 'loading') {
    return <div className="flex justify-center py-10 text-zinc-500">Loading {name}...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header + save */}
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-zinc-950/80 px-1 py-2 backdrop-blur">
        <h2 className="text-lg font-bold">{name}</h2>
        <span className="font-mono text-sm text-zinc-600">{id}</span>
        {!exists && <span className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400">New</span>}
        <div className="flex-1" />
        {error && <span className="text-sm text-red-400">{error}</span>}
        {success && <span className="text-sm text-green-400">{success}</span>}
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold shadow transition hover:bg-blue-500 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Manual fields */}
      <section className="rounded-lg border border-zinc-800 p-4 space-y-4">
        <h3 className="font-semibold text-zinc-300">Manual Fields</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Rank PvE */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Rank PvE</span>
            <select
              value={rank ?? ''}
              onChange={e => setRank(e.target.value || null)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Rank PvP */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Rank PvP</span>
            <select
              value={rankPvp ?? ''}
              onChange={e => setRankPvp(e.target.value || null)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Role */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Role</span>
            <select
              value={role ?? ''}
              onChange={e => setRole(e.target.value || null)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Video */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Video (YouTube ID)</span>
            <input
              type="text"
              value={video}
              onChange={e => setVideo(e.target.value)}
              placeholder="e.g. PueXtFsRHI0"
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
          </label>

          {/* Free */}
          <label className="flex items-center gap-2 self-end pb-1">
            <input
              type="checkbox"
              checked={isFree}
              onChange={e => setIsFree(e.target.checked)}
              className="rounded border-zinc-700"
            />
            <span className="text-xs text-zinc-500">Free</span>
          </label>
        </div>

        {/* Skill Priority */}
        <div>
          <span className="text-xs text-zinc-500">Skill Priority</span>
          <div className="mt-1 flex gap-4">
            {(['First', 'Second', 'Ultimate'] as const).map(sk => (
              <label key={sk} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{sk}</span>
                <select
                  value={skillPriority[sk]?.prio ?? 1}
                  onChange={e => setSkillPriority(prev => ({
                    ...prev,
                    [sk]: { prio: parseInt(e.target.value) },
                  }))}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {[1, 2, 3].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Diffs */}
      {exists && diffs.length > 0 && (
        <section className="rounded-lg border border-red-900/50 bg-red-950/10 p-4">
          <h3 className="mb-3 font-semibold text-red-400">{diffs.length} diff(s) with existing data</h3>
          <DiffTable diffs={diffs} />
        </section>
      )}

      {exists && diffs.length === 0 && status === 'ready' && (
        <section className="rounded-lg border border-green-900/50 bg-green-950/10 p-4">
          <p className="text-sm text-green-400">Extracted data matches existing — no diffs</p>
        </section>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function ExtractorPage() {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const loadList = useCallback(() => {
    fetch('/api/admin/extractor?action=list')
      .then(r => r.json())
      .then(d => setCharacters(d.characters ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setCompareResult(null);
  }

  async function handleCompare() {
    setComparing(true);
    setCompareResult(null);
    setSelectedId(null);
    try {
      const r = await fetch('/api/admin/extractor?action=compare');
      setCompareResult(await r.json());
    } catch {
      setCompareResult({ total: 0, withDiffs: 0, ok: 0, results: [] });
    } finally {
      setComparing(false);
    }
  }

  const filtered = characters.filter(c => {
    if (filter === 'new' && c.exists) return false;
    if (filter === 'existing' && !c.exists) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.id.includes(s);
    }
    return true;
  });

  const selectedChar = characters.find(c => c.id === selectedId);

  if (loading) {
    return <div className="flex justify-center py-20 text-zinc-500">Loading...</div>;
  }

  // Build diff count map from compare results
  const diffCountMap = new Map<string, number>();
  if (compareResult?.results) {
    for (const r of compareResult.results) {
      diffCountMap.set(r.id, r.diffs.length);
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Left: character list */}
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Extractor</h1>
          <button
            onClick={handleCompare}
            disabled={comparing}
            className="shrink-0 rounded bg-amber-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-amber-500 disabled:opacity-50"
          >
            {comparing ? 'Comparing...' : 'Compare All'}
          </button>
          <span className="text-sm text-zinc-500">{filtered.length} / {characters.length}</span>
        </div>

        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />

        <div className="mb-3 flex gap-1 text-xs">
          {(['all', 'new', 'existing'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 ${filter === f ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {f === 'all' ? 'All' : f === 'new' ? 'New only' : 'Existing'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                selectedId === c.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <span className="w-20 shrink-0 font-mono text-xs text-zinc-600">{c.id}</span>
              <span className="flex-1 truncate font-medium">{c.name}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ui/elem/CM_Element_${c.element}.webp`} alt={c.element} className="size-5" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ui/class/CM_Class_${c.class}.webp`} alt={c.class} className="size-5" />
              <span className="text-xs text-yellow-400">{'★'.repeat(c.rarity)}</span>
              {diffCountMap.has(c.id) && (
                <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">
                  {diffCountMap.get(c.id)}
                </span>
              )}
              {c.exists && !diffCountMap.has(c.id) && compareResult && (
                <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selectedId && !compareResult && !comparing && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Select a character, or Compare All
          </div>
        )}

        {comparing && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Comparing all characters...
          </div>
        )}

        {/* Compare All results */}
        {compareResult && !selectedId && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">Compare Results</h2>
              <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs font-semibold text-green-400">
                {compareResult.ok} OK
              </span>
              <span className="rounded bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-400">
                {compareResult.withDiffs} with diffs
              </span>
              <span className="text-xs text-zinc-500">{compareResult.total} total</span>
              <button onClick={() => setCompareResult(null)} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300">
                Clear
              </button>
            </div>

            {compareResult.results.length === 0 && (
              <p className="text-sm text-green-400">All characters match!</p>
            )}

            {compareResult.results.map(r => (
              <div key={r.id} className="rounded-lg border border-red-900/50 bg-red-950/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600">{r.id}</span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-red-400">{r.diffs.length} diff(s)</span>
                </div>
                <DiffTable diffs={r.diffs} />
              </div>
            ))}
          </div>
        )}

        {/* Character detail panel */}
        {selectedId && selectedChar && (
          <CharacterDetail
            key={selectedId}
            id={selectedId}
            name={selectedChar.name}
            exists={selectedChar.exists}
            onSaved={loadList}
          />
        )}
      </div>
    </div>
  );
}

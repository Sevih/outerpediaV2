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
        {diffs.map((d, i) => (
          <tr key={i} className="border-t border-zinc-800/50">
            <td className="py-1 pr-3 font-mono text-zinc-400 whitespace-nowrap">{d.field}</td>
            <td className="py-1 pr-3 text-red-300 break-all">{d.existing || <span className="text-zinc-600">null</span>}</td>
            <td className="py-1 text-green-300 break-all">{d.extracted || <span className="text-zinc-600">null</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ExtractorV2Page() {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const loadList = useCallback(() => {
    fetch('/api/admin/extractor-v2?action=list')
      .then(r => r.json())
      .then(d => setCharacters(d.characters ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleCompare() {
    setComparing(true);
    setCompareResult(null);
    try {
      const r = await fetch('/api/admin/extractor-v2?action=compare');
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

  const diffCountMap = new Map<string, number>();
  if (compareResult?.results) {
    for (const r of compareResult.results) {
      diffCountMap.set(r.id, r.diffs.length);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-zinc-500">Loading...</div>;
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Left: character list */}
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Extractor v2</h1>
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
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <span className="w-20 shrink-0 font-mono text-xs text-zinc-600">{c.id}</span>
              <span className="flex-1 truncate font-medium">{c.name}</span>
              <span className="text-xs">{c.element}</span>
              <span className="text-xs">{c.class}</span>
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

      {/* Right: compare results */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!compareResult && !comparing && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Click Compare All to start
          </div>
        )}

        {comparing && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Comparing all characters...
          </div>
        )}

        {compareResult && (
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
      </div>
    </div>
  );
}

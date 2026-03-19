'use client';

import { useState, useEffect, useCallback } from 'react';
import { DiffHighlight } from '@/app/admin/components/diff-highlight';
import { LangRow, Section } from '@/app/admin/components/extractor-ui';
import type { DiffEntry } from '@/app/admin/components/extractor-ui';

// ── Types ───────────────────────────────────────────────────────────

interface AccessoryEntry {
  id: string;
  name: string;
  name_jp?: string;
  name_kr?: string;
  name_zh?: string;
  class: string | null;
  image: string;
  effect_name: string | null;
  effect_name_jp?: string;
  effect_name_kr?: string;
  effect_name_zh?: string;
  effect_desc1: string | null;
  effect_desc1_jp?: string;
  effect_desc1_kr?: string;
  effect_desc1_zh?: string;
  effect_desc4: string | null;
  effect_desc4_jp?: string;
  effect_desc4_kr?: string;
  effect_desc4_zh?: string;
  effect_icon: string | null;
  existsInJson: boolean;
}

interface CompareResult {
  id: string;
  name: string;
  diffs: DiffEntry[];
}

const API = '/api/admin/extractor/accessory';

// ── Page ────────────────────────────────────────────────────────────

export default function AccessoryExtractorPage() {
  const [entries, setEntries] = useState<AccessoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<{
    total: number; withDiffs: number; ok: number;
    results: CompareResult[];
  } | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0 });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?action=list`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCompare = useCallback(async (silent = false) => {
    if (!silent) { setComparing(true); setCompareResult(null); setSelectedId(null); }
    try {
      const res = await fetch(`${API}?action=compare`);
      setCompareResult(await res.json());
    } catch {
      setCompareResult({ total: 0, withDiffs: 0, ok: 0, results: [] });
    } finally {
      if (!silent) setComparing(false);
    }
  }, []);

  useEffect(() => { fetchList(); handleCompare(); }, [fetchList, handleCompare]);

  async function handleSaveOne(id: string) {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (data.ok) handleCompare(true);
    return data;
  }

  async function handleExtractAll() {
    if (!entries.length) return;
    if (!confirm(`Extract all ${entries.length} accessories?`)) return;
    setExtracting(true); setExtractProgress({ done: 0, total: entries.length }); setSelectedId(null);
    const ids = entries.map(e => e.id);
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      try { await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: chunk }) }); } catch {}
      setExtractProgress({ done: Math.min(i + 20, ids.length), total: ids.length });
    }
    setExtracting(false); fetchList(); handleCompare();
  }

  const diffCountMap = new Map<string, number>();
  if (compareResult?.results) for (const r of compareResult.results) diffCountMap.set(r.id, r.diffs.length);

  const filtered = entries.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return e.name.toLowerCase().includes(s) || e.id.includes(s) || e.effect_name?.toLowerCase().includes(s);
  });

  if (loading) return <div className="flex justify-center py-10 text-zinc-500">Loading...</div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      <div className="w-80 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={handleExtractAll} disabled={extracting || comparing}
            className="shrink-0 rounded bg-blue-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-blue-500 disabled:opacity-50">
            {extracting ? `${extractProgress.done}/${extractProgress.total}` : 'Extract All'}
          </button>
          <button onClick={() => handleCompare()} disabled={comparing || extracting}
            className="shrink-0 rounded bg-amber-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-amber-500 disabled:opacity-50">
            {comparing ? 'Comparing...' : 'Compare All'}
          </button>
          <span className="text-sm text-zinc-500">{filtered.length} / {entries.length}</span>
        </div>

        <input type="text" placeholder="Search by name, ID or effect..." value={search} onChange={e => setSearch(e.target.value)}
          className="mb-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none" />

        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filtered.map(e => (
            <button key={e.id} onClick={() => setSelectedId(e.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                selectedId === e.id ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}>
              <span className="w-20 shrink-0 font-mono text-xs text-zinc-600">{e.id}</span>
              <span className="flex-1 truncate font-medium">{e.name}</span>
              {diffCountMap.has(e.id) && <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">{diffCountMap.get(e.id)}</span>}
              {e.existsInJson && !diffCountMap.has(e.id) && compareResult && <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>}
              {!e.existsInJson && <span className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-400">New</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selectedId && !compareResult && !comparing && <div className="flex items-center justify-center h-full text-zinc-600">Select an accessory to preview, or Compare All</div>}
        {comparing && <div className="flex items-center justify-center h-full text-zinc-400">Comparing all accessories...</div>}

        {compareResult && !selectedId && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">Compare Results</h2>
              <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs font-semibold text-green-400">{compareResult.ok} OK</span>
              <span className="rounded bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-400">{compareResult.withDiffs} with diffs</span>
              <span className="text-xs text-zinc-500">{compareResult.total} total</span>
            </div>
            {compareResult.results.length === 0 && <p className="text-sm text-green-400">All accessories match!</p>}
            {compareResult.results.map(r => (
              <div key={r.id} className="rounded-lg border border-red-900/50 bg-red-950/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600">{r.id}</span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-red-400">{r.diffs.length} diff(s)</span>
                  <button onClick={() => setSelectedId(r.id)} className="ml-auto text-xs text-blue-400 hover:text-blue-300">Preview</button>
                </div>
                <div className="space-y-2">
                  {r.diffs.map((d, i) => (
                    <div key={i} className="border-t border-zinc-800/50 pt-2">
                      <span className="font-mono text-xs text-zinc-500">{d.field}</span>
                      <DiffHighlight existing={d.existing} extracted={d.extracted} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedId && (() => {
          const entry = entries.find(e => e.id === selectedId);
          if (!entry) return null;
          const diffEntry = compareResult?.results.find(r => r.id === selectedId);
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{entry.name}</h2>
                <span className="font-mono text-sm text-zinc-600">{entry.id}</span>
                {diffEntry ? <span className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400">{diffEntry.diffs.length} diff(s)</span>
                  : entry.existsInJson && compareResult ? <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs text-green-400">OK</span>
                  : !entry.existsInJson ? <span className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400">New</span> : null}
                <div className="flex-1" />
                <button onClick={() => handleSaveOne(selectedId)}
                  className="rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold shadow transition hover:bg-blue-500">Save</button>
              </div>
              {diffEntry && diffEntry.diffs.length > 0 && (
                <div className="space-y-2">
                  {diffEntry.diffs.map((d, i) => (
                    <div key={i} className="rounded-lg border border-zinc-800 p-3">
                      <span className="font-mono text-xs text-zinc-500">{d.field}</span>
                      <DiffHighlight existing={d.existing} extracted={d.extracted} />
                    </div>
                  ))}
                </div>
              )}
              <Section title="Name"><LangRow field="name" data={entry as unknown as Record<string, string>} /></Section>
              <Section title="Effect Name"><LangRow field="effect_name" data={entry as unknown as Record<string, string>} /></Section>
              <Section title="Effect Description (Tier 0)"><LangRow field="effect_desc1" data={entry as unknown as Record<string, string>} /></Section>
              <Section title="Effect Description (Tier 4)"><LangRow field="effect_desc4" data={entry as unknown as Record<string, string>} /></Section>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

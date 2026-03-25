'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DiffHighlight } from '@/app/admin/components/diff-highlight';

interface DiffEntry {
  field: string;
  existing: string;
  extracted: string;
}

interface CompareResult {
  id: string;
  file: string;
  name: string;
  diffs: DiffEntry[];
  notInGame?: boolean;
}

interface ModeEntry {
  total: number;
  ok: number;
  withDiffs: number;
  diffs: string[];
}

const API = '/api/admin/extractor/monster';

export default function BossCompareByModePage() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') ?? '';

  const [loading, setLoading] = useState(true);
  const [modes, setModes] = useState<Record<string, ModeEntry>>({});
  const [selectedMode, setSelectedMode] = useState<string>(initialMode);

  // Detail view for a selected mode
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailResults, setDetailResults] = useState<CompareResult[] | null>(null);
  const [detailOk, setDetailOk] = useState(0);

  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Load mode overview
  useEffect(() => {
    setLoading(true);
    fetch(`${API}?action=compare-by-mode`)
      .then(r => r.json())
      .then(data => { setModes(data.byMode ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Auto-select mode from URL param once loaded
  useEffect(() => {
    if (initialMode && modes[initialMode]) {
      setSelectedMode(initialMode);
    }
  }, [initialMode, modes]);

  // Load detail when mode selected
  const loadDetail = useCallback(async (mode: string) => {
    setSelectedMode(mode);
    setDetailLoading(true);
    setDetailResults(null);
    setSavedIds(new Set());
    try {
      const res = await fetch(`${API}?action=compare`);
      const data = await res.json();
      const results = (data.results ?? []) as CompareResult[];

      // Filter results by mode — we need to read each boss file's mode
      // For now, get all results and let the user see them filtered by name matches
      // A better approach: filter by the diffs list from compare-by-mode
      const modeEntry = modes[mode];
      if (!modeEntry) { setDetailResults([]); setDetailOk(0); return; }

      const diffNames = new Set(modeEntry.diffs);
      const filtered = results.filter(r => diffNames.has(r.name) || diffNames.has(`${r.id} (not in game)`));
      setDetailResults(filtered);
      setDetailOk(modeEntry.ok);
    } catch {
      setDetailResults([]);
    } finally {
      setDetailLoading(false);
    }
  }, [modes]);

  async function handleSaveOne(monsterId: string) {
    setSavingIds(prev => new Set(prev).add(monsterId));
    try {
      const extRes = await fetch(`${API}?action=extract&id=${monsterId}`);
      const extData = await extRes.json();
      if (!extData.extracted) return;
      const saveRes = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: extData.extracted }),
      });
      const saveData = await saveRes.json();
      if (saveData.ok) setSavedIds(prev => new Set(prev).add(monsterId));
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(monsterId); return n; });
    }
  }

  if (loading) return <div className="flex justify-center py-10 text-zinc-500">Loading mode overview...</div>;

  const sortedModes = Object.entries(modes).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Left: mode list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-zinc-800 pr-4 overflow-y-auto">
        {sortedModes.map(([mode, entry]) => (
          <button
            key={mode}
            onClick={() => loadDetail(mode)}
            className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
              selectedMode === mode ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <span className="flex-1 truncate font-medium">{mode}</span>
            <span className="text-xs text-zinc-600">{entry.total}</span>
            {entry.withDiffs > 0
              ? <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">{entry.withDiffs}</span>
              : <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
            }
          </button>
        ))}
      </div>

      {/* Right: detail view */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selectedMode && (
          <div className="flex items-center justify-center h-full text-zinc-600">Select a mode to view diffs</div>
        )}

        {selectedMode && detailLoading && (
          <div className="flex items-center justify-center h-full text-zinc-400">Loading diffs for {selectedMode}...</div>
        )}

        {selectedMode && !detailLoading && detailResults && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">{selectedMode}</h2>
              <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs font-semibold text-green-400">{detailOk} OK</span>
              <span className="rounded bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-400">{detailResults.length} with diffs</span>
            </div>

            {detailResults.length === 0 && <p className="text-sm text-green-400">All bosses in this mode match!</p>}

            {detailResults.map((r, idx) => (
              <div key={`${r.id}-${idx}`} className="rounded-lg border border-red-900/50 bg-red-950/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600">{r.file}</span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-red-400">{r.diffs.length} diff(s)</span>
                  {r.notInGame && <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">not in game</span>}
                  <div className="flex-1" />
                  {!r.notInGame && !savedIds.has(r.id) && (
                    <button
                      onClick={() => handleSaveOne(r.id)}
                      disabled={savingIds.has(r.id)}
                      className="rounded bg-blue-600/80 px-3 py-1 text-xs font-semibold transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      {savingIds.has(r.id) ? 'Saving...' : 'Save'}
                    </button>
                  )}
                  {savedIds.has(r.id) && <span className="text-xs text-green-400">Saved</span>}
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
      </div>
    </div>
  );
}

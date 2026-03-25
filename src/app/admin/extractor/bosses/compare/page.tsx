'use client';

import { useState, useCallback } from 'react';
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

const API = '/api/admin/extractor/monster';

export default function BossComparePage() {
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<{
    total: number; ok: number; withDiffs: number; notFound: number;
    results: CompareResult[];
  } | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleCompare = useCallback(async () => {
    setComparing(true);
    setSavedIds(new Set());
    try {
      const res = await fetch(`${API}?action=compare`);
      setResult(await res.json());
    } catch {
      setResult({ total: 0, ok: 0, withDiffs: 0, notFound: 0, results: [] });
    } finally {
      setComparing(false);
    }
  }, []);

  async function handleSaveOne(monsterId: string) {
    setSavingIds(prev => new Set(prev).add(monsterId));
    try {
      // Handle minion IDs: "414103191S404400150" → id=414103191, parentBossId=404400150
      const sIdx = monsterId.indexOf('S');
      const baseId = sIdx > 0 ? monsterId.slice(0, sIdx) : monsterId;
      const parentBossId = sIdx > 0 ? monsterId.slice(sIdx + 1) : '';
      const params = new URLSearchParams({ action: 'extract', id: baseId });
      if (parentBossId) params.set('parentBossId', parentBossId);
      const extRes = await fetch(`${API}?${params}`);
      const extData = await extRes.json();
      if (!extData.extracted) return;
      const saveRes = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: extData.extracted }),
      });
      const saveData = await saveRes.json();
      if (saveData.ok) {
        setSavedIds(prev => new Set(prev).add(monsterId));
      }
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(monsterId); return n; });
    }
  }

  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ modified: number; total: number } | null>(null);

  async function handleApplyOverrides() {
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch(`${API}?action=apply-overrides`);
      const data = await res.json();
      if (data.ok) setApplyResult({ modified: data.modified, total: data.total });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={handleCompare}
          disabled={comparing || applying}
          className="rounded bg-amber-600/80 px-4 py-2 text-sm font-semibold transition hover:bg-amber-500 disabled:opacity-50"
        >
          {comparing ? 'Comparing...' : 'Compare All Bosses'}
        </button>
        <button
          onClick={handleApplyOverrides}
          disabled={comparing || applying}
          className="rounded bg-purple-600/80 px-4 py-2 text-sm font-semibold transition hover:bg-purple-500 disabled:opacity-50"
        >
          {applying ? 'Applying...' : 'Apply Overrides'}
        </button>
        {applyResult && (
          <span className="text-xs text-purple-400">{applyResult.modified} file(s) modified / {applyResult.total}</span>
        )}
        {result && (
          <>
            <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs font-semibold text-green-400">{result.ok} OK</span>
            <span className="rounded bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-400">{result.withDiffs} with diffs</span>
            {result.notFound > 0 && (
              <span className="rounded bg-zinc-700/50 px-2 py-0.5 text-xs font-semibold text-zinc-400">{result.notFound} not in game data</span>
            )}
            <span className="text-xs text-zinc-500">{result.total} total</span>
          </>
        )}
      </div>

      {comparing && <div className="flex items-center justify-center py-10 text-zinc-400">Comparing all boss files against game data...</div>}

      {result && !comparing && (
        <div className="space-y-3">
          {result.results.length === 0 && result.ok > 0 && (
            <p className="text-sm text-green-400">All bosses match!</p>
          )}
          {result.results.map((r, idx) => (
            <div key={`${r.id}-${idx}`} className={`rounded-lg border p-3 ${r.notInGame ? 'border-zinc-700/50 bg-zinc-900/30' : 'border-red-900/50 bg-red-950/10'}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-600">{r.file}</span>
                <span className="font-semibold">{r.name}</span>
                {r.notInGame
                  ? <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">not in game data</span>
                  : <span className="text-xs text-red-400">{r.diffs.length} diff(s)</span>
                }
                {!r.notInGame && r.diffs.length > 0 && (
                  <button
                    onClick={() => handleSaveOne(r.id.split('-')[0])}
                    disabled={savingIds.has(r.id.split('-')[0]) || savedIds.has(r.id.split('-')[0])}
                    className="ml-auto rounded bg-blue-600/80 px-2.5 py-0.5 text-xs font-semibold transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    {savedIds.has(r.id.split('-')[0]) ? 'Saved' : savingIds.has(r.id.split('-')[0]) ? 'Saving...' : 'Save'}
                  </button>
                )}
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
  );
}

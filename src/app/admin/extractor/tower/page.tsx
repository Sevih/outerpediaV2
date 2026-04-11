'use client';

import { useState, useEffect, useCallback } from 'react';

interface MissingMonster {
  id: string;
  role: 'boss' | 'minion';
  tower: string;
  floor: number;
}

interface ExtractResult {
  id: string;
  status: 'pending' | 'extracting' | 'saving' | 'done' | 'error';
  name?: string;
  error?: string;
}

const API = '/api/admin/extractor-v3/monster';

export default function TowerExtractorPage() {
  const [missing, setMissing] = useState<MissingMonster[]>([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Map<string, ExtractResult>>(new Map());
  const [running, setRunning] = useState(false);
  const [filterTower, setFilterTower] = useState('');

  useEffect(() => {
    fetch('/api/admin/extractor/tower/missing')
      .then(r => r.json())
      .then(data => {
        setMissing(data.missing ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const towers = Array.from(new Set(missing.map(m => m.tower))).sort();
  const filtered = filterTower ? missing.filter(m => m.tower === filterTower) : missing;

  const extractAndSave = useCallback(async (monster: MissingMonster): Promise<ExtractResult> => {
    const result: ExtractResult = { id: monster.id, status: 'extracting' };

    try {
      // Extract
      const extractRes = await fetch(`${API}?action=extract&id=${monster.id}`);
      const extractData = await extractRes.json();

      if (!extractData.extracted) {
        return { id: monster.id, status: 'error', error: extractData.error ?? 'Extraction failed' };
      }

      result.name = extractData.extracted.Name?.en ?? monster.id;
      result.status = 'saving';

      // Save
      const saveRes = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: monster.id, data: extractData.extracted }),
      });
      const saveData = await saveRes.json();

      if (!saveData.ok) {
        return { ...result, status: 'error', error: saveData.error ?? 'Save failed' };
      }

      // Remove from missing-monsters.json
      await fetch(`/api/admin/extractor/tower/missing?id=${monster.id}`, { method: 'DELETE' });

      return { ...result, status: 'done' };
    } catch (e) {
      return { id: monster.id, status: 'error', error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }, []);

  const handleExtractAll = useCallback(async () => {
    setRunning(true);
    const toProcess = filtered.filter(m => {
      const r = results.get(m.id);
      return !r || r.status === 'error';
    });

    for (const monster of toProcess) {
      setResults(prev => new Map(prev).set(monster.id, { id: monster.id, status: 'extracting' }));

      const result = await extractAndSave(monster);

      setResults(prev => new Map(prev).set(monster.id, result));
      if (result.status === 'done') {
        setMissing(prev => prev.filter(m => m.id !== monster.id));
      }
    }
    setRunning(false);
  }, [filtered, results, extractAndSave]);

  const handleExtractOne = useCallback(async (monster: MissingMonster) => {
    setResults(prev => new Map(prev).set(monster.id, { id: monster.id, status: 'extracting' }));
    const result = await extractAndSave(monster);
    setResults(prev => new Map(prev).set(monster.id, result));
    if (result.status === 'done') {
      setMissing(prev => prev.filter(m => m.id !== monster.id));
    }
  }, [extractAndSave]);

  const doneCount = Array.from(results.values()).filter(r => r.status === 'done').length;
  const errorCount = Array.from(results.values()).filter(r => r.status === 'error').length;

  if (loading) return <div className="text-zinc-400 p-8">Loading missing monsters...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Tower — Missing Monsters</h1>
      <p className="text-sm text-zinc-500">
        Monsters referenced in tower data but missing from <code>data/boss/</code>.
        Run <code>python scripts/generate-tower.py</code> to refresh.
      </p>

      <div className="flex items-center gap-3">
        <select
          value={filterTower}
          onChange={e => setFilterTower(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All towers ({missing.length})</option>
          {towers.map(t => (
            <option key={t} value={t}>{t} ({missing.filter(m => m.tower === t).length})</option>
          ))}
        </select>

        <button
          onClick={handleExtractAll}
          disabled={running || filtered.length === 0}
          className="rounded bg-blue-600/80 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500 disabled:opacity-50"
        >
          {running ? 'Extracting...' : `Extract All (${filtered.length})`}
        </button>

        {(doneCount > 0 || errorCount > 0) && (
          <span className="text-sm text-zinc-500">
            {doneCount > 0 && <span className="text-green-400">{doneCount} done</span>}
            {doneCount > 0 && errorCount > 0 && ' · '}
            {errorCount > 0 && <span className="text-red-400">{errorCount} error(s)</span>}
          </span>
        )}
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 border-b border-zinc-800 sticky top-0 bg-zinc-950">
            <tr>
              <th className="py-2 pr-3 w-32">ID</th>
              <th className="py-2 pr-3 w-20">Role</th>
              <th className="py-2 pr-3 w-24">Tower</th>
              <th className="py-2 pr-3 w-20">Floor</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const r = results.get(m.id);
              return (
                <tr key={`${m.id}-${m.tower}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="py-1.5 pr-3 font-mono text-zinc-400">{m.id}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                      m.role === 'boss' ? 'bg-amber-900/30 text-amber-400' : 'bg-zinc-700/50 text-zinc-400'
                    }`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-zinc-500">{m.tower}</td>
                  <td className="py-1.5 pr-3 text-zinc-500">{m.floor}</td>
                  <td className="py-1.5 pr-3">
                    {!r && <span className="text-zinc-600">—</span>}
                    {r?.status === 'extracting' && <span className="text-blue-400">Extracting...</span>}
                    {r?.status === 'saving' && <span className="text-blue-400">Saving...</span>}
                    {r?.status === 'done' && <span className="text-green-400">✓ {r.name}</span>}
                    {r?.status === 'error' && <span className="text-red-400">✗ {r.error}</span>}
                  </td>
                  <td className="py-1.5">
                    <button
                      onClick={() => handleExtractOne(m)}
                      disabled={running || r?.status === 'extracting' || r?.status === 'saving'}
                      className="rounded bg-zinc-700 px-2 py-0.5 text-xs transition hover:bg-zinc-600 disabled:opacity-30"
                    >
                      Extract
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

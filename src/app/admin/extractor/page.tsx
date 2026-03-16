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

type BlockStatus = 'idle' | 'loading' | 'ok' | 'error';

interface Block {
  key: string;
  label: string;
  action: string;
  status: BlockStatus;
  data: unknown;
  error?: string;
}

const BLOCKS_DEF: { key: string; label: string; action: string }[] = [
  { key: 'info', label: 'Base Info', action: 'info' },
  { key: 'skills', label: 'Skills', action: 'skills' },
  { key: 'transcend', label: 'Transcend', action: 'transcend' },
];

const ELEMENT_COLORS: Record<string, string> = {
  Fire: 'text-red-400', Water: 'text-blue-400', Earth: 'text-amber-400',
  Light: 'text-yellow-300', Dark: 'text-purple-400',
};

const STATUS_STYLE: Record<BlockStatus, string> = {
  idle: 'border-zinc-700 bg-zinc-900/50',
  loading: 'border-blue-800 bg-blue-950/30',
  ok: 'border-green-800 bg-green-950/20',
  error: 'border-red-800 bg-red-950/30',
};

const STATUS_BADGE: Record<BlockStatus, { text: string; cls: string }> = {
  idle: { text: '—', cls: 'text-zinc-600' },
  loading: { text: 'loading...', cls: 'text-blue-400' },
  ok: { text: 'OK', cls: 'text-green-400' },
  error: { text: 'ERROR', cls: 'text-red-400' },
};

/** Highlight differences between two strings word-by-word */
function DiffHighlight({ existing, extracted }: { existing: string; extracted: string }) {
  // Split both by words while keeping delimiters
  const tokenize = (s: string) => s.split(/(\s+|(?=<)|(?<=>))/);
  const aTokens = tokenize(existing);
  const bTokens = tokenize(extracted);

  // Simple LCS-based diff
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
      // Look ahead to find next common token
      let foundA = -1, foundB = -1;
      for (let look = 1; look < Math.min(20, max); look++) {
        if (foundA === -1 && bi + look < bTokens.length && aTokens[ai] === bTokens[bi + look]) foundA = look;
        if (foundB === -1 && ai + look < aTokens.length && aTokens[ai + look] === bTokens[bi]) foundB = look;
        if (foundA !== -1 || foundB !== -1) break;
      }

      if (foundA !== -1 && (foundB === -1 || foundA <= foundB)) {
        // b has extra tokens
        for (let j = 0; j < foundA; j++) bResult.push({ text: bTokens[bi++], type: 'add' });
      } else if (foundB !== -1) {
        // a has extra tokens
        for (let j = 0; j < foundB; j++) aResult.push({ text: aTokens[ai++], type: 'del' });
      } else {
        // Both differ
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

interface CompareResult {
  total: number;
  withDiffs: number;
  ok: number;
  results: { id: string; name: string; diffs: { field: string; existing: string; extracted: string }[] }[];
}

export default function ExtractorPage() {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  useEffect(() => {
    fetch('/api/admin/extractor?action=list')
      .then(r => r.json())
      .then(d => setCharacters(d.characters ?? []))
      .finally(() => setLoading(false));
  }, []);

  const fetchBlock = useCallback(async (action: string, id: string) => {
    setBlocks(prev => prev.map(b =>
      b.action === action ? { ...b, status: 'loading', data: null, error: undefined } : b
    ));
    try {
      const r = await fetch(`/api/admin/extractor?action=${action}&id=${id}`);
      const data = await r.json();
      if (!r.ok) {
        setBlocks(prev => prev.map(b =>
          b.action === action ? { ...b, status: 'error', error: data.error ?? 'Request failed' } : b
        ));
      } else {
        setBlocks(prev => prev.map(b =>
          b.action === action ? { ...b, status: 'ok', data } : b
        ));
        setExpanded(prev => new Set(prev).add(action));
      }
    } catch {
      setBlocks(prev => prev.map(b =>
        b.action === action ? { ...b, status: 'error', error: 'Network error' } : b
      ));
    }
  }, []);

  function handleSelect(id: string) {
    setSelectedId(id);
    setExpanded(new Set());
    // Reset all blocks
    const freshBlocks = BLOCKS_DEF.map(d => ({
      ...d,
      status: 'idle' as BlockStatus,
      data: null,
    }));
    setBlocks(freshBlocks);
  }

  function handleExtractAll(id: string) {
    for (const def of BLOCKS_DEF) {
      fetchBlock(def.action, id);
    }
  }

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCompare() {
    setComparing(true);
    setCompareResult(null);
    setSelectedId(null);
    try {
      const r = await fetch('/api/admin/extractor?action=compare');
      const data = await r.json();
      setCompareResult(data);
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

  if (loading) {
    return <div className="flex justify-center py-20 text-zinc-500">Loading...</div>;
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Left: character list */}
      <div className="w-105 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
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
              <span className={`text-xs ${ELEMENT_COLORS[c.element] ?? ''}`}>{c.element}</span>
              <span className="text-xs text-zinc-600">{c.class}</span>
              <span className="text-xs text-yellow-400">{'★'.repeat(c.rarity)}</span>
              {c.exists && (
                <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">exists</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: blocks or compare results */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selectedId && !compareResult && !comparing && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Select a character to extract, or Compare All
          </div>
        )}

        {comparing && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Comparing all characters...
          </div>
        )}

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
              <button
                onClick={() => setCompareResult(null)}
                className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
              >
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
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="py-0.5 pr-3 text-left font-medium">Field</th>
                      <th className="py-0.5 pr-3 text-left font-medium">Existing</th>
                      <th className="py-0.5 text-left font-medium">Extracted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.diffs.map((d, i) => {
                      const isDesc = d.field.includes('desc_lv');
                      if (isDesc) {
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
                          <td className="py-1 pr-3 text-red-300 max-w-xs truncate" title={d.existing}>{d.existing || <span className="text-zinc-600">null</span>}</td>
                          <td className="py-1 text-green-300 max-w-xs truncate" title={d.extracted}>{d.extracted || <span className="text-zinc-600">null</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {selectedId && (
          <div className="space-y-3">
            {/* Header with Extract All button */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">
                {characters.find(c => c.id === selectedId)?.name ?? selectedId}
              </h2>
              <span className="font-mono text-sm text-zinc-600">{selectedId}</span>
              <button
                onClick={() => handleExtractAll(selectedId)}
                className="ml-auto rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold transition hover:bg-blue-500"
              >
                Extract All
              </button>
            </div>

            {/* Block cards */}
            {blocks.map(block => (
              <div
                key={block.key}
                className={`rounded-lg border p-3 transition-colors ${STATUS_STYLE[block.status]}`}
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{block.label}</h3>
                  <span className={`text-xs font-medium ${STATUS_BADGE[block.status].cls}`}>
                    {STATUS_BADGE[block.status].text}
                  </span>

                  {block.status === 'error' && (
                    <span className="text-xs text-red-400">{block.error}</span>
                  )}

                  <div className="ml-auto flex gap-2">
                    {block.status === 'idle' && (
                      <button
                        onClick={() => fetchBlock(block.action, selectedId)}
                        className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium hover:bg-zinc-700"
                      >
                        Fetch
                      </button>
                    )}
                    {block.status === 'error' && (
                      <button
                        onClick={() => fetchBlock(block.action, selectedId)}
                        className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-red-400 hover:bg-zinc-700"
                      >
                        Retry
                      </button>
                    )}
                    {block.status === 'ok' && (
                      <button
                        onClick={() => toggleExpand(block.key)}
                        className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium hover:bg-zinc-700"
                      >
                        {expanded.has(block.key) ? 'Collapse' : 'Expand'}
                      </button>
                    )}
                  </div>
                </div>

                {expanded.has(block.key) && block.data != null && (
                  <pre className="mt-3 max-h-96 overflow-auto rounded bg-black/30 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                    {JSON.stringify(block.data as object, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

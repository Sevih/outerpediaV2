'use client';

import { useState, useEffect, useCallback } from 'react';
import { DiffHighlight } from '@/app/admin/components/diff-highlight';

// ── Types ───────────────────────────────────────────────────────────

interface EEListEntry {
  id: string;
  name: string;
  existsInJson: boolean;
  hasDesc: boolean;
  rank: string;
  rank10: string;
}

interface EEListResponse {
  total: number;
  existing: number;
  new: number;
  entries: EEListEntry[];
}

interface EEExtractedData {
  id: string;
  extracted: Record<string, unknown>;
}

// ── Tabs ────────────────────────────────────────────────────────────

const TABS = [
  { key: 'weapons', label: 'Weapons' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'armors', label: 'Armor Sets' },
  { key: 'talismans', label: 'Talismans' },
  { key: 'ee', label: 'Exclusive Equipment' },
] as const;

type Tab = (typeof TABS)[number]['key'];

// ── EE Panel ────────────────────────────────────────────────────────

function EEPanel() {
  const [list, setList] = useState<EEListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EEExtractedData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Compare all
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<{
    total: number; withDiffs: number; ok: number;
    results: { id: string; name: string; rank: string; rank10: string; diffs: { field: string; existing: string; extracted: string }[] }[];
  } | null>(null);

  // Extract all
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0, errors: 0 });

  const loadList = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch('/api/admin/extractor/ee?action=list')
      .then(r => r.json())
      .then(d => setList(d))
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  const handleCompare = useCallback(async (silent = false) => {
    if (!silent) {
      setComparing(true);
      setCompareResult(null);
      setSelectedId(null);
    }
    try {
      const r = await fetch('/api/admin/extractor/ee?action=compare');
      setCompareResult(await r.json());
    } catch {
      setCompareResult({ total: 0, withDiffs: 0, ok: 0, results: [] });
    } finally {
      if (!silent) setComparing(false);
    }
  }, []);

  useEffect(() => { loadList(); handleCompare(); }, [loadList, handleCompare]);

  function handleSelect(id: string) {
    setSelectedId(id);
    const entry = entries.find(e => e.id === id);
    // If this entry already exists in ee.json, show the diff view (or OK view)
    if (entry?.existsInJson && compareResult) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    // New entry — fetch the extract preview
    setPreviewLoading(true);
    setPreview(null);
    fetch(`/api/admin/extractor/ee?action=extract&id=${id}`)
      .then(r => r.json())
      .then(d => setPreview(d))
      .finally(() => setPreviewLoading(false));
  }

  async function handleSaveOne(id: string, overrides?: { rank?: string; rank10?: string }) {
    const res = await fetch('/api/admin/extractor/ee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...overrides }),
    });
    const data = await res.json();
    if (data.ok) {
      loadList(true);
      handleCompare(true);
    }
    return data;
  }

  async function handleExtractAll() {
    if (!list) return;
    const valid = list.entries.filter(e => e.hasDesc);
    if (!confirm(`Extract ${valid.length} EE? (${list.entries.length - valid.length} without description skipped)`)) return;

    setExtracting(true);
    setExtractProgress({ done: 0, total: valid.length, errors: 0 });
    setSelectedId(null);

    // Send all IDs at once since the API supports batch
    const batch = 20;
    let done = 0;
    let errors = 0;

    for (let i = 0; i < valid.length; i += batch) {
      const chunk = valid.slice(i, i + batch);
      try {
        const res = await fetch('/api/admin/extractor/ee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk.map(e => e.id) }),
        });
        if (!res.ok) errors += chunk.length;
      } catch {
        errors += chunk.length;
      }
      done += chunk.length;
      setExtractProgress({ done, total: valid.length, errors });
    }

    setExtracting(false);
    loadList();
    handleCompare();
  }

  // Build diff count map
  const diffCountMap = new Map<string, number>();
  if (compareResult?.results) {
    for (const r of compareResult.results) {
      diffCountMap.set(r.id, r.diffs.length);
    }
  }

  const entries = [...(list?.entries ?? [])].sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const filtered = entries.filter(e => {
    if (filter === 'new' && e.existsInJson) return false;
    if (filter === 'existing' && !e.existsInJson) return false;
    if (search) {
      const s = search.toLowerCase();
      return e.name.toLowerCase().includes(s) || e.id.includes(s);
    }
    return true;
  });

  if (loading) return <div className="flex justify-center py-10 text-zinc-500">Loading...</div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Left: list */}
      <div className="w-80 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={handleExtractAll}
            disabled={extracting || comparing}
            className="shrink-0 rounded bg-blue-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-blue-500 disabled:opacity-50"
          >
            {extracting ? `${extractProgress.done}/${extractProgress.total}` : 'Extract All'}
          </button>
          <button
            onClick={() => handleCompare()}
            disabled={comparing || extracting}
            className="shrink-0 rounded bg-amber-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-amber-500 disabled:opacity-50"
          >
            {comparing ? 'Comparing...' : 'Compare All'}
          </button>
          <span className="text-sm text-zinc-500">{filtered.length} / {entries.length}</span>
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
              {f === 'all' ? 'All' : f === 'new' ? 'New' : 'Existing'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filtered.map(e => (
            <button
              key={e.id}
              onClick={() => handleSelect(e.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                selectedId === e.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <span className="w-20 shrink-0 font-mono text-xs text-zinc-600">{e.id}</span>
              <span className="flex-1 truncate font-medium">{e.name}</span>
              {diffCountMap.has(e.id) && (
                <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">
                  {diffCountMap.get(e.id)}
                </span>
              )}
              {e.existsInJson && !diffCountMap.has(e.id) && compareResult && (
                <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
              )}
              {!e.existsInJson && (
                <span className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] text-blue-400">New</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: preview / compare results */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selectedId && !compareResult && !comparing && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Select an EE entry to preview, or Compare All
          </div>
        )}

        {comparing && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Comparing all EE...
          </div>
        )}

        {/* Compare results */}
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
              <p className="text-sm text-green-400">All EE match!</p>
            )}

            {compareResult.results.map(r => (
              <div key={r.id} className="rounded-lg border border-red-900/50 bg-red-950/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600">{r.id}</span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-red-400">{r.diffs.length} diff(s)</span>
                  <button
                    onClick={() => handleSelect(r.id)}
                    className="ml-auto text-xs text-blue-400 hover:text-blue-300"
                  >
                    Preview
                  </button>
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

        {previewLoading && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Loading...
          </div>
        )}

        {/* Single EE diff view */}
        {selectedId && !previewLoading && !preview && compareResult && (() => {
          const diffEntry = compareResult.results.find(r => r.id === selectedId);
          const entry = entries.find(e => e.id === selectedId);
          if (!entry) return null;
          return (
            <EEDetailView
              id={selectedId}
              name={diffEntry?.name ?? entry.name}
              diffs={diffEntry?.diffs ?? []}
              rank={diffEntry?.rank ?? entry.rank}
              rank10={diffEntry?.rank10 ?? entry.rank10}
              onSave={(overrides) => handleSaveOne(selectedId, overrides)}
            />
          );
        })()}

        {selectedId && preview && !previewLoading && (
          <EEPreview
            data={preview}
            entry={entries.find(e => e.id === selectedId)!}
            onSave={async () => {
              const result = await handleSaveOne(selectedId);
              return result.ok;
            }}
          />
        )}
      </div>
    </div>
  );
}

const RANK_OPTIONS = ['', 'E', 'D', 'C', 'B', 'A', 'S'];

function RankSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
      >
        {RANK_OPTIONS.map(r => (
          <option key={r} value={r}>{r || '—'}</option>
        ))}
      </select>
    </div>
  );
}

function EEDetailView({ id, name, diffs, rank: initialRank, rank10: initialRank10, onSave }: {
  id: string;
  name: string;
  diffs: { field: string; existing: string; extracted: string }[];
  rank: string;
  rank10: string;
  onSave: (overrides: { rank?: string; rank10?: string }) => Promise<{ ok: boolean }>;
}) {
  const [rank, setRank] = useState(initialRank);
  const [rank10, setRank10] = useState(initialRank10);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Reset when id changes
  useEffect(() => {
    setRank(initialRank);
    setRank10(initialRank10);
    setSuccess('');
  }, [id, initialRank, initialRank10]);

  async function handleSave() {
    setSaving(true);
    const result = await onSave({ rank, rank10 });
    setSaving(false);
    if (result.ok) {
      setSuccess('Saved!');
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold">{name}</h2>
        <span className="font-mono text-sm text-zinc-600">{id}</span>
        {diffs.length > 0 ? (
          <span className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400">{diffs.length} diff(s)</span>
        ) : (
          <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs text-green-400">OK</span>
        )}
        <div className="flex-1" />
        {success && <span className="text-sm text-green-400">{success}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold shadow transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Rank selects */}
      <div className="flex gap-6 rounded-lg border border-zinc-800 p-3">
        <RankSelect label="Rank (base)" value={rank} onChange={setRank} />
        <RankSelect label="Rank (+10)" value={rank10} onChange={setRank10} />
      </div>

      {/* Diffs */}
      {diffs.length > 0 ? (
        <div className="space-y-2">
          {diffs.map((d, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 p-3">
              <span className="font-mono text-xs text-zinc-500">{d.field}</span>
              <DiffHighlight existing={d.existing} extracted={d.extracted} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-green-400">No differences — data is up to date.</p>
      )}
    </div>
  );
}

function EEPreview({ data, entry, onSave }: {
  data: EEExtractedData;
  entry: EEListEntry;
  onSave: () => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    if (ok) {
      setSuccess('Saved!');
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  const ext = data.extracted as Record<string, string>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold">{ext.name || data.id}</h2>
        <span className="font-mono text-sm text-zinc-600">{data.id}</span>
        {!entry.existsInJson && <span className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400">New</span>}
        <div className="flex-1" />
        {success && <span className="text-sm text-green-400">{success}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold shadow transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Extracted data preview */}
      <div className="space-y-3">
        <Section title="Name">
          <LangRow field="name" data={ext} />
        </Section>

        <Section title="Effect (Base)">
          <LangRow field="effect" data={ext} />
        </Section>

        <Section title="Effect (+10)">
          <LangRow field="effect10" data={ext} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

// ── Weapon Panel ─────────────────────────────────────────────────

interface WeaponListEntry {
  id: string;
  name: string;
  class: string;
  star: string;
  effectName: string;
  effectId: string;
  image: string;
  existsInJson: boolean;
  existingKey?: string;
}

interface WeaponCompareResult {
  id: string;
  name: string;
  existingKey: string;
  diffs: { field: string; existing: string; extracted: string }[];
}

function WeaponPanel() {
  const [list, setList] = useState<{ total: number; existing: number; new: number; entries: WeaponListEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<{ total: number; withDiffs: number; ok: number; results: WeaponCompareResult[] } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/extractor/weapon?action=list');
      setList(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleCompare = async () => {
    setComparing(true);
    setStatus('');
    try {
      const res = await fetch('/api/admin/extractor/weapon?action=compare');
      const data = await res.json();
      setCompareResult(data);
    } finally {
      setComparing(false);
    }
  };

  const handleSaveOne = async (weaponId: string, existingKey: string) => {
    setSaving(true);
    setStatus('');
    try {
      const res = await fetch('/api/admin/extractor/weapon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: weaponId, existingKey }),
      });
      const data = await res.json();
      setStatus(data.ok ? `Saved weapon ${weaponId}` : `Error: ${data.error}`);
      await handleCompare();
    } finally {
      setSaving(false);
    }
  };

  const handleExtractAll = async () => {
    if (!list) return;
    setSaving(true);
    setStatus('Extracting all weapons...');
    try {
      const items = list.entries.map(e => ({ id: e.id, existingKey: e.existingKey }));
      const res = await fetch('/api/admin/extractor/weapon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setStatus(data.ok ? `Saved ${data.saved} weapons` : `Error: ${data.error}`);
      await fetchList();
      await handleCompare();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-zinc-500">Loading weapons...</div>;
  if (!list) return <div className="text-red-400">Failed to load weapon list</div>;

  const filtered = list.entries.filter(e => {
    if (filter === 'new' && e.existsInJson) return false;
    if (filter === 'existing' && !e.existsInJson) return false;
    if (classFilter !== 'all' && e.class !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.id.includes(q) || e.effectName.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedDiff = compareResult?.results.find(r => r.id === selectedId);

  return (
    <div className="flex gap-4">
      {/* Left: list */}
      <div className="w-80 shrink-0 space-y-2">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>{list.total} weapons</span>
          <span className="text-green-400">{list.existing} existing</span>
          <span className="text-yellow-400">{list.new} new</span>
        </div>

        <div className="flex gap-1">
          <button onClick={handleCompare} disabled={comparing}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">
            {comparing ? 'Comparing...' : 'Compare All'}
          </button>
          <button onClick={handleExtractAll} disabled={saving}
            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50">
            {saving ? 'Extracting...' : 'Extract All'}
          </button>
        </div>

        {compareResult && (
          <div className="text-xs text-zinc-500">
            Compare Results<br />
            <span className="text-green-400">{compareResult.ok} OK</span>
            <span className="text-yellow-400 ml-2">{compareResult.withDiffs} with diffs</span>
            <span className="ml-2">{compareResult.total} total</span>
          </div>
        )}

        {status && <div className="text-xs text-zinc-400">{status}</div>}

        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, id, effect..."
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300"
        />

        <div className="flex gap-1 text-xs">
          {(['all', 'existing', 'new'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded px-2 py-0.5 ${filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-1 text-xs flex-wrap">
          {['all', 'Striker', 'Defender', 'Ranger', 'Mage', 'Healer'].map(c => (
            <button key={c} onClick={() => setClassFilter(c)}
              className={`rounded px-2 py-0.5 ${classFilter === c ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="max-h-[calc(100vh-300px)] space-y-0.5 overflow-y-auto">
          {filtered.map(e => {
            const hasDiffs = compareResult?.results.some(r => r.id === e.id);
            return (
              <button key={e.id} onClick={() => setSelectedId(e.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors ${
                  selectedId === e.id ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}>
                <span className="w-10 shrink-0 text-xs text-zinc-600">{e.id}</span>
                <span className="flex-1 truncate">{e.name}</span>
                <span className="shrink-0 text-xs text-zinc-600">{e.class?.charAt(0)}</span>
                {!e.existsInJson && <span className="shrink-0 text-xs text-yellow-500">New</span>}
                {hasDiffs && <span className="shrink-0 text-xs text-orange-400">⚠</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: detail */}
      <div className="min-w-0 flex-1">
        {selectedDiff ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{selectedDiff.name}</h2>
                <span className="text-sm text-zinc-500">{selectedDiff.id}</span>
                <span className="rounded bg-orange-600/30 px-2 py-0.5 text-xs text-orange-300">{selectedDiff.diffs.length} diff(s)</span>
              </div>
              <button onClick={() => handleSaveOne(selectedDiff.id, selectedDiff.existingKey)} disabled={saving}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                Save
              </button>
            </div>

            {selectedDiff.diffs.map(d => (
              <div key={d.field} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1">
                <div className="text-xs text-zinc-500 font-mono">{d.field}</div>
                <DiffHighlight existing={d.existing} extracted={d.extracted} />
              </div>
            ))}
          </div>
        ) : selectedId ? (
          <div className="text-zinc-500 text-sm">No diffs for this weapon. Run Compare All first.</div>
        ) : (
          <div className="text-zinc-500 text-sm">Select a weapon to view details.</div>
        )}
      </div>
    </div>
  );
}

function LangRow({ field, data }: { field: string; data: Record<string, string> }) {
  const langs = [
    { key: field, label: 'EN' },
    { key: `${field}_jp`, label: 'JP' },
    { key: `${field}_kr`, label: 'KR' },
    { key: `${field}_zh`, label: 'ZH' },
  ];

  return (
    <div className="space-y-1">
      {langs.map(l => (
        <div key={l.key} className="flex gap-2 text-sm">
          <span className="w-8 shrink-0 text-xs text-zinc-600">{l.label}</span>
          <span className="text-zinc-300">{data[l.key] || <span className="text-zinc-700">—</span>}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function EquipmentExtractorPage() {
  const [tab, setTab] = useState<Tab>('ee');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Equipment Extractor</h1>

      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ee' && <EEPanel />}
      {tab === 'weapons' && <WeaponPanel />}
      {!['ee', 'weapons'].includes(tab) && (
        <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
          {TABS.find(t => t.key === tab)?.label} extractor — coming soon
        </div>
      )}
    </div>
  );
}

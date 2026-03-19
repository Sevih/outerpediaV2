'use client';

import { useState, useEffect, useCallback } from 'react';
import { EffectMultiSelect, type OptionItem } from '@/app/admin/components/effect-select';

// ── Types ───────────────────────────────────────────────────────────

interface EEEntry {
  id: string;
  name: string;
  rank: string;
  rank10: string;
  buff: string[];
  debuff: string[];
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

const RANK_OPTIONS = ['', 'E', 'D', 'C', 'B', 'A', 'S'];

// ── EE Editor Panel ─────────────────────────────────────────────────

function EEEditorPanel() {
  const [entries, setEntries] = useState<EEEntry[]>([]);
  const [options, setOptions] = useState<{ buffs: OptionItem[]; debuffs: OptionItem[] }>({ buffs: [], debuffs: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      fetch('/api/admin/editor/ee').then(r => r.json()),
      fetch('/api/admin/options').then(r => r.json()),
    ]).then(([eeData, opts]) => {
      setEntries(eeData.entries);
      setOptions({ buffs: opts.buffs, debuffs: opts.debuffs });
    }).finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selected = entries.find(e => e.id === selectedId) ?? null;

  const filtered = entries.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return e.name.toLowerCase().includes(s) || e.id.includes(s);
  });

  if (loading) return <div className="flex justify-center py-10 text-zinc-500">Loading...</div>;

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Left: list */}
      <div className="w-80 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-3 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <span className="mb-2 text-xs text-zinc-500">{filtered.length} / {entries.length}</span>
        <div className="overflow-y-auto flex-1 space-y-0.5">
          {filtered.map(e => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                selectedId === e.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <span className="w-20 shrink-0 font-mono text-xs text-zinc-600">{e.id}</span>
              <span className="flex-1 truncate font-medium">{e.name}</span>
              {e.rank && <span className="text-[10px] text-zinc-500">{e.rank}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Right: edit form */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selected && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Select an EE to edit
          </div>
        )}

        {selected && (
          <EEEditForm
            key={selected.id}
            entry={selected}
            options={options}
            onSaved={() => loadData(true)}
          />
        )}
      </div>
    </div>
  );
}

// ── EE Edit Form ────────────────────────────────────────────────────

function EEEditForm({ entry, options, onSaved }: {
  entry: EEEntry;
  options: { buffs: OptionItem[]; debuffs: OptionItem[] };
  onSaved: () => void;
}) {
  const [rank, setRank] = useState(entry.rank);
  const [rank10, setRank10] = useState(entry.rank10);
  const [buff, setBuff] = useState(entry.buff);
  const [debuff, setDebuff] = useState(entry.debuff);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/editor/ee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, rank, rank10, buff, debuff }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Saved!');
        setTimeout(() => setSuccess(''), 3000);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold">{entry.name}</h2>
        <span className="font-mono text-sm text-zinc-600">{entry.id}</span>
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
      <div className="flex gap-6 rounded-lg border border-zinc-800 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Rank (base)</span>
          <select
            value={rank}
            onChange={e => setRank(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
          >
            {RANK_OPTIONS.map(r => <option key={r} value={r}>{r || '—'}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Rank (+10)</span>
          <select
            value={rank10}
            onChange={e => setRank10(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
          >
            {RANK_OPTIONS.map(r => <option key={r} value={r}>{r || '—'}</option>)}
          </select>
        </div>
      </div>

      {/* Buff/Debuff */}
      <div className="rounded-lg border border-zinc-800 p-4 space-y-4">
        <EffectMultiSelect label="Buffs" selected={buff} options={options.buffs} onChange={setBuff} type="buff" />
        <EffectMultiSelect label="Debuffs" selected={debuff} options={options.debuffs} onChange={setDebuff} type="debuff" />
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export default function EquipmentEditorPage() {
  const [tab, setTab] = useState<Tab>('ee');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Equipment Editor</h1>

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

      {tab === 'ee' && <EEEditorPanel />}
      {tab !== 'ee' && (
        <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
          {TABS.find(t => t.key === tab)?.label} editor — coming soon
        </div>
      )}
    </div>
  );
}

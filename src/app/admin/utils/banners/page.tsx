'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

interface Banner {
  id: string;
  name: string;
  start: string;
  end: string;
}

interface CharEntry {
  id: string;
  name: string;
}

const API = '/api/admin/utils/banners';

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [characters, setCharacters] = useState<CharEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  // Edit form state
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');

  const [filter, setFilter] = useState<'all' | 'active' | 'past'>('all');

  useEffect(() => {
    Promise.all([
      fetch(API).then(r => r.json()),
      fetch('/api/admin/utils/characters').then(r => r.json()),
    ]).then(([b, c]) => {
      setBanners(b);
      setCharacters(c);
      setLoading(false);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let list = [...banners].sort((a, b) => b.start.localeCompare(a.start));
    if (filter === 'active') list = list.filter(b => b.start <= today && b.end >= today);
    if (filter === 'past') list = list.filter(b => b.end < today);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(s) || b.id.includes(s));
    }
    return list;
  }, [banners, filter, search, today]);

  function selectCharacter(char: CharEntry) {
    setFormId(char.id);
    setFormName(char.name);
  }

  function startEdit(idx: number) {
    const b = banners[idx];
    setEditIdx(idx);
    setAdding(false);
    setFormId(b.id);
    setFormName(b.name);
    setFormStart(b.start);
    setFormEnd(b.end);
  }

  function startAdd() {
    setEditIdx(null);
    setAdding(true);
    setFormId('');
    setFormName('');
    setFormStart(today);
    setFormEnd('');
  }

  function cancelEdit() {
    setEditIdx(null);
    setAdding(false);
  }

  async function saveEdit() {
    const entry: Banner = {
      id: formId.trim(),
      name: formName.trim(),
      start: formStart,
      end: formEnd,
    };
    if (!entry.id || !entry.name || !entry.end) return;

    let updated: Banner[];
    if (adding) {
      updated = [...banners, entry];
    } else if (editIdx !== null) {
      updated = banners.map((b, i) => i === editIdx ? entry : b);
    } else {
      return;
    }

    setBanners(updated);
    setEditIdx(null);
    setAdding(false);

    // Auto-save
    setSaving(true);
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function deleteBanner(idx: number) {
    setBanners(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
    if (editIdx === idx) cancelEdit();
  }

  async function saveToFile() {
    setSaving(true);
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banners),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-10 text-zinc-500">Loading...</div>;

  const activeCount = banners.filter(b => b.start <= today && b.end >= today).length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Banners</h1>
        <span className="text-sm text-zinc-500">{banners.length} banners ({activeCount} active)</span>
        <div className="flex-1" />
        <button onClick={startAdd}
          className="rounded bg-blue-600/80 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 transition">
          Add Banner
        </button>
        <button onClick={saveToFile} disabled={!dirty || saving}
          className="rounded bg-green-600/80 px-3 py-1.5 text-xs font-semibold hover:bg-green-500 transition disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {(['all', 'active', 'past'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                filter === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
              }`}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Past'}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..."
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs placeholder-zinc-500 focus:border-zinc-500 focus:outline-none" />
      </div>

      {/* Add/Edit form */}
      {(adding || editIdx !== null) && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <h3 className="text-sm font-semibold">{adding ? 'New Banner' : 'Edit Banner'}</h3>

          {/* Character picker */}
          <div>
            <label className="text-xs text-zinc-500">Character</label>
            <CharacterPicker
              characters={characters}
              onSelect={selectCharacter}
              selectedName={formName}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500">Start</label>
              <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">End</label>
              <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none" />
            </div>
          </div>

          {formId && (
            <div className="text-xs text-zinc-500">
              Selected: <span className="text-zinc-300 font-medium">{formName}</span> <span className="font-mono text-zinc-600">({formId})</span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={saveEdit} className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold hover:bg-blue-500 transition">
              {adding ? 'Add' : 'Update'}
            </button>
            <button onClick={cancelEdit} className="rounded border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-24">ID</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Character</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-28">Start</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-28">End</th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 w-20">Status</th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, fi) => {
              const realIdx = banners.indexOf(b);
              const active = b.start <= today && b.end >= today;
              const past = b.end < today;
              return (
                <tr key={`${b.id}-${b.start}-${fi}`} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="px-3 py-2 font-mono text-zinc-500">{b.id}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md">
                        <CharPortrait id={b.id} size={28} />
                      </div>
                      <span className="font-medium text-zinc-200">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-500 tabular-nums">{b.start}</td>
                  <td className="px-3 py-2 text-zinc-500 tabular-nums">{b.end}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      active ? 'bg-green-900/30 text-green-400'
                      : past ? 'bg-zinc-800 text-zinc-600'
                      : 'bg-blue-900/30 text-blue-400'
                    }`}>
                      {active ? 'Active' : past ? 'Past' : 'Upcoming'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => startEdit(realIdx)} className="text-xs text-blue-400 hover:text-blue-300 mr-2">Edit</button>
                    <button onClick={() => deleteBanner(realIdx)} className="text-xs text-red-400 hover:text-red-300">Del</button>
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

// ── Character Picker ────────────────────────────────────────────────

// Face crop positions for characters whose face is lower than default
const CROP_OVERRIDES: Record<string, string> = {
  '2000072': 'center 22%', '2000075': 'center 22%', '2000086': 'center 22%',
  '2000073': 'center 26%', '2000079': 'center 26%', '2000080': 'center 26%',
  '2000081': 'center 26%', '2000084': 'center 26%', '2000100': 'center 26%',
};

function CharPortrait({ id, size = 24 }: { id: string; size?: number }) {
  const pos = CROP_OVERRIDES[id] ?? 'center 18%';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/characters/portrait/CT_${id}.webp`}
      alt=""
      className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900 object-cover"
      style={{ width: size, height: size, objectPosition: pos, transform: 'scale(1.5)', transformOrigin: pos }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

function CharacterPicker({ characters, onSelect, selectedName }: {
  characters: CharEntry[];
  onSelect: (char: CharEntry) => void;
  selectedName: string;
}) {
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
    return characters.filter(c => c.name.toLowerCase().includes(s) || c.id.includes(s)).slice(0, 30);
  }, [characters, search]);

  function select(char: CharEntry) {
    onSelect(char);
    setSearch('');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative mt-1">
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { if (search.trim()) setOpen(true); }}
        placeholder={selectedName || 'Search character...'}
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded border border-zinc-700 bg-zinc-900 shadow-xl">
          {results.map(char => (
            <button
              key={char.id}
              onClick={() => select(char)}
              className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition"
            >
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md">
                <CharPortrait id={char.id} size={28} />
              </div>
              <span className="truncate">{char.name}</span>
              <span className="ml-auto text-zinc-600 font-mono">{char.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

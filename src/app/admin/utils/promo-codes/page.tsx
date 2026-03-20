'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

interface Coupon {
  code: string;
  description: Record<string, string>;
  start: string;
  end: string;
}

interface GameItem {
  id: string;
  name: string;
  icon: string;
  rarity: string;
}

interface RewardEntry {
  name: string;
  qty: string;
}

const API = '/api/admin/utils/coupons';

export default function PromoCodesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [items, setItems] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // Edit form state
  const [formCode, setFormCode] = useState('');
  const [formRewards, setFormRewards] = useState<RewardEntry[]>([]);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');

  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');

  useEffect(() => {
    Promise.all([
      fetch(API).then(r => r.json()),
      fetch('/api/admin/utils/items').then(r => r.json()),
    ]).then(([c, i]) => {
      setCoupons(c);
      setItems(i);
      setLoading(false);
    });
  }, []);

  // Lookup item name → { icon, rarity }
  const itemMap = useMemo(() => {
    const map: Record<string, { icon: string; rarity: string }> = {};
    for (const it of items) if (it.name) map[it.name] = { icon: it.icon, rarity: it.rarity };
    return map;
  }, [items]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const sorted = [...coupons].sort((a, b) => b.start.localeCompare(a.start));
    if (filter === 'active') return sorted.filter(c => c.end >= today);
    if (filter === 'expired') return sorted.filter(c => c.end < today);
    return sorted;
  }, [coupons, filter, today]);

  function descToRewards(desc: Record<string, string>): RewardEntry[] {
    return Object.entries(desc).map(([name, qty]) => ({ name, qty }));
  }

  function rewardsToDesc(rewards: RewardEntry[]): Record<string, string> {
    const desc: Record<string, string> = {};
    for (const r of rewards) {
      if (r.name.trim()) desc[r.name.trim()] = r.qty.trim() || '1';
    }
    return desc;
  }

  function startEdit(idx: number) {
    const c = coupons[idx];
    setEditIdx(idx);
    setAdding(false);
    setFormCode(c.code);
    setFormRewards(descToRewards(c.description));
    setFormStart(c.start);
    setFormEnd(c.end);
  }

  function startAdd() {
    setEditIdx(null);
    setAdding(true);
    setFormCode('');
    setFormRewards([]);
    setFormStart(today);
    setFormEnd('');
  }

  function cancelEdit() {
    setEditIdx(null);
    setAdding(false);
  }

  async function saveEdit() {
    const entry: Coupon = {
      code: formCode.trim(),
      description: rewardsToDesc(formRewards),
      start: formStart,
      end: formEnd,
    };
    if (!entry.code || !entry.end) return;

    let updated: Coupon[];
    if (adding) {
      updated = [...coupons, entry];
    } else if (editIdx !== null) {
      updated = coupons.map((c, i) => i === editIdx ? entry : c);
    } else {
      return;
    }

    setCoupons(updated);
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

  function deleteCoupon(idx: number) {
    setCoupons(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
    if (editIdx === idx) cancelEdit();
  }

  function addReward(name: string) {
    setFormRewards(prev => [...prev, { name, qty: '1' }]);
  }

  function removeReward(idx: number) {
    setFormRewards(prev => prev.filter((_, i) => i !== idx));
  }

  function updateRewardQty(idx: number, qty: string) {
    setFormRewards(prev => prev.map((r, i) => i === idx ? { ...r, qty } : r));
  }

  async function saveToFile() {
    setSaving(true);
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coupons),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-10 text-zinc-500">Loading...</div>;

  const activeCount = coupons.filter(c => c.end >= today).length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Promo Codes</h1>
        <span className="text-sm text-zinc-500">{coupons.length} codes ({activeCount} active)</span>
        <div className="flex-1" />
        <button onClick={startAdd}
          className="rounded bg-blue-600/80 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 transition">
          Add Code
        </button>
        <button onClick={saveToFile} disabled={!dirty || saving}
          className="rounded bg-green-600/80 px-3 py-1.5 text-xs font-semibold hover:bg-green-500 transition disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(['all', 'active', 'expired'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              filter === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Expired'}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {(adding || editIdx !== null) && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <h3 className="text-sm font-semibold">{adding ? 'New Code' : 'Edit Code'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500">Code</label>
              <input value={formCode} onChange={e => setFormCode(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
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
          </div>

          {/* Rewards */}
          <div>
            <label className="text-xs text-zinc-500">Rewards</label>
            <div className="mt-1 space-y-1.5">
              {formRewards.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ItemIcon item={itemMap[r.name]} />
                  <span className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200">{r.name}</span>
                  <input
                    value={r.qty}
                    onChange={e => updateRewardQty(i, e.target.value)}
                    className="w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-center focus:border-zinc-500 focus:outline-none"
                    placeholder="Qty"
                  />
                  <button onClick={() => removeReward(i)} className="text-xs text-red-400 hover:text-red-300 px-1">x</button>
                </div>
              ))}
            </div>
            <ItemPicker items={items} onSelect={addReward} />
          </div>

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
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Rewards</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-24">Start</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-24">End</th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 w-20">Status</th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const realIdx = coupons.indexOf(c);
              const active = c.end >= today;
              return (
                <tr key={`${c.code}-${c.start}`} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="px-3 py-2 font-mono font-semibold text-zinc-200">{c.code}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">
                    {Object.entries(c.description).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <ItemIcon item={itemMap[k]} size={16} />
                        <span>{k}: <span className="text-zinc-300">{v}</span></span>
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 tabular-nums">{c.start}</td>
                  <td className="px-3 py-2 text-zinc-500 tabular-nums">{c.end}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      active ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      {active ? 'Active' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => startEdit(realIdx)} className="text-xs text-blue-400 hover:text-blue-300 mr-2">Edit</button>
                    <button onClick={() => deleteCoupon(realIdx)} className="text-xs text-red-400 hover:text-red-300">Del</button>
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

// ── Item Icon ───────────────────────────────────────────────────────

const RARITY_BG: Record<string, string> = {
  normal: 'Normal',
  superior: 'Magic',
  epic: 'Rare',
  legendary: 'Unique',
};

function ItemIcon({ item, size = 20 }: { item?: { icon: string; rarity: string }; size?: number }) {
  if (!item?.icon) return null;
  const bg = RARITY_BG[item.rarity] ?? 'Normal';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/ui/bg/TI_Slot_${bg}.webp`} alt="" className="absolute inset-0 h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/items/${item.icon}.webp`} alt="" className="absolute inset-0 h-full w-full"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
}

// ── Item Picker ─────────────────────────────────────────────────────

function ItemPicker({ items, onSelect }: { items: GameItem[]; onSelect: (name: string) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    return items.filter(i => i.name.toLowerCase().includes(s)).slice(0, 30);
  }, [items, search]);

  function select(item: GameItem) {
    onSelect(item.name);
    setSearch('');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative mt-2">
      <input
        ref={inputRef}
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { if (search.trim()) setOpen(true); }}
        placeholder="Search item to add..."
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto rounded border border-zinc-700 bg-zinc-900 shadow-xl">
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => select(item)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition"
            >
              <ItemIcon item={item} size={22} />
              <span className="truncate">{item.name}</span>
              <span className="ml-auto text-zinc-600 font-mono">{item.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

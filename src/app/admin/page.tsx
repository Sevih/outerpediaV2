'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// ── Diff check endpoints ────────────────────────────────────────────

interface CompareResult {
  total: number;
  withDiffs: number;
  ok: number;
  results?: { id: string; name: string; diffs: unknown[] }[];
}

interface DiffCheck {
  label: string;
  api: string;
  href: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  result?: CompareResult;
  newCount?: number;
}

interface BossModeEntry {
  total: number;
  ok: number;
  withDiffs: number;
  diffs: { file: string; name: string; notInGame?: boolean }[];
}

const DIFF_CHECKS: Omit<DiffCheck, 'status'>[] = [
  { label: 'Characters', api: '/api/admin/extractor-v3?action=compare', href: '/admin/extractor-v3/characters' },
  { label: 'EE', api: '/api/admin/extractor-v3/ee?action=compare', href: '/admin/extractor-v3/ee' },
  { label: 'Weapons', api: '/api/admin/extractor-v3/equip/weapon?action=compare', href: '/admin/extractor-v3/equip/weapons' },
  { label: 'Accessories', api: '/api/admin/extractor-v3/equip/accessory?action=compare', href: '/admin/extractor-v3/equip/accessories' },
  { label: 'Armor Sets', api: '/api/admin/extractor-v3/equip/armor?action=compare', href: '/admin/extractor-v3/equip/armors' },
  { label: 'Talismans', api: '/api/admin/extractor-v3/equip/talisman?action=compare', href: '/admin/extractor-v3/equip/talismans' },
  { label: 'Items', api: '/api/admin/utils/items-extractor?action=compare', href: '/admin/utils/items-extractor' },
];


// ── Page ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [checks, setChecks] = useState<DiffCheck[]>(
    DIFF_CHECKS.map(c => ({ ...c, status: 'idle' }))
  );
  const [bossStatus, setBossStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [bossModes, setBossModes] = useState<Record<string, BossModeEntry>>({});

  useEffect(() => {
    // Launch boss compare-by-mode
    setBossStatus('loading');
    fetch('/api/admin/extractor-v3/monster?action=compare-by-mode')
      .then(r => r.json())
      .then(data => { setBossModes(data.byMode ?? {}); setBossStatus('done'); })
      .catch(() => setBossStatus('error'));

    // Launch all compare checks in parallel
    DIFF_CHECKS.forEach((check, i) => {
      setChecks(prev => prev.map((c, j) => j === i ? { ...c, status: 'loading' } : c));

      fetch(check.api)
        .then(r => r.json())
        .then((data: CompareResult) => {
          setChecks(prev => prev.map((c, j) =>
            j === i ? { ...c, status: 'done', result: data } : c
          ));
        })
        .catch(() => {
          setChecks(prev => prev.map((c, j) =>
            j === i ? { ...c, status: 'error' } : c
          ));
        });

      // Also fetch list to get new count
      const listApi = check.api.replace('action=compare', 'action=list');
      fetch(listApi)
        .then(r => r.json())
        .then((data: { new?: number }) => {
          if (data.new) {
            setChecks(prev => prev.map((c, j) =>
              j === i ? { ...c, newCount: data.new } : c
            ));
          }
        })
        .catch(() => {});
    });
  }, []);

  const totalDiffs = checks.reduce((sum, c) => sum + (c.result?.withDiffs ?? 0), 0);
  const totalNew = checks.reduce((sum, c) => sum + (c.newCount ?? 0), 0);
  const bossDiffs = Object.values(bossModes).reduce((sum, m) => sum + m.withDiffs, 0);
  const allDone = checks.every(c => c.status === 'done' || c.status === 'error') && bossStatus !== 'loading';

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {!allDone && <span className="text-sm text-zinc-500 animate-pulse">Checking for updates...</span>}
        {allDone && totalDiffs === 0 && totalNew === 0 && bossDiffs === 0 && (
          <span className="rounded bg-green-900/30 px-2.5 py-1 text-xs font-semibold text-green-400">All up to date</span>
        )}
        {allDone && (totalDiffs > 0 || totalNew > 0 || bossDiffs > 0) && (
          <div className="flex gap-2">
            {(totalDiffs + bossDiffs) > 0 && <span className="rounded bg-amber-900/30 px-2.5 py-1 text-xs font-semibold text-amber-400">{totalDiffs + bossDiffs} diff(s)</span>}
            {totalNew > 0 && <span className="rounded bg-blue-900/30 px-2.5 py-1 text-xs font-semibold text-blue-400">{totalNew} new</span>}
          </div>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500 border-b border-zinc-800">
          <tr>
            <th className="py-2 pr-3 font-medium">Category</th>
            <th className="py-2 pr-3 font-medium w-16 text-right">Total</th>
            <th className="py-2 pr-3 font-medium w-14 text-right">OK</th>
            <th className="py-2 pr-3 font-medium w-14 text-right">Diffs</th>
            <th className="py-2 pr-3 font-medium w-14 text-right">New</th>
            <th className="py-2 font-medium w-16 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {checks.map(check => (
            <tr key={check.api} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="py-1.5 pr-3">
                <Link href={check.href as never} className="text-zinc-300 hover:text-blue-400 transition-colors">
                  {check.label}
                </Link>
              </td>
              <td className="py-1.5 pr-3 text-right text-zinc-500">{check.result?.total ?? '—'}</td>
              <td className="py-1.5 pr-3 text-right text-green-500">{check.result?.ok ?? '—'}</td>
              <td className="py-1.5 pr-3 text-right">
                {check.result?.withDiffs ? <span className="text-amber-400">{check.result.withDiffs}</span> : <span className="text-zinc-600">0</span>}
              </td>
              <td className="py-1.5 pr-3 text-right">
                {(check.newCount ?? 0) > 0 ? <span className="text-blue-400">{check.newCount}</span> : <span className="text-zinc-600">0</span>}
              </td>
              <td className="py-1.5 text-right"><StatusBadge check={check} /></td>
            </tr>
          ))}
          {Object.entries(bossModes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mode, entry]) => (
              <tr key={mode} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-1.5 pr-3">
                  <Link
                    href={`/admin/extractor-v3/monster?tab=compare&mode=${encodeURIComponent(mode)}` as never}
                    className="text-zinc-300 hover:text-blue-400 transition-colors"
                  >
                    {mode}
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-right text-zinc-500">{entry.total}</td>
                <td className="py-1.5 pr-3 text-right text-green-500">{entry.ok}</td>
                <td className="py-1.5 pr-3 text-right">
                  {entry.withDiffs > 0 ? <span className="text-amber-400">{entry.withDiffs}</span> : <span className="text-zinc-600">0</span>}
                </td>
                <td className="py-1.5 pr-3 text-right text-zinc-600">—</td>
                <td className="py-1.5 text-right">
                  {entry.withDiffs === 0
                    ? <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
                    : <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-400">updates</span>
                  }
                </td>
              </tr>
            ))}
          {bossStatus === 'loading' && (
            <tr><td colSpan={6} className="py-1.5 text-zinc-600 animate-pulse">Loading boss status...</td></tr>
          )}
          {bossStatus === 'error' && (
            <tr><td colSpan={6} className="py-1.5 text-red-400 text-xs">Failed to load boss status</td></tr>
          )}
        </tbody>
      </table>

    </div>
  );
}

function StatusBadge({ check }: { check: DiffCheck }) {
  if (check.status === 'loading' || check.status === 'idle') {
    return <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />;
  }
  if (check.status === 'error') {
    return <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">error</span>;
  }
  const r = check.result;
  if (!r) return null;
  const hasNew = (check.newCount ?? 0) > 0;
  if (r.withDiffs === 0 && !hasNew) {
    return <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>;
  }
  return <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-400">updates</span>;
}

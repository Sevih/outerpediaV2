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
  { label: 'Characters', api: '/api/admin/extractor?action=compare', href: '/admin/extractor/characters' },
  { label: 'Weapons', api: '/api/admin/extractor/weapon?action=compare', href: '/admin/extractor/equipment/weapons' },
  { label: 'Accessories', api: '/api/admin/extractor/accessory?action=compare', href: '/admin/extractor/equipment/accessories' },
  { label: 'Armor Sets', api: '/api/admin/extractor/armor?action=compare', href: '/admin/extractor/equipment/armors' },
  { label: 'Talismans', api: '/api/admin/extractor/talisman?action=compare', href: '/admin/extractor/equipment/talismans' },
  { label: 'EE', api: '/api/admin/extractor/ee?action=compare', href: '/admin/extractor/equipment/ee' },
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
    fetch('/api/admin/extractor/monster?action=compare-by-mode')
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

      {/* Diff checks grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Extractor Status</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map(check => (
            <Link
              key={check.api}
              href={check.href as never}
              className="rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{check.label}</h3>
                <StatusBadge check={check} />
              </div>

              {check.status === 'done' && check.result && (
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-zinc-500">{check.result.total} total</span>
                  {check.result.ok > 0 && <span className="text-green-500">{check.result.ok} OK</span>}
                  {check.result.withDiffs > 0 && <span className="text-amber-400">{check.result.withDiffs} diff(s)</span>}
                  {(check.newCount ?? 0) > 0 && <span className="text-blue-400">{check.newCount} new</span>}
                </div>
              )}

              {check.status === 'done' && check.result && check.result.withDiffs > 0 && check.result.results && (
                <div className="mt-2 space-y-0.5">
                  {check.result.results.slice(0, 3).map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <span className="truncate text-zinc-400">{r.name}</span>
                      <span className="shrink-0 text-amber-500">{r.diffs.length}</span>
                    </div>
                  ))}
                  {check.result.results.length > 3 && (
                    <span className="text-[10px] text-zinc-600">+{check.result.results.length - 3} more</span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Boss status by mode */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Boss / Monster Status
          {bossStatus === 'loading' && <span className="ml-2 text-zinc-600 animate-pulse">Loading...</span>}
        </h2>
        {bossStatus === 'done' && Object.keys(bossModes).length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(bossModes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([mode, entry]) => (
                <Link
                  key={mode}
                  href={`/admin/extractor/bosses/by-mode?mode=${encodeURIComponent(mode)}` as never}
                  className="rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{mode}</h3>
                    {entry.withDiffs === 0
                      ? <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
                      : <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-400">updates</span>
                    }
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-zinc-500">{entry.total} total</span>
                    {entry.ok > 0 && <span className="text-green-500">{entry.ok} OK</span>}
                    {entry.withDiffs > 0 && <span className="text-amber-400">{entry.withDiffs} diff(s)</span>}
                  </div>
                  {entry.withDiffs > 0 && entry.diffs.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {entry.diffs.slice(0, 3).map((d, i) => (
                        <div key={i} className="text-xs text-zinc-400 truncate">{d.name}</div>
                      ))}
                      {entry.diffs.length > 3 && (
                        <span className="text-[10px] text-zinc-600">+{entry.diffs.length - 3} more</span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
          </div>
        )}
        {bossStatus === 'error' && <span className="text-xs text-red-400">Failed to load boss status</span>}
      </section>

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

'use client';

import type { ReactNode } from 'react';
import { SUFFIX_LANGS } from '@/types/common';

// ── Shared types for extractor API responses ───────────────────────

export interface DiffEntry {
  field: string;
  existing: string;
  extracted: string;
}

export interface CompareResponse<T = unknown> {
  total: number;
  withDiffs: number;
  ok: number;
  results: T[];
}

export interface ListResponse<T = unknown> {
  total: number;
  existing: number;
  new: number;
  entries: T[];
}

// ── LangRow ────────────────────────────────────────────────────────

const LANG_LABELS = [
  { suffix: '', label: 'EN' },
  ...SUFFIX_LANGS.map(l => ({ suffix: `_${l}`, label: l.toUpperCase() })),
];

export function LangRow({ field, data }: { field: string; data: Record<string, string> }) {
  return (
    <div className="space-y-1">
      {LANG_LABELS.map(l => (
        <div key={`${field}${l.suffix}`} className="flex gap-2 text-sm">
          <span className="w-8 shrink-0 text-xs text-zinc-600">{l.label}</span>
          <span className="text-zinc-300">{data[`${field}${l.suffix}`] || <span className="text-zinc-700">—</span>}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

// ── RankSelect ─────────────────────────────────────────────────────

const RANK_OPTIONS = ['', 'E', 'D', 'C', 'B', 'A', 'S'];

export function RankSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

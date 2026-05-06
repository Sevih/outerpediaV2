'use client';

import { useEffect, useMemo, useState } from 'react';

const API = '/api/admin/utils/items-extractor';

const EN_FIELDS = new Set(['name', 'description']);
const LOC_FIELDS = new Set(['name_jp', 'name_kr', 'name_zh', 'description_jp', 'description_kr', 'description_zh']);

interface ItemLite {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  rarity?: string;
  type?: string;
  subtype?: string;
}

interface Diff {
  id: string;
  name: string;
  status: 'new' | 'changed' | 'icon-missing';
  fields?: string[];
  iconMissing?: boolean;
  iconSourceMissing?: boolean;
  current?: ItemLite;
  extracted?: ItemLite;
}

interface CompareResult {
  diffs: Diff[];
  manualCount: number;
  totalExtracted: number;
}

interface ApplyResult {
  applied: number | 'all';
  scope: Scope;
  total: number;
  iconsCopied: number;
  iconsTotal: number;
  warnings: string[];
}

type StatusFilter = 'all' | 'new' | 'changed' | 'icon-missing';
type LangFilter = 'all' | 'en' | 'loc';
type Scope = 'all' | 'en' | 'loc';

/** Returns whether applying this diff under the given scope would actually change anything. */
function wouldApply(diff: Diff, scope: Scope): boolean {
  if (scope === 'all') return true;
  if (diff.status === 'new') return scope === 'en'; // 'loc' skips new items
  if (diff.status === 'icon-missing') return scope === 'en'; // icon goes with EN scope
  // changed
  const c = classifyFields(diff.fields);
  if (scope === 'en') return c.en.length > 0 || c.icon;
  // scope === 'loc'
  return c.loc.length > 0;
}

const RARITY_BG: Record<string, string> = {
  normal: 'Normal',
  superior: 'Magic',
  epic: 'Rare',
  legendary: 'Unique',
};

function classifyFields(fields: string[] | undefined) {
  const en: string[] = [];
  const loc: string[] = [];
  let icon = false;
  for (const f of fields ?? []) {
    if (f === 'icon') icon = true;
    else if (EN_FIELDS.has(f)) en.push(f);
    else if (LOC_FIELDS.has(f)) loc.push(f);
  }
  return { en, loc, icon };
}

export default function ItemsExtractorPage() {
  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingFiltered, setSavingFiltered] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [langFilter, setLangFilter] = useState<LangFilter>('all');
  const [scope, setScope] = useState<Scope>('all');
  const [search, setSearch] = useState('');
  const [lastApply, setLastApply] = useState<ApplyResult | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.diffs;
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (langFilter !== 'all') {
      list = list.filter(d => {
        // Only 'changed' rows have a meaningful EN/loc distinction; hide other statuses when lang is filtered
        if (d.status !== 'changed') return false;
        const c = classifyFields(d.fields);
        if (langFilter === 'en') return c.en.length > 0;
        // langFilter === 'loc'
        return c.loc.length > 0 && c.en.length === 0;
      });
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(d => d.id.includes(s) || d.name.toLowerCase().includes(s));
    }
    return list;
  }, [data, statusFilter, langFilter, search]);

  async function postApply(body: object) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
    return j as ApplyResult;
  }

  async function applyAll() {
    if (!data || data.diffs.length === 0) return;
    setSavingAll(true);
    setError(null);
    try {
      const j = await postApply({ scope });
      setLastApply(j);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingAll(false);
    }
  }

  async function applyFiltered() {
    if (filtered.length === 0) return;
    setSavingFiltered(true);
    setError(null);
    try {
      // Only send ids that the current scope would actually affect
      const ids = filtered.filter(d => wouldApply(d, scope)).map(d => d.id);
      if (ids.length === 0) {
        setError('No visible items would be affected by the current scope.');
        return;
      }
      const j = await postApply({ ids, scope });
      setLastApply(j);
      // Reload to get fresh diffs since fields-only updates may leave the row in a partial state
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingFiltered(false);
    }
  }

  async function applyOne(id: string) {
    setSavingIds(prev => new Set(prev).add(id));
    setError(null);
    try {
      const j = await postApply({ ids: [id], scope });
      setLastApply(j);
      // Partial scope leaves residual diffs (e.g. EN still pending) → reload for accurate state
      if (scope === 'all') {
        setData(prev => prev ? { ...prev, diffs: prev.diffs.filter(d => d.id !== id) } : prev);
      } else {
        await reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  if (loading) return <div className="flex justify-center py-10 text-zinc-500">Loading...</div>;

  if (error && !data) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Items Extractor</h1>
        <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>
        <button onClick={reload} className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700">Retry</button>
      </div>
    );
  }
  if (!data) return null;

  const newCount = data.diffs.filter(d => d.status === 'new').length;
  const changedCount = data.diffs.filter(d => d.status === 'changed').length;
  const iconOnlyCount = data.diffs.filter(d => d.status === 'icon-missing').length;
  const hasChanges = data.diffs.length > 0;
  const anySaving = savingAll || savingFiltered;
  const isFilterActive = statusFilter !== 'all' || langFilter !== 'all' || search.trim() !== '';
  const filteredAffected = filtered.filter(d => wouldApply(d, scope)).length;
  const totalAffected = data.diffs.filter(d => wouldApply(d, scope)).length;
  const scopeColor = scope === 'en' ? 'bg-amber-600/80 hover:bg-amber-500'
    : scope === 'loc' ? 'bg-zinc-600 hover:bg-zinc-500'
    : 'bg-green-600/80 hover:bg-green-500';
  const scopeLabel = scope === 'en' ? 'EN' : scope === 'loc' ? 'Loc' : '';

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Items Extractor</h1>
        <span className="text-sm text-zinc-500">
          {data.totalExtracted} from templet · {data.manualCount} manual preserved
        </span>
        <div className="flex-1" />
        {lastApply && (
          <span className="text-xs text-green-400">
            Applied {lastApply.applied} · icons {lastApply.iconsCopied}/{lastApply.iconsTotal}
          </span>
        )}
        <button onClick={reload} disabled={loading || anySaving}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 transition disabled:opacity-40">
          Reload
        </button>

        {/* Scope selector */}
        <div className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">
          <span className="px-1 text-[10px] uppercase tracking-wider text-zinc-500">Scope</span>
          {(['all', 'en', 'loc'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)} disabled={anySaving}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                scope === s
                  ? s === 'en' ? 'bg-amber-700/60 text-amber-100'
                    : s === 'loc' ? 'bg-zinc-700 text-zinc-100'
                    : 'bg-green-700/60 text-green-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={
                s === 'all' ? 'Overwrite all fields (EN + locales + icon)' :
                s === 'en' ? 'Overwrite only name, description (EN) + icon. Locales preserved.' :
                'Overwrite only locale fields (jp/kr/zh). EN + icon preserved.'
              }>
              {s === 'all' ? 'All' : s === 'en' ? 'EN' : 'Loc'}
            </button>
          ))}
        </div>

        {isFilterActive && (
          <button onClick={applyFiltered} disabled={anySaving || filteredAffected === 0}
            className={`rounded ${scopeColor} px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40`}
            title={`Apply ${scopeLabel || 'all'} fields to currently visible items`}>
            {savingFiltered ? 'Applying...' : `Apply Filtered ${scopeLabel} (${filteredAffected})`.replace(/  +/g, ' ')}
          </button>
        )}
        <button onClick={applyAll} disabled={anySaving || totalAffected === 0}
          className={`rounded ${scopeColor} px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40`}
          title={`Apply ${scopeLabel || 'all'} fields to all diffs`}>
          {savingAll ? 'Applying...' : `Apply All ${scopeLabel} ${totalAffected > 0 ? `(${totalAffected})` : ''}`.replace(/  +/g, ' ').trim()}
        </button>
      </div>

      {error && <div className="rounded border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-300">{error}</div>}
      {lastApply && lastApply.warnings.length > 0 && (
        <div className="rounded border border-amber-900/50 bg-amber-950/20 p-2 text-xs text-amber-300 space-y-0.5">
          <div className="font-semibold">{lastApply.warnings.length} warning(s):</div>
          {lastApply.warnings.slice(0, 5).map((w, i) => <div key={i} className="font-mono">• {w}</div>)}
          {lastApply.warnings.length > 5 && <div>...and {lastApply.warnings.length - 5} more</div>}
        </div>
      )}

      {/* Status badges */}
      <div className="flex gap-2 text-xs flex-wrap">
        {hasChanges ? (
          <>
            {newCount > 0 && <span className="rounded bg-blue-900/30 px-2 py-1 text-blue-400">{newCount} new</span>}
            {changedCount > 0 && <span className="rounded bg-amber-900/30 px-2 py-1 text-amber-400">{changedCount} changed</span>}
            {iconOnlyCount > 0 && <span className="rounded bg-purple-900/30 px-2 py-1 text-purple-400">{iconOnlyCount} icon-missing</span>}
          </>
        ) : (
          <span className="rounded bg-green-900/30 px-2 py-1 text-green-400">All up to date</span>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">Status</span>
        <div className="flex gap-1">
          {(['all', 'new', 'changed', 'icon-missing'] as const).map(f => {
            const count = f === 'all' ? data.diffs.length
              : f === 'new' ? newCount
              : f === 'changed' ? changedCount
              : iconOnlyCount;
            return (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  statusFilter === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                {f === 'all' ? 'All' : f === 'new' ? 'New' : f === 'changed' ? 'Changed' : 'Icon Missing'} ({count})
              </button>
            );
          })}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search id or name..."
          className="ml-auto rounded border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs placeholder-zinc-500 focus:border-zinc-500 focus:outline-none w-56"
        />
      </div>

      {/* Lang filter (only meaningful when looking at changed items) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">Lang</span>
        <div className="flex gap-1">
          {(['all', 'en', 'loc'] as const).map(f => (
            <button key={f} onClick={() => setLangFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                langFilter === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={
                f === 'all' ? 'All changes' :
                f === 'en' ? 'Items where at least one EN field (name/description) changed' :
                'Items where ONLY non-EN locale fields changed'
              }>
              {f === 'all' ? 'All' : f === 'en' ? 'EN affected' : 'Locale only'}
            </button>
          ))}
        </div>
      </div>

      {/* Diff list */}
      {filtered.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          {data.diffs.length === 0 ? 'No differences.' : 'No items match these filters.'}
        </div>
      ) : (
        <div className="overflow-auto rounded border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-20">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-10" />
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 w-24">ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Diff</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <DiffRow
                  key={d.id}
                  diff={d}
                  scope={scope}
                  onApply={() => applyOne(d.id)}
                  isApplying={savingIds.has(d.id)}
                  globalSaving={anySaving}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DiffRow({
  diff, scope, onApply, isApplying, globalSaving,
}: {
  diff: Diff;
  scope: Scope;
  onApply: () => void;
  isApplying: boolean;
  globalSaving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const item = diff.extracted ?? diff.current;
  const rarity = item?.rarity ?? 'normal';
  const bg = RARITY_BG[rarity] ?? 'Normal';
  const sourceMissingNoop = diff.status === 'icon-missing' && diff.iconSourceMissing;
  const wouldDoSomething = wouldApply(diff, scope);
  const disabled = isApplying || globalSaving || sourceMissingNoop || !wouldDoSomething;
  const cls = classifyFields(diff.fields);
  const btnColor = scope === 'en' ? 'bg-amber-700/60 hover:bg-amber-600 text-amber-100'
    : scope === 'loc' ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100'
    : 'bg-green-700/60 hover:bg-green-600 text-green-100';
  const btnLabel = scope === 'en' ? 'EN' : scope === 'loc' ? 'Loc' : 'Apply';
  const btnTitle = !wouldDoSomething ? `Current scope (${scope}) would not affect this item`
    : sourceMissingNoop ? 'Nothing to apply: icon-only diff but source PNG missing'
    : `Apply ${scope} scope to this item`;

  return (
    <>
      <tr className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
        <td className="px-3 py-2">
          {diff.status === 'new' && <span className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">NEW</span>}
          {diff.status === 'changed' && <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">CHG</span>}
          {diff.status === 'icon-missing' && <span className="rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-purple-400">ICON</span>}
        </td>
        <td className="px-3 py-2">
          {item?.icon ? (
            <div className="relative h-6 w-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ui/bg/TI_Slot_${bg}.webp`} alt="" className="absolute inset-0 h-full w-full" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/utils/items-extractor/icon?name=${encodeURIComponent(item.icon)}`} alt="" className="absolute inset-0 h-full w-full"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-zinc-400">{diff.id}</td>
        <td className="px-3 py-2 text-zinc-200">
          {diff.name}
          {/* Show "→ copy" only when there's something to do AND source is available; redundant on 'icon-missing' rows since that's the row's whole point */}
          {diff.iconMissing && !diff.iconSourceMissing && diff.status !== 'icon-missing' && diff.status !== 'new' && (
            <span
              className="ml-2 rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] text-purple-300"
              title="Image absent in public/images/items/ — will be copied from datamine on Apply"
            >
              → copy
            </span>
          )}
          {diff.iconSourceMissing && (
            <span
              className="ml-2 rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-300"
              title="Icon PNG not found in datamine — Apply will skip the icon copy and emit a warning"
            >
              ⚠ no datamine source
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {diff.status === 'new' ? (
            <span className="text-blue-400">added</span>
          ) : diff.status === 'icon-missing' ? (
            <span className="text-purple-400">copy icon only</span>
          ) : (
            <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300">
              {cls.en.length > 0 && (
                <span
                  className="rounded bg-amber-900/40 px-1.5 py-0.5 font-semibold text-amber-300"
                  title={`EN: ${cls.en.join(', ')}`}
                >
                  EN ×{cls.en.length}
                </span>
              )}
              {cls.loc.length > 0 && (
                <span
                  className="rounded bg-zinc-800 px-1.5 py-0.5 font-semibold text-zinc-400"
                  title={`Locale: ${cls.loc.join(', ')}`}
                >
                  loc ×{cls.loc.length}
                </span>
              )}
              {cls.icon && (
                <span className="rounded bg-purple-900/40 px-1.5 py-0.5 font-semibold text-purple-300">icon</span>
              )}
              <span className="ml-1 text-zinc-600">{open ? '▾' : '▸'}</span>
            </button>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            onClick={onApply}
            disabled={disabled}
            className={`rounded ${btnColor} px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed`}
            title={btnTitle}
          >
            {isApplying ? '...' : btnLabel}
          </button>
        </td>
      </tr>
      {open && diff.status === 'changed' && diff.fields && diff.current && diff.extracted && (
        <tr className="border-t border-zinc-800/50 bg-zinc-950/50">
          <td colSpan={6} className="px-3 py-2">
            <div className="space-y-1.5 text-xs">
              {diff.fields.map(f => {
                const isEn = EN_FIELDS.has(f);
                const isLoc = LOC_FIELDS.has(f);
                const labelClass = isEn ? 'text-amber-300 font-semibold' : isLoc ? 'text-zinc-500' : 'text-purple-300';
                return (
                  <div key={f} className="grid grid-cols-[6rem_1fr] gap-2">
                    <span className={`font-mono ${labelClass}`}>{f}</span>
                    <div className="space-y-0.5">
                      <div className="text-red-400/80">- {String((diff.current as unknown as Record<string, unknown>)[f] ?? '')}</div>
                      <div className="text-green-400/80">+ {String((diff.extracted as unknown as Record<string, unknown>)[f] ?? '')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

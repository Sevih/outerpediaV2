'use client';

import { useState, useEffect, useCallback } from 'react';
import { DiffHighlight } from '@/app/admin/components/diff-highlight';

interface CharacterEntry {
  id: string;
  name: string;
  element: string;
  class: string;
  rarity: number;
  exists: boolean;
}

interface Diff {
  field: string;
  existing: string;
  extracted: string;
}

interface CompareResult {
  total: number;
  withDiffs: number;
  ok: number;
  results: { id: string; name: string; diffs: Diff[] }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any>;

const RANKS = ['SS', 'S', 'A', 'B', 'C'];
const ROLES = ['dps', 'support', 'sustain'];


// ── Diff table (reused in compare-all and per-character) ─────────────

function DiffTable({ diffs }: { diffs: Diff[] }) {
  if (diffs.length === 0) return <p className="text-sm text-green-400">No diffs</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-zinc-500">
          <th className="py-0.5 pr-3 text-left font-medium">Field</th>
          <th className="py-0.5 pr-3 text-left font-medium">Existing</th>
          <th className="py-0.5 text-left font-medium">Extracted</th>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d, i) => {
          const isLongText = d.field.includes('desc_lv') || d.field.startsWith('transcend.');
          if (isLongText) {
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
              <td className="py-1 pr-3 text-red-300 break-all">{d.existing || <span className="text-zinc-600">null</span>}</td>
              <td className="py-1 text-green-300 break-all">{d.extracted || <span className="text-zinc-600">null</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Character detail panel ───────────────────────────────────────────

function CharacterDetail({ id, name, rarity, exists, onSaved, initialDiffs }: {
  id: string;
  name: string;
  rarity: number;
  exists: boolean;
  onSaved: () => void;
  initialDiffs?: Diff[];
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [diffs, setDiffs] = useState<Diff[]>(initialDiffs ?? []);
  const [, setExisting] = useState<AnyData | null>(null);
  const [preview, setPreview] = useState<AnyData | null>(null);

  // Manual fields
  const [rank, setRank] = useState<string | null>(null);
  const [rankPvp, setRankPvp] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [video, setVideo] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [rankByTranscend, setRankByTranscend] = useState<Record<string, string> | null>(null);
  const [roleByTranscend, setRoleByTranscend] = useState<Record<string, string> | null>(null);
  const [skillPriority, setSkillPriority] = useState<Record<string, { prio: number }>>({
    First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 },
  });

  // Load data on mount
  useEffect(() => {
    setStatus('loading');
    setError('');
    setSuccess('');
    setDiffs(initialDiffs ?? []);

    const fetchAll = async () => {
      try {
        // Fetch existing character data if it exists
        let existingData: AnyData | null = null;
        if (exists) {
          const charRes = await fetch(`/api/admin/characters/${id}`);
          if (charRes.ok) existingData = await charRes.json();
        }
        setExisting(existingData);

        // Populate manual fields from existing data
        if (existingData) {
          setRank(existingData.rank ?? null);
          setRankPvp(existingData.rank_pvp ?? null);
          setRole(existingData.role ?? null);
          setVideo(existingData.video ?? '');
          setIsFree(existingData.tags?.includes('free') ?? false);
          setIsLimited(existingData.limited === true);
          setRankByTranscend(existingData.rank_by_transcend ?? null);
          setRoleByTranscend(existingData.role_by_transcend ?? null);
          setSkillPriority(existingData.skill_priority ?? { First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 } });
        } else {
          setRank(null);
          setRankPvp(null);
          setRole(null);
          setVideo('');
          setIsFree(false);
          setIsLimited(false);
          setRankByTranscend(null);
          setRoleByTranscend(null);
          setSkillPriority({ First: { prio: 1 }, Second: { prio: 2 }, Ultimate: { prio: 3 } });
        }

        if (exists) {
          // Use initialDiffs if provided, otherwise fetch compare
          if (!initialDiffs) {
            const compareRes = await fetch('/api/admin/extractor?action=compare');
            const compareData = await compareRes.json();
            const charDiffs = compareData.results?.find((r: { id: string }) => r.id === id);
            setDiffs(charDiffs?.diffs ?? []);
          }
        } else {
          // New character: fetch extracted data as preview
          const [infoRes, skillsRes, transcendRes] = await Promise.all([
            fetch(`/api/admin/extractor?action=info&id=${id}`),
            fetch(`/api/admin/extractor?action=skills&id=${id}`),
            fetch(`/api/admin/extractor?action=transcend&id=${id}`),
          ]);
          const info = await infoRes.json();
          const skills = await skillsRes.json();
          const transcend = await transcendRes.json();
          setPreview({ ...info, skills: skills.skills, transcend: transcend.transcend });
        }

        setStatus('ready');
      } catch {
        setError('Failed to load data');
        setStatus('error');
      }
    };

    fetchAll();
  }, [id, exists, initialDiffs]);

  async function handleSave() {
    setStatus('saving');
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/extractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          manual: {
            rank,
            rank_pvp: rarity > 2 ? rankPvp : undefined,
            role,
            isFree,
            isLimited,
            rank_by_transcend: rankByTranscend,
            role_by_transcend: roleByTranscend,
            skill_priority: skillPriority,
            video: video || undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed');
        setStatus('ready');
      } else {
        const img = data.imagesCopied;
        const parts = ['Saved!'];
        if (img) {
          if (img.copied > 0) parts.push(`${img.copied} img copied`);
          if (img.exists > 0) parts.push(`${img.exists} img skipped`);
          if (img.missing > 0) parts.push(`${img.missing} img missing`);
        }
        setSuccess(parts.join(' · '));
        setTimeout(() => setSuccess(''), 4000);
        setStatus('ready');
        onSaved();
      }
    } catch {
      setError('Save failed');
      setStatus('ready');
    }
  }

  if (status === 'loading') {
    return <div className="flex justify-center py-10 text-zinc-500">Loading {name}...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header + save */}
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-zinc-950/80 px-1 py-2 backdrop-blur">
        <h2 className="text-lg font-bold">{name}</h2>
        <span className="font-mono text-sm text-zinc-600">{id}</span>
        {!exists && <span className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400">New</span>}
        <div className="flex-1" />
        {error && <span className="text-sm text-red-400">{error}</span>}
        {success && <span className="text-sm text-green-400">{success}</span>}
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold shadow transition hover:bg-blue-500 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Manual fields */}
      <section className="rounded-lg border border-zinc-800 p-4 space-y-4">
        <h3 className="font-semibold text-zinc-300">Manual Fields</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Rank PvE */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Rank PvE</span>
            <select
              value={rank ?? ''}
              onChange={e => setRank(e.target.value || null)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Rank PvP */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Rank PvP</span>
            <select
              value={rankPvp ?? ''}
              onChange={e => setRankPvp(e.target.value || null)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Role */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Role</span>
            <select
              value={role ?? ''}
              onChange={e => setRole(e.target.value || null)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Video */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Video (YouTube ID)</span>
            <input
              type="text"
              value={video}
              onChange={e => setVideo(e.target.value)}
              placeholder="e.g. PueXtFsRHI0"
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
          </label>

          {/* Free */}
          <label className="flex items-center gap-2 self-end pb-1">
            <input
              type="checkbox"
              checked={isFree}
              onChange={e => setIsFree(e.target.checked)}
              className="rounded border-zinc-700"
            />
            <span className="text-xs text-zinc-500">Free</span>
          </label>

          {/* Limited */}
          <label className="flex items-center gap-2 self-end pb-1">
            <input
              type="checkbox"
              checked={isLimited}
              onChange={e => setIsLimited(e.target.checked)}
              className="rounded border-zinc-700"
            />
            <span className="text-xs text-zinc-500">Limited</span>
          </label>
        </div>

        {/* Skill Priority */}
        <div>
          <span className="text-xs text-zinc-500">Skill Priority</span>
          <div className="mt-1 flex gap-4">
            {(['First', 'Second', 'Ultimate'] as const).map(sk => (
              <label key={sk} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{sk}</span>
                <select
                  value={skillPriority[sk]?.prio ?? 1}
                  onChange={e => setSkillPriority(prev => ({
                    ...prev,
                    [sk]: { prio: parseInt(e.target.value) },
                  }))}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {[1, 2, 3].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>

        {/* Rank/Role by Transcend */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rankByTranscend !== null}
                onChange={e => setRankByTranscend(e.target.checked ? (rankByTranscend ?? {}) : null)}
                className="rounded border-zinc-700"
              />
              <span className="text-xs text-zinc-500">Rank by Transcend</span>
            </label>
            {rankByTranscend !== null && (
              <div className="mt-1 flex gap-2 flex-wrap">
                {['3','4','5','6'].map(star => (
                  <label key={star} className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400">★{star}</span>
                    <select
                      value={rankByTranscend[star] ?? ''}
                      onChange={e => setRankByTranscend(prev => {
                        const next = { ...(prev ?? {}) };
                        if (e.target.value) next[star] = e.target.value;
                        else delete next[star];
                        return next;
                      })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">—</option>
                      {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={roleByTranscend !== null}
                onChange={e => setRoleByTranscend(e.target.checked ? (roleByTranscend ?? {}) : null)}
                className="rounded border-zinc-700"
              />
              <span className="text-xs text-zinc-500">Role by Transcend</span>
            </label>
            {roleByTranscend !== null && (
              <div className="mt-1 flex gap-2 flex-wrap">
                {['3','4','5','6'].map(star => (
                  <label key={star} className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400">★{star}</span>
                    <select
                      value={roleByTranscend[star] ?? ''}
                      onChange={e => setRoleByTranscend(prev => {
                        const next = { ...(prev ?? {}) };
                        if (e.target.value) next[star] = e.target.value;
                        else delete next[star];
                        return next;
                      })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">—</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Diffs */}
      {exists && diffs.length > 0 && (
        <section className="rounded-lg border border-red-900/50 bg-red-950/10 p-4">
          <h3 className="mb-3 font-semibold text-red-400">{diffs.length} diff(s) with existing data</h3>
          <DiffTable diffs={diffs} />
        </section>
      )}

      {exists && diffs.length === 0 && status === 'ready' && (
        <section className="rounded-lg border border-green-900/50 bg-green-950/10 p-4">
          <p className="text-sm text-green-400">Extracted data matches existing — no diffs</p>
        </section>
      )}

      {/* Preview for new characters */}
      {!exists && preview && status === 'ready' && (
        <section className="rounded-lg border border-blue-900/50 bg-blue-950/10 p-4 space-y-4">
          <h3 className="font-semibold text-blue-400">Extracted Data Preview</h3>

          {/* Info */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase">Info</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {['Fullname', 'Rarity', 'Element', 'Class', 'SubClass', 'Chain_Type', 'gift'].map(k => (
                preview[k] != null && <div key={k}>
                  <span className="text-zinc-500">{k}: </span>
                  <span className="text-zinc-200">{String(preview[k])}</span>
                </div>
              ))}
              {preview.tags?.length > 0 && <div>
                <span className="text-zinc-500">tags: </span>
                <span className="text-zinc-200">{preview.tags.join(', ')}</span>
              </div>}
            </div>
          </div>

          {/* Voice Actors */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase">Voice Actors</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              {['VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh'].map(k => (
                preview[k] && <div key={k}>
                  <span className="text-zinc-500">{k.replace('VoiceActor', 'VA')}: </span>
                  <span className="text-zinc-200">{preview[k]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          {preview.skills && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase">Skills</h4>
              {Object.entries(preview.skills).map(([sk, data]) => {
                const s = data as AnyData;
                return (
                  <div key={sk} className="rounded border border-zinc-800 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">{sk}</span>
                      <span className="font-semibold text-sm text-zinc-200">{s.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
                      {s.wgr != null && <div><span className="text-zinc-500">wgr:</span> {s.wgr}</div>}
                      {s.cd != null && <div><span className="text-zinc-500">cd:</span> {s.cd}</div>}
                      {s.offensive != null && <div><span className="text-zinc-500">offensive:</span> {String(s.offensive)}</div>}
                      {s.target != null && <div><span className="text-zinc-500">target:</span> {String(s.target)}</div>}
                    </div>
                    {s.buff?.length > 0 && (
                      <div className="text-xs"><span className="text-green-500">buff:</span> <span className="text-zinc-300">{s.buff.join(', ')}</span></div>
                    )}
                    {s.debuff?.length > 0 && (
                      <div className="text-xs"><span className="text-red-400">debuff:</span> <span className="text-zinc-300">{s.debuff.join(', ')}</span></div>
                    )}
                    {s.burnEffect && Object.keys(s.burnEffect).length > 0 && (
                      <div className="text-xs"><span className="text-amber-400">burst:</span> <span className="text-zinc-300">{Object.keys(s.burnEffect).join(', ')}</span></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Transcend */}
          {preview.transcend && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase">Transcend</h4>
              <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                {Object.entries(preview.transcend)
                  .filter(([k]) => !k.includes('_'))
                  .map(([k, v]) => (
                    <div key={k} className="rounded border border-zinc-800 p-2">
                      <span className="font-mono text-zinc-500">{k}: </span>
                      <span className="text-zinc-300 whitespace-pre-line">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function ExtractorPage() {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0, errors: 0 });

  const loadList = useCallback(() => {
    fetch('/api/admin/extractor?action=list')
      .then(r => r.json())
      .then(d => setCharacters(d.characters ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadList();
    handleCompare();
  }, [loadList]);

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  async function handleCompare() {
    setComparing(true);
    setCompareResult(null);
    setSelectedId(null);
    try {
      const r = await fetch('/api/admin/extractor?action=compare');
      setCompareResult(await r.json());
    } catch {
      setCompareResult({ total: 0, withDiffs: 0, ok: 0, results: [] });
    } finally {
      setComparing(false);
    }
  }

  async function handleExtractAll() {
    // Skip incomplete characters (name not resolved = placeholder like "2000112_Name")
    const valid = characters.filter(c => !c.name.includes('_Name'));
    if (!confirm(`Extract ${valid.length} characters? (${characters.length - valid.length} incomplete skipped)`)) return;
    setExtracting(true);
    setExtractProgress({ done: 0, total: valid.length, errors: 0 });
    setSelectedId(null);
    setCompareResult(null);

    let done = 0;
    let errors = 0;
    // Process in batches of 5 to avoid overwhelming the server
    const batch = 5;
    for (let i = 0; i < valid.length; i += batch) {
      const chunk = valid.slice(i, i + batch);
      const results = await Promise.allSettled(
        chunk.map(c =>
          fetch('/api/admin/extractor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: c.id, manual: {} }),
          }).then(r => { if (!r.ok) throw new Error(); })
        )
      );
      done += chunk.length;
      errors += results.filter(r => r.status === 'rejected').length;
      setExtractProgress({ done, total: valid.length, errors });
    }

    setExtracting(false);
    loadList();
    handleCompare();
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

  const selectedChar = characters.find(c => c.id === selectedId);

  if (loading) {
    return <div className="flex justify-center py-20 text-zinc-500">Loading...</div>;
  }

  // Build diff count map from compare results
  const diffCountMap = new Map<string, number>();
  if (compareResult?.results) {
    for (const r of compareResult.results) {
      diffCountMap.set(r.id, r.diffs.length);
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Left: character list */}
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-800 pr-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Extractor</h1>
          <button
            onClick={handleExtractAll}
            disabled={extracting || comparing}
            className="shrink-0 rounded bg-blue-600/80 px-2.5 py-1 text-xs font-semibold transition hover:bg-blue-500 disabled:opacity-50"
          >
            {extracting ? `${extractProgress.done}/${extractProgress.total}` : 'Extract All'}
          </button>
          <button
            onClick={handleCompare}
            disabled={comparing || extracting}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ui/elem/CM_Element_${c.element}.webp`} alt={c.element} className="size-5" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/ui/class/CM_Class_${c.class}.webp`} alt={c.class} className="size-5" />
              <span className="text-xs text-yellow-400">{'★'.repeat(c.rarity)}</span>
              {diffCountMap.has(c.id) && (
                <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400">
                  {diffCountMap.get(c.id)}
                </span>
              )}
              {c.exists && !diffCountMap.has(c.id) && compareResult && (
                <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">OK</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {!selectedId && !compareResult && !comparing && (
          <div className="flex items-center justify-center h-full text-zinc-600">
            Select a character, or Compare All
          </div>
        )}

        {comparing && (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Comparing all characters...
          </div>
        )}

        {/* Compare All results */}
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
              <p className="text-sm text-green-400">All characters match!</p>
            )}

            {compareResult.results.map(r => (
              <div key={r.id} className="rounded-lg border border-red-900/50 bg-red-950/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600">{r.id}</span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-red-400">{r.diffs.length} diff(s)</span>
                </div>
                <DiffTable diffs={r.diffs} />
              </div>
            ))}
          </div>
        )}

        {/* Character detail panel */}
        {selectedId && selectedChar && (
          <CharacterDetail
            key={selectedId}
            id={selectedId}
            name={selectedChar.name}
            rarity={selectedChar.rarity}
            exists={selectedChar.exists}
            onSaved={loadList}
            initialDiffs={compareResult?.results?.find(r => r.id === selectedId)?.diffs}
          />
        )}
      </div>
    </div>
  );
}

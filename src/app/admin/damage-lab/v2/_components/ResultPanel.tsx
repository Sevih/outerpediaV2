'use client'

import { useState } from 'react'
import type { RecomputeContext, RecomputeResult } from '@/lib/damage/v2/recompute'
import type { ApplicableBuff } from '@/lib/damage/v2/buffs'
import { formatEffectText } from '@/lib/format-text'

interface ResultPanelProps {
  result: RecomputeResult | null
  ctx: RecomputeContext | null
  showDebug: boolean
  onToggleDebug: (on: boolean) => void
  onSaveObs: (input: { observed: number; note?: string }) => Promise<void> | void
  /** charId → display name, used to label char-skill buffs in the debug list. */
  charNameById?: Map<string, string>
}

export function ResultPanel({ result, ctx, showDebug, onToggleDebug, onSaveObs, charNameById }: ResultPanelProps) {
  const [observed, setObserved] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const obsNum = parseFloat(observed)
  const canSave = !!result && !!ctx && Number.isFinite(obsNum) && obsNum > 0

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Result</h2>
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-zinc-500">
          <input
            type="checkbox"
            checked={showDebug}
            onChange={e => onToggleDebug(e.target.checked)}
            className="h-3 w-3 rounded border-zinc-700 bg-zinc-800"
          />
          show debug
        </label>
      </div>

      {result == null && (
        <div className="rounded bg-zinc-950 p-2 text-xs text-zinc-500">
          Pick a caster and target to see the computed damage.
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Computed</div>
            <div className="text-3xl font-bold tabular-nums text-zinc-100">
              {formatInt(result.calculated)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Main"        value={Math.floor(result.breakdown.mainCalc)} />
            <Stat label="Additional"  value={Math.floor(result.breakdown.additionalCalc)} />
            <Stat label="Pool %"       value={result.breakdown.poolPct.toFixed(1)} />
          </div>

          {showDebug && (
            <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2 text-[11px]">
              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                <KV k="rate (post-cap)"  v={result.breakdown.rate.toFixed(4)} />
                <KV k="rate raw"          v={result.breakdown.rateRaw.toFixed(4)} />
                <KV k="mitigation"        v={result.breakdown.mitigation.toFixed(4)} />
                <KV k="elemMult"          v={result.breakdown.elemMult.toFixed(3)} />
              </div>

              {result.breakdown.quirks.length > 0 && (
                <div>
                  <div className="mb-0.5 text-[10px] font-semibold uppercase text-zinc-500">Quirks</div>
                  <ul className="space-y-0.5">
                    {result.breakdown.quirks.map((q, i) => (
                      <li key={i} className="text-zinc-400">
                        <span className="text-zinc-300">{q.name}</span>: {q.value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.reduced.active.length > 0 && (() => {
                const aggregated = aggregateActiveBuffs(result.reduced.active, charNameById)
                return (
                  <div>
                    <div className="mb-0.5 text-[10px] font-semibold uppercase text-zinc-500">
                      Active buffs ({aggregated.length}
                      {aggregated.length !== result.reduced.active.length && (
                        <span className="text-zinc-600"> / {result.reduced.active.length} raw</span>
                      )})
                    </div>
                    <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                      {aggregated.map(g => (
                        <li key={g.key} className="wrap-break-word text-zinc-400" title={g.ids.join('\n')}>
                          <span className="text-zinc-300">{formatEffectText(g.label)}</span>
                          {g.count > 1 && <span className="text-zinc-600"> ×{g.count}</span>}
                          {' '}— {g.target}: {formatNumberWithUnit(g.amount, g.unit)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}

              {result.breakdown.debugSteps.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase text-zinc-500">
                    f32 trace ({result.breakdown.debugSteps.length} steps)
                  </summary>
                  <ul className="mt-1 max-h-48 overflow-y-auto font-mono">
                    {result.breakdown.debugSteps.map((s, i) => (
                      <li key={i} className="text-zinc-500">
                        <span className="text-zinc-300">{s.label}</span>
                        {' = '}<span className="text-amber-300">{s.value}</span>
                        {s.note && <span className="text-zinc-600"> — {s.note}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="space-y-1 border-t border-zinc-800 pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Save observation
            </div>
            <input
              type="number"
              placeholder="observed value"
              value={observed}
              onChange={e => setObserved(e.target.value)}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              suppressHydrationWarning
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="note (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              suppressHydrationWarning
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={async () => {
                if (!canSave) return
                setSaving(true)
                try {
                  await onSaveObs({ observed: obsNum, note: note.trim() || undefined })
                  setObserved('')
                  setNote('')
                } finally {
                  setSaving(false)
                }
              }}
              className="w-full rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              {saving ? 'Saving…' : 'Save observation'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Local primitives ─────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-semibold tabular-nums text-zinc-100">
        {typeof value === 'number' ? formatInt(value) : value}
      </div>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-zinc-500">{k}: </span>
      <span className="font-mono text-zinc-200">{v}</span>
    </div>
  )
}

function formatInt(n: number): string {
  return n.toLocaleString('en-US').replace(/,/g, ' ')
}

/**
 * Human-friendly label for an active buff:
 *   - Awakening rows: strip the verbose "<Group> <Tier> Node:" prefix and
 *     prepend a uniform "Quirk - " marker. Color tags survive — the JSX site
 *     runs the result through `formatEffectText` which renders them inline.
 *   - Char-skill rows: "{Char Name} · S{slot}".
 *   - Fallback: the raw `id` (shown via tooltip in any case for traceability).
 */
function formatBuffLabel(b: ApplicableBuff, charNameById?: Map<string, string>): string {
  if (b.ui?.name) {
    const m = b.ui.name.match(/Node:\s*(.+)$/)
    return `Quirk - ${m ? m[1].trim() : b.ui.name}`
  }
  if (b.source.kind === 'char_skill') {
    const name = charNameById?.get(b.source.charId) ?? b.source.charId
    return `${name} · S${b.source.skillSlot}`
  }
  return b.id
}

/** "pool", "pool_cond[enemy_team_decrease]", "monster_res", … — drops the verbose target_ prefix. */
function formatEffectTarget(b: ApplicableBuff): string {
  if (b.effect.target === 'pool_cond' && b.effect.poolCond) {
    return `pool[${b.effect.poolCond}]`
  }
  return b.effect.target
}

/** Append unit (% / ‰ / nothing) to a number. */
function formatNumberWithUnit(amount: number, unit: string): string {
  const suffix = unit === 'permille' ? '‰' : unit === '%' ? '%' : ''
  return `${amount}${suffix}`
}

interface AggregatedBuff {
  key: string
  label: string
  target: string
  unit: string
  amount: number
  count: number
  /** Underlying buff ids (multi-line tooltip). */
  ids: string[]
}

/**
 * Collapse rows that share the same (label, target). Multiple awakening
 * nodes often expose the same effect at different tiers — surfacing each
 * separately is noise; the operator wants to see the net contribution.
 *
 * Char-skill labels include `· S{n}` so they don't merge with awakenings.
 */
function aggregateActiveBuffs(buffs: ApplicableBuff[], charNameById?: Map<string, string>): AggregatedBuff[] {
  const groups = new Map<string, AggregatedBuff>()
  for (const b of buffs) {
    const label = formatBuffLabel(b, charNameById)
    const target = formatEffectTarget(b)
    const key = `${label}|${target}`
    const g = groups.get(key)
    if (g) {
      g.amount += b.effect.amount
      g.count += 1
      g.ids.push(b.id)
    } else {
      groups.set(key, { key, label, target, unit: b.effect.unit, amount: b.effect.amount, count: 1, ids: [b.id] })
    }
  }
  return Array.from(groups.values())
}

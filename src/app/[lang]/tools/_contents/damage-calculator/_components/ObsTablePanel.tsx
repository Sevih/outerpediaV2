'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { ApplicableBuff } from '@/lib/damage/v2/buffs'
import type {
  DamageCalcAwakeningBuffs,
  DamageCalcCharBuffs,
  DamageCalcCharSummary,
} from '@/lib/data/damage-calc'
import { fetchCharBuffs } from '../_lib/fetch-data'
import { recomputeFromObs, type ObservationV2 } from '../_lib/observations'

/**
 * Dev-only — divergence table between the public calc's `recompute()` output
 * and the admin Damage Lab v2's recorded observations. Picks up the JSONL
 * file via the server component (gated on NODE_ENV === 'development').
 *
 * Each row replays the saved context through OUR `recompute()` (same
 * formula as the admin) and surfaces the delta against:
 *   - the human-observed in-game value (`obs`)
 *   - the admin's calc-at-save value (`calculatedAtSave`)
 *
 * Any non-zero `Δ admin` flags either:
 *   - a context-composition bug on our side (we set a field the admin doesn't)
 *   - a buff catalog mismatch (our awakening / char buffs differ from admin's)
 *   - a regression in `recompute()` since the obs was saved (then admin would
 *     also drift on its own table — rebake observations to refresh baselines)
 *
 * `Δ obs` is informational — the formula isn't expected to match the
 * in-game value perfectly, only to stay close enough for the comparison
 * UX (the admin lab tracks a per-char tolerance heuristic that's out of
 * scope for the public calc).
 */

interface Props {
  observations: ObservationV2[]
  awakening: DamageCalcAwakeningBuffs
  manifest: DamageCalcCharSummary[]
}

export default function ObsTablePanel({ observations, awakening, manifest }: Props) {
  const { t } = useI18n()
  const [divergentOnly, setDivergentOnly] = useState(true)
  /** Char buffs cache, keyed by charId. Fetched once per unique char in `observations`. */
  const [charBuffsByChar, setCharBuffsByChar] = useState<Record<string, DamageCalcCharBuffs>>({})

  // Fetch the buff catalog for every unique char that appears in the obs
  // log. Concurrent + cancel-safe; the underlying `fetchCharBuffs` dedups
  // so re-mounts are free.
  useEffect(() => {
    const uniqueIds = Array.from(new Set(observations.map(o => o.charId).filter(Boolean)))
    let cancelled = false
    Promise.all(uniqueIds.map(id =>
      fetchCharBuffs(id)
        .then(cb => ({ id, cb }))
        .catch(err => {
          console.warn(`[obs-table] failed to load buffs for ${id}:`, err)
          return null
        }),
    )).then(results => {
      if (cancelled) return
      const next: Record<string, DamageCalcCharBuffs> = {}
      for (const r of results) if (r) next[r.id] = r.cb
      setCharBuffsByChar(next)
    })
    return () => { cancelled = true }
  }, [observations])

  /** Resolve a CF char's base id (for EE wearer routing in the formula). */
  const baseCharIdLookup = useMemo(
    () => (charId: string) => manifest.find(c => c.id === charId)?.baseCharId,
    [manifest],
  )

  /** Per-obs recompute output. Updates whenever the buff catalogs change
   *  — cheap (50 rows × handful of buffs) so re-running on every render is
   *  fine, but the memo dedupes redundant work when only the filter toggles. */
  const rows = useMemo(() => {
    return observations.map(obs => {
      // Awakening + this char's buffs. If the char's buffs aren't loaded
      // yet, fall back to awakening alone — the table renders a partial
      // value rather than blank rows.
      const charBuffs = charBuffsByChar[obs.charId]
      const buffs: ApplicableBuff[] = charBuffs
        ? [...awakening.buffs, ...charBuffs.buffs]
        : awakening.buffs
      let calculated: number | null = null
      try {
        calculated = recomputeFromObs(obs, buffs, baseCharIdLookup)
      } catch (err) {
        console.warn(`[obs-table] recompute failed for ${obs.id}:`, err)
      }
      const adminCalc = obs.calculatedAtSave ?? null
      const deltaAdmin = calculated != null && adminCalc != null ? calculated - adminCalc : null
      const deltaObs   = calculated != null ? calculated - obs.obs : null
      return { obs, calculated, adminCalc, deltaAdmin, deltaObs, buffsLoaded: !!charBuffs }
    }).sort((a, b) => (b.obs.ts > a.obs.ts ? 1 : -1))
  }, [observations, awakening, charBuffsByChar, baseCharIdLookup])

  // Rows split by baseline status:
  //   - divergent: have a `calculatedAtSave` and our calc differs from it
  //   - matched:   have a `calculatedAtSave` and our calc agrees
  //   - noBaseline: saved before the field was added to the admin schema
  //                 → the comparison isn't meaningful (same formula on both
  //                 sides would always agree by construction)
  const divergentCount  = rows.filter(r => r.deltaAdmin != null && r.deltaAdmin !== 0).length
  const matchedCount    = rows.filter(r => r.deltaAdmin === 0).length
  const noBaselineCount = rows.filter(r => r.deltaAdmin == null).length
  // Filter: when divergentOnly is on, hide both matched AND no-baseline rows.
  // No-baseline rows aren't divergent — they're un-checkable.
  const visibleRows = divergentOnly ? rows.filter(r => r.deltaAdmin != null && r.deltaAdmin !== 0) : rows

  return (
    <details className="rounded border border-purple-500/40 bg-purple-500/5 p-3" open={divergentCount > 0}>
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300">
        <span className="rounded bg-purple-500/30 px-1.5 py-px text-[10px] font-bold uppercase text-purple-200">DEV</span>
        {t('tools.damage-calculator.obs.title')}
        <span className="flex items-center gap-1.5 text-[10px] normal-case tracking-normal text-zinc-500">
          <span>{rows.length}</span>
          <span className="text-zinc-700">·</span>
          <span className={divergentCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
            {divergentCount} {t('tools.damage-calculator.obs.divergent')}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-emerald-400">{matchedCount} {t('tools.damage-calculator.obs.matched')}</span>
          {noBaselineCount > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500" title={t('tools.damage-calculator.obs.no_baseline_hint')}>
                {noBaselineCount} {t('tools.damage-calculator.obs.no_baseline')}
              </span>
            </>
          )}
        </span>
      </summary>

      <div className="mt-2 flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={divergentOnly}
            onChange={e => setDivergentOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-rose-500"
          />
          {t('tools.damage-calculator.obs.divergent_only')}
        </label>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr className="text-left uppercase tracking-wider text-zinc-500">
              <Th>{t('tools.damage-calculator.obs.col.char')}</Th>
              <Th>{t('tools.damage-calculator.obs.col.skill')}</Th>
              <Th>{t('tools.damage-calculator.obs.col.target')}</Th>
              <Th align="right">{t('tools.damage-calculator.obs.col.observed')}</Th>
              <Th align="right">{t('tools.damage-calculator.obs.col.admin_calc')}</Th>
              <Th align="right">{t('tools.damage-calculator.obs.col.our_calc')}</Th>
              <Th align="right">{t('tools.damage-calculator.obs.col.delta_admin')}</Th>
              <Th align="right">{t('tools.damage-calculator.obs.col.delta_obs')}</Th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-[11px] text-emerald-400">
                  {t('tools.damage-calculator.obs.all_match')}
                </td>
              </tr>
            )}
            {visibleRows.map(({ obs, calculated, adminCalc, deltaAdmin, deltaObs, buffsLoaded }) => {
              const divergent = deltaAdmin != null && deltaAdmin !== 0
              return (
                <tr key={obs.id} className={divergent ? 'bg-rose-500/5' : ''}>
                  <Td>
                    <div className="font-semibold text-zinc-100">{obs.charName}</div>
                    <div className="text-[9px] uppercase text-zinc-500">{obs.charElement} · {obs.charClass}</div>
                  </Td>
                  <Td>
                    <div className="text-zinc-200">{obs.slot} <span className="text-zinc-500">Lv{obs.skillLevel}</span></div>
                    <div className="text-[9px] text-zinc-500">df={obs.df} {obs.crit && <span className="text-amber-300">crit</span>}</div>
                  </Td>
                  <Td>
                    <div className="text-zinc-200">{obs.monsterName ?? '—'}</div>
                    <div className="text-[9px] text-zinc-500">
                      {obs.monsterElement} · {obs.modeLabel ?? obs.mode ?? '—'}
                    </div>
                  </Td>
                  <Td align="right" className="tabular-nums text-zinc-100">{obs.obs.toLocaleString()}</Td>
                  <Td align="right" className="tabular-nums text-zinc-300">
                    {adminCalc != null
                      ? adminCalc.toLocaleString()
                      : <span className="text-zinc-600" title={t('tools.damage-calculator.obs.no_baseline_hint')}>—</span>}
                  </Td>
                  <Td align="right" className={`tabular-nums ${calculated != null ? 'text-zinc-100' : 'text-zinc-600'}`}>
                    {calculated != null ? calculated.toLocaleString() : '—'}
                    {!buffsLoaded && <span className="ml-1 text-[9px] text-amber-400" title="char buffs not loaded">⚠</span>}
                  </Td>
                  <Td align="right" className={`tabular-nums font-semibold ${deltaColor(deltaAdmin)}`}>
                    {fmtDelta(deltaAdmin)}
                  </Td>
                  <Td align="right" className={`tabular-nums ${deltaColor(deltaObs)}`}>
                    {fmtDelta(deltaObs)}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`border-b border-zinc-800 px-2 py-1 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Td({ children, align, className = '' }: { children: React.ReactNode; align?: 'right'; className?: string }) {
  return (
    <td className={`border-b border-zinc-800/60 px-2 py-1 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  )
}

function fmtDelta(n: number | null): string {
  if (n == null) return '—'
  if (n === 0) return '0'
  return (n > 0 ? '+' : '') + n.toLocaleString()
}

function deltaColor(n: number | null): string {
  if (n == null) return 'text-zinc-600'
  if (n === 0) return 'text-emerald-400'
  return Math.abs(n) > 100 ? 'text-rose-400' : 'text-amber-400'
}

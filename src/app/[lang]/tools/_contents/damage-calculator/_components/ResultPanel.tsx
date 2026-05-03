'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { recompute } from '@/lib/damage/v2/recompute'
import type { CalcState } from '../_state/types'
import type { ComputedDamage } from '../_lib/compose-result'

/**
 * Result panel — pure renderer for the computed damage. The context build
 * + `recompute()` call live in `CalculatorClient` (lifted so the share
 * panel can embed the same value in its export envelope without
 * duplicating the work).
 *
 * V1 surface:
 *   - Big single-number readout (final calculated damage)
 *   - Debug toggle reveals the per-step breakdown (`DamageBreakdown.debugSteps`)
 */

interface Props {
  state: CalcState
  computed: ComputedDamage | null
}

export default function ResultPanel({ state, computed }: Props) {
  const { t } = useI18n()
  const [debugOpen, setDebugOpen] = useState(false)

  if (!computed) {
    return (
      <div className="rounded border border-dashed border-zinc-800 bg-zinc-950 p-4 text-center text-xs text-zinc-500">
        {t('tools.damage-calculator.result.empty')}
      </div>
    )
  }

  const { result } = computed
  const dmg = result.calculated

  return (
    <div className="space-y-2">
      {/* Headline number — gold when crit (matches in-game's crit-color
          convention so divergence reports flag the right damage profile). */}
      <div className="rounded border border-zinc-800 bg-zinc-950 p-4 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {t('tools.damage-calculator.result.calculated')}
        </div>
        <div className={`mt-1 text-3xl font-bold tabular-nums ${state.attacker.crit ? 'text-amber-300' : 'text-zinc-100'}`}>
          {dmg.toLocaleString()}
        </div>
        {/* Skill DMG + crit hint, secondary line */}
        <div className="mt-1 text-[11px] text-zinc-400">
          {state.attacker.crit ? (
            <span className="text-amber-300">{t('tools.damage-calculator.attacker.crit')}</span>
          ) : (
            <span>{t('tools.damage-calculator.result.no_crit')}</span>
          )}
          <span className="mx-2 text-zinc-700">·</span>
          <span>
            {t('tools.damage-calculator.attacker.df')}: <span className="tabular-nums text-zinc-200">{(result.breakdown.rate * 100).toFixed(1)}%</span>
          </span>
        </div>
      </div>

      {/* Debug toggle — reveals per-step formula trace + intermediate values */}
      <button
        type="button"
        onClick={() => setDebugOpen(o => !o)}
        className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-left text-[10px] uppercase tracking-wider text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200"
      >
        {debugOpen ? '▼' : '▶'} {t('tools.damage-calculator.result.debug')}
      </button>

      {debugOpen && <DebugBreakdown breakdown={result.breakdown} />}
    </div>
  )
}

function DebugBreakdown({ breakdown }: { breakdown: ReturnType<typeof recompute>['breakdown'] }) {
  const { t } = useI18n()
  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-2 text-xs">
      {/* Top-level rates */}
      <div className="grid grid-cols-2 gap-1">
        <Stat label={t('tools.damage-calculator.result.pool')}      value={`${(breakdown.poolPct).toFixed(1)}%`} />
        <Stat label={t('tools.damage-calculator.result.rate')}      value={breakdown.rate.toFixed(4)} />
        <Stat label={t('tools.damage-calculator.result.mitigation')} value={breakdown.mitigation.toFixed(4)} />
        <Stat label={t('tools.damage-calculator.result.elem_mult')} value={breakdown.elemMult.toFixed(2)} />
        <Stat label={t('tools.damage-calculator.result.main_calc')} value={breakdown.mainCalc.toLocaleString()} />
        <Stat label={t('tools.damage-calculator.result.add_calc')}  value={breakdown.additionalCalc.toLocaleString()} />
      </div>
      {/* Step trace — collapsible block */}
      {breakdown.debugSteps.length > 0 && (
        <details className="rounded bg-zinc-900 p-2">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-zinc-500">
            {t('tools.damage-calculator.result.steps')} ({breakdown.debugSteps.length})
          </summary>
          <ol className="mt-2 space-y-0.5 font-mono text-[10px] text-zinc-300">
            {breakdown.debugSteps.map((step, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate text-zinc-500">
                  <span className="text-zinc-600">{i.toString().padStart(2, '0')}.</span> {step.label}
                  {step.note && <span className="text-zinc-700"> — {step.note}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-200">
                  {Number.isInteger(step.value) ? step.value.toLocaleString() : step.value.toFixed(4)}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="tabular-nums font-semibold text-zinc-100">{value}</span>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { TFunction } from '@/i18n'
import type { CalcAction } from '../_state/reducer'
import type { CalcState } from '../_state/types'
import type { ComputedDamage } from '../_lib/compose-result'
import { exportCalcState, parseSharedState, type ShareReport } from '../_lib/share'

/**
 * Share panel modal — exports the live calculator state as a JSON envelope
 * the user can copy to clipboard, and accepts a paste-back to import a
 * sibling's setup. Useful for divergence reports: someone shares their
 * params, you paste them in and check whether your calc matches theirs.
 *
 * On-wire shape is versioned (`v: 1`) so future schema changes can be
 * detected on import. Defensive parsing fills missing slices with
 * `INITIAL_*` defaults — old shares survive new fields without breaking.
 */

interface Props {
  open: boolean
  onClose: () => void
  state: CalcState
  /** Live computed damage — auto-embedded in the export envelope so the
   *  receiver knows what the sender's calc returned. Null when the calc
   *  isn't ready (no char / no target). */
  computed: ComputedDamage | null
  portalElement: HTMLElement | null
  dispatch: (action: CalcAction) => void
}

export default function SharePanel({ open, onClose, state, computed, portalElement, dispatch }: Props) {
  const { t } = useI18n()
  /** Operator-supplied bug-report fields — bundled into the export envelope. */
  const [observedRaw, setObservedRaw] = useState('')
  const [note, setNote] = useState('')
  const [pasteValue, setPasteValue] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err' | 'warn'; node: React.ReactNode } | null>(null)
  const exportRef = useRef<HTMLTextAreaElement>(null)

  // Build the report bundle on the fly. Only emitted when the calc is ready
  // (no point shipping `calculated: 0` from a half-filled state).
  const report: ShareReport | undefined = useMemo(() => {
    if (!computed) return undefined
    const observed = parseObserved(observedRaw)
    return {
      calculated: computed.result.calculated,
      observed: observed != null ? observed : undefined,
      note: note.trim() || undefined,
    }
  }, [computed, observedRaw, note])

  const exportText = useMemo(() => (open ? exportCalcState(state, { report }) : ''), [open, state, report])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset paste field + feedback whenever the modal closes so each open
  // starts clean (no stale errors from a prior failed import). Observed +
  // note also reset — they're scoped to a single bug-report session.
  useEffect(() => {
    if (!open) {
      setPasteValue('')
      setFeedback(null)
      setObservedRaw('')
      setNote('')
    }
  }, [open])

  if (!open || !portalElement) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportText)
      setFeedback({ kind: 'ok', node: t('tools.damage-calculator.share.copied') })
    } catch {
      // Clipboard API may be blocked (insecure context, denied permission) —
      // fall back to selecting the textarea so the user can Ctrl+C manually.
      exportRef.current?.select()
      setFeedback({ kind: 'warn', node: t('tools.damage-calculator.share.copy_fallback') })
    }
  }

  function handleImport() {
    const parsed = parseSharedState(pasteValue)
    if (!parsed.ok) {
      setFeedback({ kind: 'err', node: parsed.error })
      return
    }
    dispatch({ type: 'state/import', state: parsed.state })
    // Build the feedback node — when the share carried a report, surface
    // the sender's calc + observed + note so the dev can compare against
    // the local recompute that's about to update with the new state.
    const lines: React.ReactNode[] = []
    lines.push(parsed.warnings.length > 0
      ? t('tools.damage-calculator.share.imported_with_warnings', { warnings: parsed.warnings.join(', ') })
      : t('tools.damage-calculator.share.imported'),
    )
    if (parsed.report) {
      lines.push(<ReportSummary key="report" report={parsed.report} t={t} />)
    }
    setFeedback({ kind: parsed.warnings.length > 0 ? 'warn' : 'ok', node: <div className="space-y-2">{lines}</div> })
    setPasteValue('')
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-gray-800 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-100">
            {t('tools.damage-calculator.share.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-gray-400 hover:text-gray-100"
          >
            &times;
          </button>
        </div>
        <p className="mb-6 text-sm text-gray-400">
          {t('tools.damage-calculator.share.subtitle')}
        </p>

        <div className="space-y-5">
          {/* Export — bug-report fields above, then the JSON textarea + copy. */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                {t('tools.damage-calculator.share.export')}
              </h4>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
              >
                {t('tools.damage-calculator.share.copy')}
              </button>
            </div>

            {/* Bug-report inputs — auto-bundled into the JSON envelope. */}
            <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3 text-xs">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {t('tools.damage-calculator.share.report_section')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ReportField label={t('tools.damage-calculator.share.report_calculated')}>
                  <span className="tabular-nums text-zinc-100">
                    {computed ? computed.result.calculated.toLocaleString() : '—'}
                  </span>
                </ReportField>
                <ReportField label={t('tools.damage-calculator.share.report_observed')}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="—"
                    value={observedRaw}
                    onChange={e => setObservedRaw(e.target.value)}
                    className="w-full bg-transparent text-right text-xs font-semibold text-zinc-100 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </ReportField>
              </div>
              <label className="mt-2 block">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t('tools.damage-calculator.share.report_note')}
                </div>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={t('tools.damage-calculator.share.report_note_placeholder')}
                  rows={2}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 p-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>

            <textarea
              ref={exportRef}
              value={exportText}
              readOnly
              spellCheck={false}
              rows={8}
              onClick={() => exportRef.current?.select()}
              className="w-full rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-[10px] text-zinc-200 focus:border-blue-500 focus:outline-none"
            />
          </section>

          {/* Import — editable textarea + apply button */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                {t('tools.damage-calculator.share.import')}
              </h4>
              <button
                type="button"
                onClick={handleImport}
                disabled={pasteValue.trim().length === 0}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
              >
                {t('tools.damage-calculator.share.apply')}
              </button>
            </div>
            <textarea
              value={pasteValue}
              onChange={e => setPasteValue(e.target.value)}
              placeholder={t('tools.damage-calculator.share.paste_placeholder')}
              spellCheck={false}
              rows={8}
              className="w-full rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-[10px] text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </section>

          {/* Feedback band — same slot for ok / warn / err so the panel
              doesn't reflow as the user retries. Imported reports surface
              their sender's calc + observed + note here so the dev can read
              them at a glance, then close the modal to compare with the
              local Result panel that's just been rehydrated. */}
          {feedback && (
            <div className={`rounded border px-3 py-2 text-xs ${
              feedback.kind === 'ok'   ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : feedback.kind === 'warn' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
            }`}>
              {feedback.node}
            </div>
          )}
        </div>
      </div>
    </div>,
    portalElement,
  )
}

function ReportField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1">{children}</div>
    </div>
  )
}

/** Read-only summary of the imported report — sender's calc + observed
 *  + delta + note. Renders inside the feedback band after a successful
 *  import so the dev sees the bug context at a glance. */
function ReportSummary({ report, t }: { report: ShareReport; t: TFunction }) {
  const obs = report.observed
  const delta = obs != null ? obs - report.calculated : null
  return (
    <div className="rounded bg-black/20 p-2 text-[11px]">
      <div className="grid grid-cols-3 gap-2">
        <ReportLine label={t('tools.damage-calculator.share.report_calculated')} value={report.calculated.toLocaleString()} />
        <ReportLine label={t('tools.damage-calculator.share.report_observed')} value={obs != null ? obs.toLocaleString() : '—'} />
        <ReportLine
          label={t('tools.damage-calculator.share.report_delta')}
          value={delta != null ? `${delta >= 0 ? '+' : ''}${delta.toLocaleString()}` : '—'}
          valueClassName={delta != null && delta !== 0 ? (delta > 0 ? 'text-amber-300' : 'text-rose-300') : ''}
        />
      </div>
      {report.note && (
        <div className="mt-2 rounded bg-black/30 p-1.5 text-[11px] italic text-zinc-300">
          “{report.note}”
        </div>
      )}
    </div>
  )
}

function ReportLine({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`tabular-nums font-semibold ${valueClassName || 'text-zinc-100'}`}>{value}</div>
    </div>
  )
}

/** Defensive numeric parse — empty / NaN / negative all map to null. */
function parseObserved(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = parseFloat(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

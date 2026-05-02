'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useI18n } from '@/lib/contexts/I18nContext'
import type { DamageCalcCodexEntry } from '@/lib/data/damage-calc'
import type { SettingsState } from '../_state/types'
import type { CalcAction } from '../_state/reducer'

/**
 * Account-wide damage-calc settings — codex level + Quirks toggles.
 *
 * Renders as a centered modal portal triggered from CalculatorClient (same
 * UX as the Progress Tracker settings, so users get a consistent feel
 * between the tools). Closes on backdrop click + Escape.
 *
 * Codex bonuses use the same stat icons as the AttackerPanel grid for visual
 * continuity. Quirk toggles use the in-game `CM_Gift_Menu_*` icons —
 * Element (01), Class/Job (03), Counteract (05), Adventure License (06).
 *
 * Element + Class affect the prefilled stat sheet today. PVE + Adventure
 * License are persisted but inert (BT_DMG runtime modifiers, will be wired
 * into the recompute pipeline once the ResultPanel ships).
 */

interface Props {
  open: boolean
  onClose: () => void
  settings: SettingsState
  codexTable: DamageCalcCodexEntry[]
  portalElement: HTMLElement | null
  dispatch: (action: CalcAction) => void
}

const QUIRK_ICON_BASE = '/images/guides/general-guides'
const STAT_ICON_BASE  = '/images/ui/effect'

export default function SettingsPanel({ open, onClose, settings, codexTable, portalElement, dispatch }: Props) {
  const { t } = useI18n()

  // Esc-to-close — only attached while the modal is open so we don't capture
  // global Escape presses on every render.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !portalElement) return null

  const codexEntry = codexTable.find(e => e.level === settings.codexLevel) ?? codexTable[0]
  const maxCodex = codexTable[codexTable.length - 1]?.level ?? 11

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-gray-800 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-100">
            {t('tools.damage-calculator.settings.title')}
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
          {t('tools.damage-calculator.settings.subtitle')}
        </p>

        <div className="space-y-4">
          {/* Codex card */}
          <div className="rounded-lg bg-gray-700 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium text-gray-100">
                {t('tools.damage-calculator.settings.codex')}
              </span>
              <span className="text-sm tabular-nums text-gray-400">
                Lv <span className="font-semibold text-gray-100">{settings.codexLevel}</span>
                <span className="text-gray-500"> / {maxCodex}</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxCodex}
              step={1}
              value={settings.codexLevel}
              onChange={e => dispatch({ type: 'settings/setCodexLevel', level: parseInt(e.target.value, 10) })}
              className="w-full accent-yellow-500"
              aria-label={t('tools.damage-calculator.settings.codex')}
            />
            <div className="mt-2 flex flex-wrap gap-2 text-xs tabular-nums">
              <CodexStatChip iconName="CM_Stat_Icon_ATK" pct={codexEntry?.atkPct ?? 0} alt="ATK" />
              <CodexStatChip iconName="CM_Stat_Icon_DEF" pct={codexEntry?.defPct ?? 0} alt="DEF" />
              <CodexStatChip iconName="CM_Stat_Icon_HP"  pct={codexEntry?.hpPct  ?? 0} alt="HP" />
            </div>
          </div>

          {/* Quirks card */}
          <div className="rounded-lg bg-gray-700 p-4">
            <div className="mb-3">
              <span className="font-medium text-gray-100">
                {t('tools.damage-calculator.settings.quirks')}
              </span>
            </div>
            <div className="space-y-2">
              <QuirkToggle
                label={t('tools.damage-calculator.settings.quirk_element')}
                iconName="CM_Gift_Menu_01"
                enabled={settings.quirks.element}
                onToggle={enabled => dispatch({ type: 'settings/setQuirk', scope: 'element', enabled })}
              />
              <QuirkToggle
                label={t('tools.damage-calculator.settings.quirk_class')}
                iconName="CM_Gift_Menu_03"
                enabled={settings.quirks.job}
                onToggle={enabled => dispatch({ type: 'settings/setQuirk', scope: 'job', enabled })}
              />
              <QuirkToggle
                label={t('tools.damage-calculator.settings.quirk_counteract')}
                iconName="CM_Gift_Menu_05"
                enabled={settings.quirks.pve}
                onToggle={enabled => dispatch({ type: 'settings/setQuirk', scope: 'pve', enabled })}
                runtimeOnly
                runtimeNote={t('tools.damage-calculator.settings.quirk_runtime_only')}
              />
              <QuirkToggle
                label={t('tools.damage-calculator.settings.quirk_adventure_license')}
                iconName="CM_Gift_Menu_06"
                enabled={settings.quirks.adventureLicense}
                onToggle={enabled => dispatch({ type: 'settings/setQuirk', scope: 'adventureLicense', enabled })}
                runtimeOnly
                runtimeNote={t('tools.damage-calculator.settings.quirk_runtime_only')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalElement,
  )
}

/** Stat icon + bonus chip for the codex card. Faded when bonus is zero. */
function CodexStatChip({ iconName, pct, alt }: { iconName: string; pct: number; alt: string }) {
  const inactive = pct === 0
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
      inactive ? 'border-gray-600 text-gray-500' : 'border-gray-600 bg-gray-800/40 text-gray-100'
    }`}>
      <Image
        src={`${STAT_ICON_BASE}/${iconName}.webp`}
        alt={alt}
        width={14}
        height={14}
        className={`object-contain ${inactive ? 'opacity-40' : ''}`}
      />
      <span className="font-semibold">+{pct}%</span>
    </span>
  )
}

function QuirkToggle({
  label,
  iconName,
  enabled,
  onToggle,
  runtimeOnly = false,
  runtimeNote,
}: {
  label: string
  iconName: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  /** True for quirks that don't yet affect the stat sheet (PVE / AdvLicense). */
  runtimeOnly?: boolean
  runtimeNote?: string
}) {
  // checkbox-style row that mirrors the progress-tracker label rows: full
  // width clickable area, leading checkbox, icon + label, trailing tag for
  // runtime-only quirks so the user knows toggling them is a no-op for the
  // stat prefill (until ResultPanel ships).
  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded bg-gray-650/40 px-3 py-2 transition hover:bg-gray-600/40"
      title={runtimeOnly ? runtimeNote : undefined}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={e => onToggle(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-gray-500 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
      />
      <Image
        src={`${QUIRK_ICON_BASE}/${iconName}.webp`}
        alt=""
        width={24}
        height={24}
        className={`shrink-0 object-contain ${enabled ? '' : 'opacity-50 grayscale'}`}
      />
      <span className={`flex-1 text-sm ${enabled ? 'text-gray-100' : 'text-gray-400'}`}>
        {label}
      </span>
      {runtimeOnly && (
        <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
          {/* Static label so it's instantly recognizable across langs. */}
          runtime
        </span>
      )}
    </label>
  )
}

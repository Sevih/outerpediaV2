'use client'

import Image from 'next/image'
import { useEffect, useReducer, useState } from 'react'
import type {
  DamageCalcCharManifest,
  DamageCalcAwakeningBuffs,
  DamageCalcMonstersFile,
  DamageCalcMechanicsIndex,
  DamageCalcTranscendFile,
  DamageCalcEquipmentFile,
} from '@/lib/data/damage-calc'
import { useI18n } from '@/lib/contexts/I18nContext'
import { calcReducer, INITIAL_STATE } from './_state/reducer'
import { INITIAL_SETTINGS, type CalcState, type SettingsState } from './_state/types'
import { computeFinalStats, pickCodexEntry } from './_lib/no-gear-stats'
import AttackerPanel from './_components/AttackerPanel'
import SettingsPanel from './_components/SettingsPanel'

// v3: quirks shape extended to { element, job, pve, adventureLicense } — old
// v1/v2 blobs are silently dropped (defaults rehydrate cleanly).
const SETTINGS_STORAGE_KEY = 'damage-calc:settings:v3'

/**
 * Damage calculator — client orchestrator.
 *
 * Owns the page state via `useReducer` and renders the four panels
 * (attacker / target / buffs / result). Per-char data (skills, base
 * stats, applicable buffs) is fetched lazily by `AttackerPanel` from
 * `/damage-calc/chars/{id}.json` + `/damage-calc/buffs/{id}.json` —
 * kept out of the page-boot payload to keep the first paint snappy.
 *
 * v1 = single mode (one attacker → one target). The Compare-3-builds
 * mode is wired as a disabled tab placeholder for now.
 */

interface Props {
  manifest: DamageCalcCharManifest
  awakening: DamageCalcAwakeningBuffs
  monsters: DamageCalcMonstersFile
  mechanicsIndex: DamageCalcMechanicsIndex
  transcend: DamageCalcTranscendFile
  equipment: DamageCalcEquipmentFile
}

export default function CalculatorClient({
  manifest,
  awakening,
  monsters,
  mechanicsIndex,
  transcend,
  equipment,
}: Props) {
  const { lang, t } = useI18n()
  const [state, dispatch] = useReducer(calcReducer, INITIAL_STATE)
  const [showSettings, setShowSettings] = useState(false)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)

  // Resolve the global #portal-root once on mount — same pattern as the
  // progress tracker so the SettingsPanel modal anchors outside the
  // calculator's grid layers.
  useEffect(() => {
    setPortalElement(document.getElementById('portal-root'))
  }, [])

  // Load persisted settings from localStorage on first mount only. Done in
  // an effect (not via lazy useReducer init) so the SSR'd HTML matches the
  // first client render — avoids hydration mismatches when settings differ
  // from the defaults.
  useEffect(() => {
    const restored = readSettings()
    if (restored) dispatch({ type: 'settings/replace', settings: restored })
  }, [])

  // Persist settings on change. Skip the very first run (defaults) so we
  // don't clobber a future migration's restored values.
  useEffect(() => {
    writeSettings(state.settings)
  }, [state.settings])

  // Auto-prefill the attacker stats from `noGearStats + settings + transcend`
  // whenever any of those inputs change. Skipped while `statsDirty` is true
  // (user has edited the grid manually since the last char-pick / reset).
  //
  // Deps are narrowed to ONLY the inputs of the computation — including
  // `state` here would re-fire the effect on every dispatched
  // `applyAutoStats`, looping forever.
  const { attacker, settings, statsDirty } = state
  const charId = attacker.charId
  const detail = attacker.detail
  const transStar = attacker.transStar
  useEffect(() => {
    if (statsDirty) return
    if (!charId || !detail) return
    const tier = transcend.byChar[charId]?.tiers.find(t => t.transStar === transStar) ?? null
    const codex = pickCodexEntry(manifest.codexTable, settings.codexLevel)
    const next = computeFinalStats({
      noGear:        detail.noGearStats,
      codex,
      transcendTier: tier,
      quirks:        settings.quirks,
      transStar,
    })
    dispatch({ type: 'attacker/applyAutoStats', stats: next })
  }, [charId, detail, transStar, settings, statsDirty, transcend, manifest.codexTable])

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* WIP disclaimer — sets expectations on accuracy + variance. */}
      <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-400 text-[10px] font-bold">!</span>
        <p className="leading-relaxed">{t('tools.damage-calculator.disclaimer')}</p>
      </div>

      {/* Mode toggle + Settings — Compare disabled for v1. The Settings
          button on the right opens the same-style modal as the Progress
          Tracker so users get a familiar account-wide config flow. */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white"
        >
          Single
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="rounded bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-500 cursor-not-allowed"
        >
          Compare 3 builds
        </button>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="ml-auto group flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-1.5 transition hover:bg-gray-800"
        >
          <Image
            src="/images/ui/nav/CM_Agit_Facility.webp"
            alt=""
            width={20}
            height={20}
            className="object-contain transition-transform group-hover:scale-110"
          />
          <span className="text-sm text-gray-400 transition-colors group-hover:text-gray-200">
            {t('tools.damage-calculator.settings.title')}
          </span>
        </button>
      </div>

      {/* Settings modal portal — toggled by the button above. */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={state.settings}
        codexTable={manifest.codexTable}
        portalElement={portalElement}
        dispatch={dispatch}
      />

      {/* Three-panel layout: 3-col on desktop, stacked on mobile. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Attacker">
          <AttackerPanel
            state={state.attacker}
            dispatch={dispatch}
            manifest={manifest.chars}
            transcend={transcend}
            equipment={equipment}
            portalElement={portalElement}
            lang={lang}
          />
        </Panel>
        <Panel title="Target">
          <Placeholder>Mode → stage → monster picker, manual override, mechanics toggles</Placeholder>
        </Panel>
        <Panel title="Result">
          <Placeholder>Computed damage, breakdown, active buffs, debug toggle</Placeholder>
        </Panel>
      </div>

      {/* Full-width buff/debuff toggles section. */}
      <Panel title="Buffs / Debuffs">
        <Placeholder>External buffs (attacker/target × buff/debuff) and gear set passives</Placeholder>
      </Panel>

      {/* Debug-only block — surfaces what the bake delivered to the client.
          Kept until the real panels are wired so we can verify data flow. */}
      <details className="rounded border border-zinc-800 bg-zinc-950 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Bake payload sanity check
        </summary>
        <ul className="mt-2 space-y-0.5 text-xs text-zinc-400">
          <li>Manifest: <span className="text-zinc-200">{manifest.chars.length}</span> chars</li>
          <li>Awakening buffs: <span className="text-zinc-200">{awakening.buffs.length}</span></li>
          <li>Monster stages: <span className="text-zinc-200">{monsters.stages.length}</span></li>
          <li>Monsters with mechanics: <span className="text-zinc-200">{mechanicsIndex.monsterIds.length}</span></li>
          <li>Chars with transcend tiers: <span className="text-zinc-200">{Object.keys(transcend.byChar).length}</span></li>
        </ul>
      </details>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
      {children}
    </div>
  )
}

/**
 * Read the persisted SettingsState. Defensive against quota errors, JSON
 * corruption, and shape drift across releases — anything fishy returns
 * `null` so the reducer keeps its `INITIAL_SETTINGS` defaults.
 */
function readSettings(): SettingsState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SettingsState> | null
    if (!parsed || typeof parsed !== 'object') return null
    const codexLevel = typeof parsed.codexLevel === 'number' && Number.isFinite(parsed.codexLevel)
      ? Math.max(0, Math.min(11, Math.floor(parsed.codexLevel)))
      : INITIAL_SETTINGS.codexLevel
    const q: Partial<SettingsState['quirks']> = parsed.quirks ?? {}
    return {
      codexLevel,
      quirks: {
        element:          typeof q.element          === 'boolean' ? q.element          : INITIAL_SETTINGS.quirks.element,
        job:              typeof q.job              === 'boolean' ? q.job              : INITIAL_SETTINGS.quirks.job,
        pve:              typeof q.pve              === 'boolean' ? q.pve              : INITIAL_SETTINGS.quirks.pve,
        adventureLicense: typeof q.adventureLicense === 'boolean' ? q.adventureLicense : INITIAL_SETTINGS.quirks.adventureLicense,
      },
    }
  } catch {
    return null
  }
}

function writeSettings(settings: CalcState['settings']): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore — quota errors / private mode shouldn't break the calc.
  }
}

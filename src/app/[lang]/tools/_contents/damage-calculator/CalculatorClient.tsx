'use client'

import Image from 'next/image'
import { useEffect, useMemo, useReducer, useState } from 'react'
import type {
  DamageCalcCharBuffs,
  DamageCalcCharManifest,
  DamageCalcAwakeningBuffs,
  DamageCalcMonstersFile,
  DamageCalcMechanicsIndex,
  DamageCalcTranscendFile,
  DamageCalcEquipmentFile,
} from '@/lib/data/damage-calc'
import { useI18n } from '@/lib/contexts/I18nContext'
import { bossOverrideFromMechanics } from '@/lib/damage/v2/boss-overrides'
import { calcReducer, INITIAL_STATE } from './_state/reducer'
import { INITIAL_SETTINGS, type CalcState, type SettingsState } from './_state/types'
import { computeBaseStatsAndScaling, computeTeamDeltas, pickCodexEntry, resolveTeamDeltaDisplay } from './_lib/no-gear-stats'
import { fetchCharBuffs, fetchMonsterMechanics } from './_lib/fetch-data'
import { runRecompute } from './_lib/compose-result'
import { isAdventureLicenseMode } from '@/lib/damage/v2/recompute'
import AttackerPanel from './_components/AttackerPanel'
import BuffsPanel from './_components/BuffsPanel'
import ObsTablePanel from './_components/ObsTablePanel'
import ResultPanel from './_components/ResultPanel'
import SettingsPanel from './_components/SettingsPanel'
import SharePanel from './_components/SharePanel'
import TargetPanel from './_components/TargetPanel'
import TeamPanel from './_components/TeamPanel'
import type { ObservationV2 } from './_lib/observations'

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
  /** Dev-only — admin observation log for the divergence table. Null in prod. */
  observations: ObservationV2[] | null
}

export default function CalculatorClient({
  manifest,
  awakening,
  monsters,
  mechanicsIndex,
  transcend,
  equipment,
  observations,
}: Props) {
  const { lang, t } = useI18n()
  const [state, dispatch] = useReducer(calcReducer, INITIAL_STATE)
  const [showSettings, setShowSettings] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  /** Char buffs (lazy per-char) — lifted here so both AttackerPanel (conditional
   *  inputs) and ResultPanel (formula buff catalog) read from the same source. */
  const [charBuffs, setCharBuffs] = useState<DamageCalcCharBuffs | null>(null)

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

  // Lazy-fetch the per-char buff catalog when the picked char changes. Reset
  // to null on swap so the previous char's buffs never leak into the next
  // recompute / conditional-input picker.
  useEffect(() => {
    const requested = state.attacker.charId
    if (!requested) { setCharBuffs(null); return }
    let cancelled = false
    setCharBuffs(null)
    fetchCharBuffs(requested)
      .then(b => { if (!cancelled && b.charId === requested) setCharBuffs(b) })
      .catch(err => { if (!cancelled) console.error(`[damage-calc] failed to load char buffs for ${requested}:`, err) })
    return () => { cancelled = true }
  }, [state.attacker.charId])

  // Auto-prefill the attacker stats from `noGearStats + settings + transcend`
  // whenever any of those inputs change. Skipped while `statsDirty` is true
  // (user has edited the grid manually since the last char-pick / reset).
  //
  // Deps are narrowed to ONLY the inputs of the computation — including
  // `state` here would re-fire the effect on every dispatched
  // `applyAutoStats`, looping forever.
  const { attacker, settings, statsDirty, target } = state
  const charId = attacker.charId
  const detail = attacker.detail
  const transStar = attacker.transStar
  // Derive whether the picked target sits in an Adventure License dungeon
  // mode (DM_ADVENTURE_MISSION / _CHALLENGE). Combined with the AL quirk
  // toggle, this folds the AL stat-bonus contribution into the prefilled
  // sheet. Manual targets have no mode → AL contribution stays off.
  // Derive whether the picked target sits in an Adventure License dungeon
  // mode (DM_ADVENTURE_MISSION / _CHALLENGE). Combined with the AL quirk
  // toggle, this folds the AL stat-bonus contribution into the prefilled
  // sheet. Manual targets have no mode → AL contribution stays off.
  const inAdvLicenseMode = useMemo(() => {
    if (target.mode !== 'cascade' || !target.stageId) return false
    for (const m of monsters.modes) {
      if (m.stages.some(s => s.id === target.stageId)) {
        return isAdventureLicenseMode(m.mode)
      }
    }
    return false
  }, [target.mode, target.stageId, monsters])
  useEffect(() => {
    if (statsDirty) return
    if (!charId || !detail) return
    const tier = transcend.byChar[charId]?.tiers.find(t => t.transStar === transStar) ?? null
    const codex = pickCodexEntry(manifest.codexTable, settings.codexLevel)
    // Auto-prefill BASE stats only — team contributions (transcend bonuses
    // + ally talismans) are surfaced as `(+X)` annotations next to each
    // stat field and applied at recompute time. Keeps the dealer's grid
    // 1:1 with the in-game character sheet so users don't have to mentally
    // subtract team buffs to verify their inputs.
    const { stats: next, atkScaling } = computeBaseStatsAndScaling({
      noGear:             detail.noGearStats,
      codex,
      transcendTier:      tier,
      quirks:             settings.quirks,
      transStar,
      inAdventureLicense: inAdvLicenseMode,
    })
    dispatch({ type: 'attacker/applyAutoStats', stats: next, atkScaling })
  }, [charId, detail, transStar, settings, statsDirty, transcend, manifest.codexTable, inAdvLicenseMode])

  // Lazy-fetch boss mechanics whenever the picked monster changes. Mechanics
  // are gated on the index — only ~600 monsters carry damage-relevant
  // passives, and a 404 for the rest would be wasted bandwidth. Manual mode
  // skips the fetch entirely (no monsterId).
  const monsterId = state.target.monsterId
  useEffect(() => {
    if (!monsterId) return
    if (!mechanicsIndex.monsterIds.includes(monsterId)) {
      // Monster has no damage-relevant passive — clear any stale override
      // from the previous selection so the panel stays hidden.
      dispatch({ type: 'boss/setOverride', override: null })
      return
    }
    let cancelled = false
    fetchMonsterMechanics(monsterId)
      .then(file => {
        if (cancelled) return
        dispatch({ type: 'boss/setOverride', override: bossOverrideFromMechanics(file.data) })
      })
      .catch(err => {
        if (cancelled) return
        console.error(`[damage-calc] failed to load mechanics for ${monsterId}:`, err)
      })
    return () => { cancelled = true }
  }, [monsterId, mechanicsIndex])

  // Lifted recompute — single source of truth for both ResultPanel (display)
  // and SharePanel (embedded in the export envelope as `report.calculated`).
  const computed = useMemo(
    () => runRecompute(state, awakening, charBuffs, monsters, manifest.chars, transcend, equipment),
    [state, awakening, charBuffs, monsters, manifest.chars, transcend, equipment],
  )

  // Per-stat team contribution annotations — same `TeamDeltas` block the
  // calc consumes, just turned into the human-friendly `(+X)` overlay
  // shown next to each affected stat field. Memoized on team / catalog so
  // a stat-grid edit doesn't re-resolve unnecessarily.
  const teamDeltaDisplay = useMemo(
    () => resolveTeamDeltaDisplay(
      state.attacker.stats,
      computeTeamDeltas(state.team, transcend.byChar, equipment.talismanMainStats),
    ),
    [state.attacker.stats, state.team, transcend, equipment.talismanMainStats],
  )

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
          {t('tools.damage-calculator.tab.single')}
        </button>
        <button
          type="button"
          disabled
          title={t('common.coming_soon')}
          className="rounded bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-500 cursor-not-allowed"
        >
          {t('tools.damage-calculator.tab.compare')}
        </button>
        <button
          type="button"
          onClick={() => setShowShare(true)}
          title={t('tools.damage-calculator.share.title')}
          className="ml-auto group flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-1.5 transition hover:bg-gray-800"
        >
          <span className="text-sm text-gray-400 transition-colors group-hover:text-gray-200">
            {t('tools.damage-calculator.share.title')}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="group flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-1.5 transition hover:bg-gray-800"
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

      {/* Share modal portal — export current state for someone to reproduce,
          or import a shared state to verify a divergence report. */}
      <SharePanel
        open={showShare}
        onClose={() => setShowShare(false)}
        state={state}
        computed={computed}
        portalElement={portalElement}
        dispatch={dispatch}
      />

      {/* Three-panel layout: 3-col on desktop, stacked on mobile. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('tools.damage-calculator.panel.attacker')}>
          <AttackerPanel
            state={state.attacker}
            dispatch={dispatch}
            manifest={manifest.chars}
            transcend={transcend}
            equipment={equipment}
            charBuffs={charBuffs}
            teamDeltaDisplay={teamDeltaDisplay}
            currentTargetElement={computed?.ctx.targetElement ?? null}
            portalElement={portalElement}
            lang={lang}
          />
        </Panel>
        <Panel title={t('tools.damage-calculator.panel.target')}>
          <TargetPanel
            catalog={monsters}
            state={state.target}
            awakening={awakening}
            settings={state.settings}
            bossOverride={state.bossOverride}
            bossMechanics={state.bossMechanics}
            lang={lang}
            dispatch={dispatch}
          />
        </Panel>
        <Panel title={t('tools.damage-calculator.panel.result')}>
          <ResultPanel state={state} computed={computed} />
        </Panel>
      </div>

      {/* Ally team — 3 slots × (talisman + class-conditional signature gear).
          Sits between the 3-col grid and the buffs row so the support setup
          is visible without scrolling past the buff matrix. */}
      <Panel title={t('tools.damage-calculator.panel.team')}>
        <TeamPanel
          state={state.team}
          manifest={manifest.chars}
          transcend={transcend}
          talismanMainStats={equipment.talismanMainStats}
          lang={lang}
          dispatch={dispatch}
        />
      </Panel>

      {/* Full-width buff/debuff toggles section. */}
      <Panel title={t('tools.damage-calculator.panel.buffs')}>
        <BuffsPanel state={state.buffs} dispatch={dispatch} />
      </Panel>

      {/* Dev-only — admin observation divergence table. Hidden in prod since
          the observations prop is null. */}
      {observations && (
        <ObsTablePanel
          observations={observations}
          awakening={awakening}
          manifest={manifest.chars}
        />
      )}

      {/* Debug-only block — surfaces what the bake delivered to the client.
          Kept until the real panels are wired so we can verify data flow. */}
      <details className="rounded border border-zinc-800 bg-zinc-950 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Bake payload sanity check
        </summary>
        <ul className="mt-2 space-y-0.5 text-xs text-zinc-400">
          <li>Manifest: <span className="text-zinc-200">{manifest.chars.length}</span> chars</li>
          <li>Awakening buffs: <span className="text-zinc-200">{awakening.buffs.length}</span></li>
          <li>Monster modes: <span className="text-zinc-200">{monsters.modes.length}</span> ({monsters.modes.reduce((n, m) => n + m.stages.length, 0)} stages)</li>
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

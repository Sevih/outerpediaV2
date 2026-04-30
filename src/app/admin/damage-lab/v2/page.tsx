'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import {
  recompute, type RecomputeContext, type RecomputeResult,
} from '@/lib/damage/v2/recompute'
import { EXTERNAL_BUFFS } from '@/lib/damage/v2/external-buffs'
import { getBossOverride } from '@/lib/damage/v2/boss-overrides'
import type { ApplicableBuff, AppliesTo, PoolCondition } from '@/lib/damage/v2/buffs'

import { AttackerPanel } from './_components/AttackerPanel'
import { TargetPanel } from './_components/TargetPanel'
import { BuffsTogglesPanel } from './_components/BuffsTogglesPanel'
import { ResultPanel } from './_components/ResultPanel'
import { ObsTable } from './_components/ObsTable'
import { formReducer, makeInitialFormState } from './_state/reducer'
import { loadFormState, usePersistFormState } from './_state/persistence'
import {
  fetchChars, fetchCharStats, getDamageFactor, getAdditionalAttackRatio, type CharData,
} from './_api/chars'
import {
  fetchStages, type ModeEntry, type MonsterEntry,
} from './_api/monsters'
import { fetchBuffs } from './_api/buffs'
import {
  fetchObservations, saveObservation, deleteObservation,
} from './_api/observations'
import type { CharSummary, MonsterOption } from './_state/types'
import type { ObservationV2 } from '@/app/api/admin/damage-lab/v2/observations/route'

/**
 * Damage Lab v2 — page (PR 9, full API wire-up).
 */
export default function DamageLabV2Page() {
  // Init from defaults only — keeps server SSR and first client render identical
  // (avoids a hydration mismatch when localStorage holds a non-empty blob).
  // The persisted blob is merged in via the post-mount effect below.
  const [state, dispatch] = useReducer(formReducer, undefined, makeInitialFormState)
  useEffect(() => {
    const loaded = loadFormState()
    if (loaded) dispatch({ type: 'form/hydrate', payload: loaded })
  }, [])
  usePersistFormState(state)

  // ── Async data ─────────────────────────────────────────────────────────
  const [chars, setChars] = useState<CharData[] | null>(null)
  const [stagesTree, setStagesTree] = useState<ModeEntry[] | null>(null)
  const [buffs, setBuffs] = useState<ApplicableBuff[]>([])
  const [observations, setObservations] = useState<ObservationV2[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchChars(), fetchStages(), fetchBuffs(), fetchObservations()])
      .then(([c, s, b, o]) => {
        if (cancelled) return
        setChars(c); setStagesTree(s); setBuffs(b); setObservations(o)
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [])

  // ── Derived data ───────────────────────────────────────────────────────
  const charCatalog: CharSummary[] = useMemo(() => {
    if (!chars) return []
    return chars
      .filter(c => /^Earth$|^Water$|^Fire$|^Light$|^Dark$/.test(c.element))
      .map(c => ({
        id: c.id,
        name: c.name,
        element: c.element as CharSummary['element'],
        class: c.class,
        subclass: c.subclass,
        portraitUrl: c.portraitUrl,
      }))
  }, [chars])

  // charId → display name. Powers human-readable labels in the active-buffs
  // debug list (e.g. `char:2000028:2000028_1_3` → "Maxwell · S3").
  const charNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of chars ?? []) m.set(c.id, c.name)
    return m
  }, [chars])

  // The /v2/stages endpoint emits one entry per (DungeonMode, label) pair —
  // multiple labels can share the same DungeonMode (e.g. several "tower"
  // sub-modes). `MonsterPicker` consumes the full tree and renders the cascade
  // (Category → Mode → Season → Dungeon → Stage → Monster).
  const modeEntries = useMemo(() => stagesTree ?? [], [stagesTree])

  const selectedModeEntry = useMemo(() => {
    if (!stagesTree || !state.target.mode) return null
    return stagesTree.find(m => m.label === state.target.mode) ?? null
  }, [stagesTree, state.target.mode])

  const monstersInStage: MonsterEntry[] = useMemo(() => {
    if (!selectedModeEntry || !state.target.stageId) return []
    const stage = selectedModeEntry.stages.find(s => s.id === state.target.stageId)
    if (!stage) return []
    // Flatten waves; dedupe by monsterId (same monster may appear across waves).
    const seen = new Set<string>()
    const out: MonsterEntry[] = []
    for (const w of stage.waves) {
      for (const m of w.monsters) {
        if (!seen.has(m.monsterId)) { seen.add(m.monsterId); out.push(m) }
      }
    }
    return out
  }, [selectedModeEntry, state.target.stageId])

  const selectedChar = chars?.find(c => c.id === state.attacker.charId) ?? null
  const bossOverride = getBossOverride(state.target.monsterId)

  // ── Applicable pool_cond inputs ────────────────────────────────────────
  // Walk the buff list filtered to the current char to find which BT_DMG_*
  // pool-condition handlers will actually fire — that's the set of inputs the
  // panels render. A char without `BT_DMG_ENEMY_TEAM_DECREASE` doesn't see
  // the "Enemies dead" field, etc. Empty when no char is selected.
  const applicablePoolConds = useMemo(() => {
    const out = new Set<PoolCondition>()
    if (!selectedChar) return out
    for (const b of buffs) {
      if (b.effect.target !== 'pool_cond' || !b.effect.poolCond) continue
      if (!appliesToCharSummary(b.appliesTo, selectedChar)) continue
      out.add(b.effect.poolCond)
    }
    return out
  }, [buffs, selectedChar])

  const selectedMonsterMeta = useMemo(() => {
    if (!state.target.monsterId) return null
    const m = monstersInStage.find(x => x.monsterId === state.target.monsterId)
    if (!m) return null
    return {
      faceIconId: m.faceIconId,
      type: m.type,
      monsterClass: m.class,
      basicStar: m.basicStar,
      level: m.level,
    }
  }, [state.target.monsterId, monstersInStage])

  // Auto-fill stats now happens inside the `selectMonster` handler (event-driven,
  // not effect-based) — see `handleSelectMonster` below. Avoids a feedback loop
  // where dispatching `target/autoFillStats` re-triggers the effect.

  // Auto-fill attacker stats when the picked char changes. We only run on
  // `attacker.charId` (NOT on stats fields) so the dispatched values can't
  // re-trigger the effect — same pattern as the `target` flow above.
  useEffect(() => {
    if (!state.attacker.charId) return
    let cancelled = false
    fetchCharStats(state.attacker.charId)
      .then(s => {
        if (cancelled) return
        dispatch({
          type: 'attacker/autoFillStats',
          stats: {
            atk: Math.floor(s.final.atk),
            chd: s.final.chd,
            pen: s.final.pen,
            dmgInc: s.final.dmgInc,
          },
          // Forward the full stat block so secondary scaling (Stella HP,
          // Regina CHC, Noa target_stat) can read ST_HP / ST_DEF / etc.
          extraStats: {
            ST_HP: Math.floor(s.final.hp),
            ST_DEF: Math.floor(s.final.def),
            ST_CRITICAL_RATE: s.final.chc,
            ST_CRITICAL_DMG_RATE: s.final.chd,
            ST_PIERCE_POWER_RATE: s.final.pen,
            ST_BUFF_CHANCE: s.final.eff,
            ST_BUFF_RESIST: s.final.res,
          },
          atkScaling: s.meta.scaling?.atk ?? null,
        })
      })
      .catch(e => console.warn('[damage-lab/v2] fetchCharStats failed:', e))
    return () => { cancelled = true }
  }, [state.attacker.charId])

  // ── Recompute context + result ─────────────────────────────────────────
  const { ctx, result } = useMemo<{ ctx: RecomputeContext | null; result: RecomputeResult | null }>(() => {
    if (!selectedChar) return { ctx: null, result: null }
    const df = getDamageFactor(selectedChar, state.attacker.slot, state.attacker.skillLevel)
    const addRatio = getAdditionalAttackRatio(selectedChar, state.attacker.slot)
    const c: RecomputeContext = {
      charId: selectedChar.id,
      charElement: selectedChar.element,
      charClass: selectedChar.class,
      charSubclass: selectedChar.subclass,
      slot: state.attacker.slot,
      damageFactor: df,
      additionalAttackRatio: state.attacker.additionalAttackEnabled ? addRatio : undefined,
      atk: state.attacker.atk,
      chd: state.attacker.chd,
      pen: state.attacker.pen,
      dmgInc: state.attacker.dmgInc,
      applyQuirks: state.attacker.applyQuirks,
      extraStats: state.attacker.extraStats,
      atkScaling: state.attacker.atkScaling,
      targetDef: state.target.def,
      targetDmgRed: state.target.dmgRed,
      targetCdmgRed: state.target.cdmgRed,
      targetHp: state.target.hp ?? undefined,
      isBoss: state.target.isBoss,
      elem: detectElem(selectedChar.element, state.target.element),
      crit: state.attacker.crit,
      // ctx.mode expects the DungeonMode (DM_*) string for the AdvLicense gate.
      // target.mode now stores the user-facing label, so we resolve via the
      // currently-selected ModeEntry. Falls back to '' when nothing's selected.
      mode: selectedModeEntry?.mode ?? '',
      monsterId: state.target.monsterId ?? undefined,
      charFlags: state.attacker.charFlags,
      C: state.target.C,
      ratioDivisor: state.target.ratioDivisor,
      // Pool conditions — caster/target fields come from the panel inputs;
      // env flags (Monad Gate / Tower / PvP) are auto-derived from the picked
      // mode so the user doesn't have to mirror them by hand.
      ownerHpRate: state.poolConds.ownerHpRate,
      targetHpRate: state.poolConds.targetHpRate,
      casterHpRate: state.poolConds.casterHpRate,
      ownerBuffCount: state.poolConds.ownerBuffCount,
      targetBuffCount: state.poolConds.targetBuffCount,
      ownerDebuffCount: state.poolConds.ownerDebuffCount,
      targetDebuffCount: state.poolConds.targetDebuffCount,
      targetBroken: state.poolConds.targetBroken,
      killCountStack: state.poolConds.killCountStack,
      teamBuffCount: state.poolConds.teamBuffCount,
      teamDecreaseCount: state.poolConds.teamDecreaseCount,
      enemyTeamDecreaseCount: state.poolConds.enemyTeamDecreaseCount,
      inMonadGate: deriveInMonadGate(selectedModeEntry?.mode),
      inTower:     deriveInTower(selectedModeEntry?.mode),
      inPvp:       deriveInPvp(selectedModeEntry?.mode),
      externalBuffs: state.externalBuffs,
      bossMechanics: state.bossMechanics,
    }
    return { ctx: c, result: recompute(c, buffs) }
  }, [selectedChar, state, buffs, selectedModeEntry])

  // ── Obs table calcs (live recompute on each render) ────────────────────
  // The calc isn't stored on save — every formula tweak immediately reflects
  // across the entire history.
  const obsCalcs = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of observations) {
      map.set(o.id, recomputeFromObs(o, chars ?? [], buffs))
    }
    return map
  }, [observations, chars, buffs])

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleSaveObs({ observed, note }: { observed: number; note?: string }) {
    if (!ctx || !result || !selectedChar) return
    const stage = stagesTree
      ?.find(m => m.mode === state.target.mode)
      ?.stages.find(s => s.id === state.target.stageId)
    const monster = monstersInStage.find(m => m.monsterId === state.target.monsterId)
    const payload: Partial<ObservationV2> = {
      charId: ctx.charId,
      charName: selectedChar.name,
      charElement: ctx.charElement,
      charClass: ctx.charClass,
      charSubclass: ctx.charSubclass,
      slot: ctx.slot,
      skillLevel: state.attacker.skillLevel,
      df: ctx.damageFactor,
      additionalAttackEnabled: state.attacker.additionalAttackEnabled,
      additionalAttackRatio: ctx.additionalAttackRatio,
      atk: ctx.atk, chd: ctx.chd, pen: ctx.pen, dmgInc: ctx.dmgInc,
      applyQuirks: ctx.applyQuirks,
      extraStats: state.attacker.extraStats,
      charFlags: state.attacker.charFlags,
      atkScaling: state.attacker.atkScaling ?? undefined,
      targetDef: ctx.targetDef,
      targetDmgRed: ctx.targetDmgRed,
      targetCdmgRed: ctx.targetCdmgRed,
      targetHp: ctx.targetHp,
      isBoss: ctx.isBoss,
      elem: ctx.elem,
      // target.mode stores the user-facing label; obs.mode is the DungeonMode
      // (for `isAdventureLicenseMode`). modeLabel is preserved so loading the
      // obs back into the form re-selects the same picker entry.
      mode: selectedModeEntry?.mode || undefined,
      modeLabel: state.target.mode || undefined,
      stageId: state.target.stageId || undefined,
      stageName: stage?.name,
      monsterId: state.target.monsterId || undefined,
      monsterName: state.target.monsterName || undefined,
      monsterLvl: monster?.level,
      monsterElement: monster?.element,
      monsterClass: monster?.class,
      monsterType: monster?.type,
      ownerHpRate: ctx.ownerHpRate,
      targetHpRate: ctx.targetHpRate,
      casterHpRate: ctx.casterHpRate,
      ownerBuffCount: ctx.ownerBuffCount,
      targetBuffCount: ctx.targetBuffCount,
      ownerDebuffCount: ctx.ownerDebuffCount,
      targetDebuffCount: ctx.targetDebuffCount,
      targetBroken: ctx.targetBroken,
      killCountStack: ctx.killCountStack,
      teamBuffCount: ctx.teamBuffCount,
      teamDecreaseCount: ctx.teamDecreaseCount,
      enemyTeamDecreaseCount: ctx.enemyTeamDecreaseCount,
      inMonadGate: ctx.inMonadGate,
      inTower: ctx.inTower,
      inPvp: ctx.inPvp,
      externalBuffs: state.externalBuffs,
      bossMechanics: state.bossMechanics,
      crit: ctx.crit,
      obs: observed,
      note,
      // `calculatedAtSave` intentionally omitted — the obs table recomputes
      // every row live so formula tweaks immediately reflect across history.
    }
    const saved = await saveObservation(payload)
    setObservations(rows => [...rows, saved])
  }

  async function handleDeleteObs(id: string) {
    if (!confirm('Delete this observation?')) return
    await deleteObservation(id)
    setObservations(rows => rows.filter(o => o.id !== id))
  }

  function handleSelectMonster(monster: MonsterOption): void {
    dispatch({ type: 'target/setMonster', monster })
    const full = monstersInStage.find(m => m.monsterId === monster.id)
    if (full) {
      dispatch({
        type: 'target/autoFillStats',
        stats: {
          def: full.defAtLevel,
          dmgRed: full.drPctAtLevel,
          cdmgRed: 0,         // not in datamine — operator overrides if needed
          hp: full.hpAtLevel,
        },
      })
    }
  }

  function handleReAutoFill(): void {
    if (!state.target.monsterId) return
    const full = monstersInStage.find(m => m.monsterId === state.target.monsterId)
    if (!full) return
    dispatch({
      type: 'target/autoFillStats',
      stats: {
        def: full.defAtLevel,
        dmgRed: full.drPctAtLevel,
        cdmgRed: 0,
        hp: full.hpAtLevel,
      },
    })
  }

  function handleLoadObs(id: string) {
    const o = observations.find(r => r.id === id)
    if (!o) return
    dispatch({
      type: 'form/loadFromObs',
      payload: {
        attacker: {
          charId: o.charId,
          slot: o.slot,
          skillLevel: o.skillLevel,
          atk: o.atk, chd: o.chd, pen: o.pen, dmgInc: o.dmgInc,
          crit: o.crit,
          applyQuirks: o.applyQuirks,
          additionalAttackEnabled: o.additionalAttackEnabled ?? false,
          charFlags: o.charFlags ?? {},
          extraStats: o.extraStats ?? {},
          atkScaling: o.atkScaling ?? null,
        },
        target: {
          // Prefer the saved modeLabel (matches a picker entry exactly). Fall
          // back to the DungeonMode for older blobs without modeLabel.
          mode: o.modeLabel ?? o.mode ?? '',
          stageId: o.stageId ?? null,
          monsterId: o.monsterId ?? null,
          monsterName: o.monsterName ?? null,
          element: o.monsterElement ?? '',
          isBoss: o.isBoss,
          def: o.targetDef,
          dmgRed: o.targetDmgRed,
          cdmgRed: o.targetCdmgRed,
          hp: o.targetHp ?? null,
        },
        poolConds: {
          ownerHpRate: o.ownerHpRate ?? 1,
          targetHpRate: o.targetHpRate ?? 1,
          casterHpRate: o.casterHpRate ?? 1,
          ownerBuffCount: o.ownerBuffCount ?? 0,
          targetBuffCount: o.targetBuffCount ?? 0,
          ownerDebuffCount: o.ownerDebuffCount ?? 0,
          targetDebuffCount: o.targetDebuffCount ?? 0,
          targetBroken: !!o.targetBroken,
          killCountStack: o.killCountStack ?? 0,
          teamBuffCount: o.teamBuffCount ?? 0,
          teamDecreaseCount: o.teamDecreaseCount ?? 0,
          enemyTeamDecreaseCount: o.enemyTeamDecreaseCount ?? 0,
          inMonadGate: !!o.inMonadGate,
          inTower: !!o.inTower,
          inPvp: !!o.inPvp,
        },
        externalBuffs: o.externalBuffs,
      },
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 pb-3">
        <h1 className="text-2xl font-bold">Damage Lab v2</h1>
        {!chars && !error && (
          <span className="text-xs text-zinc-500 animate-pulse">loading data…</span>
        )}
        {chars && (
          <span className="text-[10px] text-zinc-500">
            {chars.length} chars · {buffs.length} buffs · {observations.length} obs
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-500">
          pipeline f32 binary-faithful · single floor at end
        </span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'form/reset' })}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Reset form
        </button>
      </header>

      {error && (
        <div className="rounded border border-red-900/40 bg-red-950/20 p-3 text-xs text-red-300">
          API error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <AttackerPanel
          state={state.attacker}
          charCatalog={charCatalog}
          poolConds={state.poolConds}
          applicablePoolConds={applicablePoolConds}
          onChange={patch => dispatch({ type: 'attacker/patch', patch })}
          onSetChar={charId => dispatch({ type: 'attacker/setChar', charId })}
          onSetSlot={slot => dispatch({ type: 'attacker/setSlot', slot })}
          onSetFlag={(flag, value) => dispatch({ type: 'attacker/setFlag', flag, value })}
          onEditStat={(field, value) => dispatch({ type: 'attacker/manualEditStat', field, value })}
          onPoolCondChange={patch => dispatch({ type: 'poolCond/patch', patch })}
        />
        <TargetPanel
          state={state.target}
          modeEntries={modeEntries}
          selectedMonsterMeta={selectedMonsterMeta}
          poolConds={state.poolConds}
          applicablePoolConds={applicablePoolConds}
          bossOverride={bossOverride}
          bossMechanicsState={state.bossMechanics}
          onChange={patch => dispatch({ type: 'target/patch', patch })}
          onSelectMode={mode => dispatch({ type: 'target/setMode', mode })}
          onSelectStage={stageId => dispatch({ type: 'target/setStage', stageId })}
          onSelectMonster={handleSelectMonster}
          onAutoFill={handleReAutoFill}
          onPoolCondChange={patch => dispatch({ type: 'poolCond/patch', patch })}
          onBossMechanicToggle={(id, active) => dispatch({ type: 'bossMechanic/toggle', id, active })}
          onBossMechanicValueChange={(id, value) => dispatch({ type: 'bossMechanic/setValue', id, value })}
        />
        <ResultPanel
          result={result}
          ctx={ctx}
          showDebug={state.ui.showDebug}
          onToggleDebug={value => dispatch({ type: 'ui/setShowDebug', value })}
          onSaveObs={handleSaveObs}
          charNameById={charNameById}
        />
      </div>

      <BuffsTogglesPanel
        catalog={EXTERNAL_BUFFS}
        state={state.externalBuffs}
        onToggle={(id, active) => dispatch({ type: 'externalBuff/toggle', id, active })}
        onValueChange={(id, value) => dispatch({ type: 'externalBuff/setValue', id, value })}
      />

      <ObsTable
        observations={observations}
        calcs={obsCalcs}
        onLoad={handleLoadObs}
        onDelete={handleDeleteObs}
      />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

const ELEMENT_ADV: Record<string, string> = {
  Fire: 'Earth', Earth: 'Water', Water: 'Fire',
  Light: 'Dark', Dark: 'Light',
}

function detectElem(attacker: string, target: string): 'none' | 'adv' | 'disadv' {
  if (!attacker || !target || attacker === target) return 'none'
  if (ELEMENT_ADV[attacker] === target) return 'adv'
  if (ELEMENT_ADV[target] === attacker) return 'disadv'
  return 'none'
}

// Mode-string → environment-flag heuristics. The DungeonMode enum has stable
// substrings ('MONAD_GATE' / 'TOWER' / 'PVP') we can match without a hardcoded
// allowlist — gracefully handles future variants like DM_TOWER_ELEMENT_HARD.
function deriveInMonadGate(mode: string | undefined): boolean {
  return !!mode && mode.includes('MONAD_GATE')
}
function deriveInTower(mode: string | undefined): boolean {
  return !!mode && mode.includes('TOWER')
}
function deriveInPvp(mode: string | undefined): boolean {
  return !!mode && (mode.includes('PVP') || mode.includes('ARENA'))
}

/**
 * Mirrors `appliesToCaster` from `src/lib/damage/v2/buffs.ts` — kept inline
 * because that helper is reducer-private. Subclass match is uppercase.
 */
function appliesToCharSummary(at: AppliesTo, char: { id: string; element: string; class: string; subclass: string }): boolean {
  switch (at.kind) {
    case 'all':      return true
    case 'element':  return at.value === char.element
    case 'class':    return at.value === char.class
    case 'subclass': return at.value === char.subclass.toUpperCase()
    case 'char':     return at.value === char.id
  }
}

/** Recompute a saved obs to surface the live calc value in the obs table. */
function recomputeFromObs(o: ObservationV2, chars: CharData[], buffs: ApplicableBuff[]): number {
  const c = chars.find(x => x.id === o.charId)
  const ctx: RecomputeContext = {
    charId: o.charId,
    charElement: o.charElement,
    charClass: o.charClass,
    charSubclass: o.charSubclass,
    slot: o.slot,
    damageFactor: o.df,
    additionalAttackRatio: o.additionalAttackEnabled
      ? (c ? getAdditionalAttackRatio(c, o.slot) : o.additionalAttackRatio)
      : undefined,
    atk: o.atk, chd: o.chd, pen: o.pen, dmgInc: o.dmgInc,
    applyQuirks: o.applyQuirks,
    extraStats: o.extraStats,
    atkScaling: o.atkScaling,
    targetDef: o.targetDef,
    targetDmgRed: o.targetDmgRed,
    targetCdmgRed: o.targetCdmgRed,
    targetHp: o.targetHp,
    isBoss: o.isBoss,
    elem: o.elem,
    crit: o.crit,
    mode: o.mode,
    monsterId: o.monsterId,
    charFlags: o.charFlags,
    ownerHpRate: o.ownerHpRate,
    targetHpRate: o.targetHpRate,
    casterHpRate: o.casterHpRate,
    ownerBuffCount: o.ownerBuffCount,
    targetBuffCount: o.targetBuffCount,
    ownerDebuffCount: o.ownerDebuffCount,
    targetDebuffCount: o.targetDebuffCount,
    targetBroken: o.targetBroken,
    killCountStack: o.killCountStack,
    teamBuffCount: o.teamBuffCount,
    teamDecreaseCount: o.teamDecreaseCount,
    enemyTeamDecreaseCount: o.enemyTeamDecreaseCount,
    inMonadGate: o.inMonadGate,
    inTower: o.inTower,
    inPvp: o.inPvp,
    externalBuffs: o.externalBuffs,
    bossMechanics: o.bossMechanics,
  }
  return recompute(ctx, buffs).calculated
}

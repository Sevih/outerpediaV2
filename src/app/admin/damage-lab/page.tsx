'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { computeDamage, type DamageInputs } from '@/lib/damage/formula'

const LS_FORM_KEY = 'damage-lab-form-v4'
const AUTO_SAVE_DEBOUNCE_MS = 1500
const SKILL_LEVEL = 5  // all observations at skill lvl 5

interface PersistedForm {
  characterId: string
  atk: string; chdPct: string; penPct: string; dmgIncPct: string
  def: string; tgtCdmgRedPct: string; tgtDmgRedPct: string
  elemental: 'none' | 'adv' | 'disadv'
  isBoss: boolean; quirksDisabled: boolean
  slot: 'first' | 'second' | 'ultimate'; crit: boolean
  note: string
  C: string; ratioDivisor: string
}

interface SkillData {
  skillId: string
  damageFactors: (number | null)[]
}

interface CharacterEntry {
  id: string
  name: string
  element: string
  class: string
  skills: {
    first: SkillData | null
    second: SkillData | null
    ultimate: SkillData | null
  }
}

interface Observation {
  id: string
  ts: string
  char: string
  charId: string
  class?: string
  element?: string
  slot: 'S1' | 'S2' | 'S3'
  df: number
  atk: number
  chd: number
  dmgInc: number            // full additive pool % (gear + passives + quirks user believes)
  pen: number
  def: number
  tCdmgRed: number
  tDmgRed: number
  elem: 'none' | 'adv' | 'disadv'
  isBoss?: boolean
  quirksDisabled?: boolean
  crit: boolean
  obs: number
  note?: string
}

type SlotKey = 'first' | 'second' | 'ultimate'
type SlotTag = 'S1' | 'S2' | 'S3'
const SLOT_LABELS: Record<SlotKey, SlotTag> = { first: 'S1', second: 'S2', ultimate: 'S3' }

const NUMBER_INPUT = 'w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-zinc-100 focus:border-blue-500 focus:outline-none'

function num(v: string, fallback = 0): number {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export default function DamageLabPage() {
  // Data
  const [characters, setCharacters] = useState<CharacterEntry[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)

  // Attacker
  const [characterId, setCharacterId] = useState('')
  const [atk, setAtk] = useState('')
  const [chdPct, setChdPct] = useState('')
  const [penPct, setPenPct] = useState('0')
  const [dmgIncPct, setDmgIncPct] = useState('0')

  // Target
  const [def, setDef] = useState('')
  const [tgtCdmgRedPct, setTgtCdmgRedPct] = useState('0')
  const [tgtDmgRedPct, setTgtDmgRedPct] = useState('0')
  // Metadata tags (NOT used by formula — just attached to observation for later analysis)
  const [elemental, setElemental] = useState<'none' | 'adv' | 'disadv'>('none')
  const [isBoss, setIsBoss] = useState(false)
  const [quirksDisabled, setQuirksDisabled] = useState(false)

  // Skill (always level 5 per convention)
  const [slot, setSlot] = useState<SlotKey>('first')
  const skillLevel = SKILL_LEVEL

  // Result
  const [crit, setCrit] = useState(false)
  const [observed, setObserved] = useState('')
  const [note, setNote] = useState('')

  // Formula constants (tunable)
  const [C, setC] = useState('1000')
  const [ratioDivisor, setRatioDivisor] = useState('1000')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formHydrated = useRef(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/damage-lab/characters').then(r => r.json()),
      fetch('/api/admin/damage-lab/observations').then(r => r.json()),
    ]).then(([chars, obs]) => {
      setCharacters(chars.characters ?? [])
      setObservations(obs.observations ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_FORM_KEY)
      if (raw) {
        const p = JSON.parse(raw) as Partial<PersistedForm>
        if (p.characterId != null) setCharacterId(p.characterId)
        if (p.atk != null) setAtk(p.atk)
        if (p.chdPct != null) setChdPct(p.chdPct)
        if (p.penPct != null) setPenPct(p.penPct)
        if (p.dmgIncPct != null) setDmgIncPct(p.dmgIncPct)
        if (p.def != null) setDef(p.def)
        if (p.tgtCdmgRedPct != null) setTgtCdmgRedPct(p.tgtCdmgRedPct)
        if (p.tgtDmgRedPct != null) setTgtDmgRedPct(p.tgtDmgRedPct)
        if (p.elemental != null) setElemental(p.elemental)
        if (p.isBoss != null) setIsBoss(p.isBoss)
        if (p.quirksDisabled != null) setQuirksDisabled(p.quirksDisabled)
        if (p.slot != null) setSlot(p.slot)
        if (p.crit != null) setCrit(p.crit)
        if (p.note != null) setNote(p.note)
        if (p.C != null) setC(p.C)
        if (p.ratioDivisor != null) setRatioDivisor(p.ratioDivisor)
      }
    } catch { /* ignore corrupt storage */ }
    formHydrated.current = true
  }, [])

  useEffect(() => {
    if (!formHydrated.current) return
    const p: PersistedForm = {
      characterId, atk, chdPct, penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss, quirksDisabled,
      slot, crit, note, C, ratioDivisor,
    }
    try { localStorage.setItem(LS_FORM_KEY, JSON.stringify(p)) } catch { /* quota etc. */ }
  }, [characterId, atk, chdPct, penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss, quirksDisabled,
      slot, crit, note, C, ratioDivisor])

  const selectedChar = useMemo(
    () => characters.find(c => c.id === characterId) ?? null,
    [characters, characterId]
  )

  const currentSkill = selectedChar?.skills[slot] ?? null
  const damageFactor = currentSkill?.damageFactors[skillLevel - 1] ?? null

  const computation = useMemo(() => {
    if (damageFactor == null) return null
    const inputs: DamageInputs = {
      atk: num(atk),
      damageFactor,
      chdPct: num(chdPct),
      penPct: num(penPct),
      dmgIncPct: num(dmgIncPct),
      crit,
      charClass: selectedChar?.class,
      def: num(def),
      cdmgRedPct: num(tgtCdmgRedPct),
      dmgRedPct: num(tgtDmgRedPct),
      isBoss,
      elem: elemental,
      C: num(C, 1000),
      ratioDivisor: num(ratioDivisor, 1000),
    }
    return computeDamage(inputs)
  }, [atk, damageFactor, chdPct, penPct, dmgIncPct, crit, selectedChar, def, tgtCdmgRedPct, tgtDmgRedPct, isBoss, elemental, C, ratioDivisor])

  const observedNum = observed.trim() === '' ? null : num(observed)
  const ratio = computation && observedNum != null && computation.calculated > 0
    ? observedNum / computation.calculated
    : null

  const matchBadge = ratio == null ? null :
    Math.abs(ratio - 1) <= 0.02
      ? <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-400">match ±2%</span>
      : Math.abs(ratio - 1) <= 0.05
        ? <span className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-400">off ±5%</span>
        : <span className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-400">mismatch</span>

  async function saveObservation() {
    if (!selectedChar || damageFactor == null || observedNum == null) return
    setSaveStatus('saving')
    const payload: Omit<Observation, 'id' | 'ts'> = {
      char: selectedChar.name,
      charId: selectedChar.id,
      class: selectedChar.class,
      element: selectedChar.element,
      slot: SLOT_LABELS[slot],
      df: damageFactor,
      atk: num(atk),
      chd: num(chdPct),
      dmgInc: num(dmgIncPct),
      pen: num(penPct),
      def: num(def),
      tCdmgRed: num(tgtCdmgRedPct),
      tDmgRed: num(tgtDmgRedPct),
      elem: elemental,
      isBoss,
      quirksDisabled,
      crit,
      obs: observedNum,
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    try {
      const res = await fetch('/api/admin/damage-lab/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        setObservations(prev => [...prev, data.observation])
        setObserved('')
        setNote('')
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 2000)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    }
  }

  const canAutoSave = !!selectedChar && damageFactor != null && observedNum != null
  useEffect(() => {
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null }
    if (!canAutoSave) { setSaveStatus(s => (s === 'pending' ? 'idle' : s)); return }
    setSaveStatus('pending')
    autoSaveTimer.current = setTimeout(() => { saveObservation() }, AUTO_SAVE_DEBOUNCE_MS)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observed, characterId, slot, crit, atk, chdPct,
      penPct, dmgIncPct,
      def, tgtCdmgRedPct, tgtDmgRedPct, elemental,
      isBoss, quirksDisabled, note])

  async function deleteObservation(id: string) {
    await fetch(`/api/admin/damage-lab/observations?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    setObservations(prev => prev.filter(o => o.id !== id))
  }

  async function clearAll() {
    if (!confirm('Delete ALL observations?')) return
    await fetch('/api/admin/damage-lab/observations?id=all', { method: 'DELETE' })
    setObservations([])
  }

  function exportJson() {
    const content = observations.map(o => JSON.stringify(o)).join('\n') + (observations.length ? '\n' : '')
    const blob = new Blob([content], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `damage-lab-observations-${new Date().toISOString().slice(0, 10)}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  function recomputeWithCurrentConstants(o: Observation): { calc: number; ratio: number } {
    const r = computeDamage({
      atk: o.atk,
      damageFactor: o.df,
      chdPct: o.chd,
      penPct: o.pen,
      dmgIncPct: o.dmgInc,
      crit: o.crit,
      charClass: o.class,
      def: o.def,
      cdmgRedPct: o.tCdmgRed,
      dmgRedPct: o.tDmgRed,
      isBoss: o.isBoss ?? false,
      elem: o.elem,
      C: num(C, 1000),
      ratioDivisor: num(ratioDivisor, 1000),
    })
    return { calc: r.calculated, ratio: r.calculated > 0 ? o.obs / r.calculated : 0 }
  }

  if (loading) return <div className="text-zinc-500">Loading…</div>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Damage Lab</h1>
        <span className="text-xs text-zinc-500">Skeleton formula · no auto-quirks · enter the full additive pool manually</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Attacker */}
        <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Attacker</h2>
          <div className="space-y-2 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-500">Character</span>
              <select
                value={characterId}
                onChange={e => setCharacterId(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              >
                <option value="">— select —</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.element} / {c.class})</option>
                ))}
              </select>
            </label>
            <Field label="ATK" value={atk} onChange={setAtk} />
            <Field label="Crit DMG %" value={chdPct} onChange={setChdPct} />
            <Field label="Penetration %" value={penPct} onChange={setPenPct} />
            <Field label="DMG Inc %" value={dmgIncPct} onChange={setDmgIncPct} />
          </div>
        </section>

        {/* Target + Skill */}
        <section className="space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Target</h2>
            <div className="space-y-2 text-sm">
              <Field label="DEF" value={def} onChange={setDef} />
              <Field label="Crit DMG Reduc %" value={tgtCdmgRedPct} onChange={setTgtCdmgRedPct} />
              <Field label="DMG Reduction %" value={tgtDmgRedPct} onChange={setTgtDmgRedPct} />
              <label className="block pt-2 border-t border-zinc-800">
                <span className="mb-1 block text-xs text-zinc-500">Elemental (auto-applies +50 add & ×1.20 mult if adv)</span>
                <select
                  value={elemental}
                  onChange={e => setElemental(e.target.value as 'none' | 'adv' | 'disadv')}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                >
                  <option value="none">None (neutral)</option>
                  <option value="adv">Advantage</option>
                  <option value="disadv">Disadvantage</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isBoss} onChange={e => setIsBoss(e.target.checked)} />
                <span className="text-xs text-zinc-500">Boss-type target (auto-applies +30% quirk)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={quirksDisabled} onChange={e => setQuirksDisabled(e.target.checked)} />
                <span className="text-xs text-zinc-500">Quirks disabled on target (metadata tag, not yet used)</span>
              </label>
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Skill</h2>
            <div className="mb-3 flex gap-2">
              {(['first', 'second', 'ultimate'] as SlotKey[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  className={`rounded px-3 py-1 text-sm ${slot === s ? 'bg-blue-600/30 text-blue-300' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                >{SLOT_LABELS[s]}</button>
              ))}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Level (fixed)</span>
                <span className="font-mono text-sm text-zinc-400">lvl {SKILL_LEVEL}</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="text-xs text-zinc-500">DamageFactor</span>
                <span className={`font-mono text-sm ${damageFactor != null ? 'text-zinc-100' : 'text-zinc-600'}`}>
                  {damageFactor ?? '—'}
                </span>
              </div>
              {currentSkill && (
                <div className="text-xs text-zinc-500">Skill ID: {currentSkill.skillId} · progression: {currentSkill.damageFactors.map(v => v ?? '–').join(' / ')}</div>
              )}
              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} />
                <span className="text-sm">Crit hit</span>
              </label>
            </div>
          </div>
        </section>

        {/* Computation + Save */}
        <section className="space-y-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Formula constants</h2>
            <div className="space-y-2 text-sm">
              <Field label="C (denominator)" value={C} onChange={setC} />
              <Field label="Ratio divisor (DF / x)" value={ratioDivisor} onChange={setRatioDivisor} />
            </div>
            <div className="mt-3 text-xs text-zinc-500 border-t border-zinc-800 pt-3 leading-relaxed">
              Formula: <span className="font-mono text-zinc-400">Dmg = (DF/{ratioDivisor}) × ATK × (1 + pool/100) × {C}/({C} + (1−PEN)×DEF) × (1 − targetDR/100) × adv_mult</span>
              <br/>pool = DMG Inc + (+30 if boss) + (+50 if adv) + (CHD−CDmgRed−100 if crit). adv_mult = 1.20 if adv, else 1.0.
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Result</h2>
            {computation ? (
              <div className="space-y-1 font-mono text-xs text-zinc-400">
                <div className="text-zinc-300">Active quirks (auto-applied):</div>
                {computation.quirks.length > 0 ? (
                  computation.quirks.map((q, idx) => (
                    <div key={idx} className="pl-2 text-green-400">+ {q.name}: {q.value}</div>
                  ))
                ) : (
                  <div className="pl-2 text-zinc-600">(none)</div>
                )}
                <div className="pt-1 border-t border-zinc-800">Pool: +{computation.poolPct.toFixed(1)}% → ×{computation.mod.toFixed(3)}</div>
                <div>Mitigation: ×{computation.mitigation.toFixed(4)}</div>
                <div>Target DR: ×{computation.targetDrMult.toFixed(4)}</div>
                <div>Elem mult: ×{computation.elemMult.toFixed(2)}</div>
                <div className="border-t border-zinc-800 pt-1 text-lg text-zinc-100">
                  Calc: <span className="font-bold">{computation.calculated.toFixed(0)}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-600">Select a character + skill level</div>
            )}

            <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3 text-sm">
              <Field label="Observed damage" value={observed} onChange={setObserved} />
              {ratio != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Obs/Calc</span>
                  <span className="font-mono">{ratio.toFixed(4)}</span>
                  {matchBadge}
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-500">Note</span>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  placeholder="e.g. baseline, +23% vs Earth, boss lvl20"
                />
              </label>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs">
                  {saveStatus === 'pending' && <span className="text-amber-400">auto-save in {(AUTO_SAVE_DEBOUNCE_MS / 1000).toFixed(1)}s…</span>}
                  {saveStatus === 'saving' && <span className="text-blue-400">saving…</span>}
                  {saveStatus === 'saved' && <span className="text-green-400">✓ saved</span>}
                  {saveStatus === 'error' && <span className="text-red-400">save error</span>}
                  {saveStatus === 'idle' && <span className="text-zinc-600">fill observed to auto-save</span>}
                </div>
                <button
                  onClick={() => {
                    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null }
                    saveObservation()
                  }}
                  disabled={!canAutoSave || saveStatus === 'saving'}
                  className="rounded bg-blue-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  Save now
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Observations table */}
      <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Observations ({observations.length})
          </h2>
          <div className="flex gap-2">
            <button onClick={exportJson} className="rounded bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700">Export JSON</button>
            <button onClick={clearAll} className="rounded bg-red-900/30 px-3 py-1 text-xs text-red-400 hover:bg-red-900/50">Clear all</button>
          </div>
        </div>
        {observations.length === 0 ? (
          <div className="py-4 text-center text-sm text-zinc-600">No observations yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="px-2 py-2 text-left">Character</th>
                  <th className="px-2 py-2 text-left">Skill</th>
                  <th className="px-2 py-2 text-right border-l border-zinc-800">ATK</th>
                  <th className="px-2 py-2 text-right">CHD</th>
                  <th className="px-2 py-2 text-right">DMG Inc</th>
                  <th className="px-2 py-2 text-right">PEN</th>
                  <th className="px-2 py-2 text-right border-l border-zinc-800">DEF</th>
                  <th className="px-2 py-2 text-right">CDMG Red</th>
                  <th className="px-2 py-2 text-right">DMG Red</th>
                  <th className="px-2 py-2 text-center border-l border-zinc-800">Crit</th>
                  <th className="px-2 py-2 text-center">Elem</th>
                  <th className="px-2 py-2 text-center">Boss</th>
                  <th className="px-2 py-2 text-center">Q.off</th>
                  <th className="px-2 py-2 text-right border-l border-zinc-800">Observed</th>
                  <th className="px-2 py-2 text-right">Calc (live)</th>
                  <th className="px-2 py-2 text-right">Obs/Calc</th>
                  <th className="px-2 py-2 text-left">Note</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {observations.slice().reverse().map(o => {
                  const { calc, ratio } = recomputeWithCurrentConstants(o)
                  const good = Math.abs(ratio - 1) <= 0.02
                  const medium = !good && Math.abs(ratio - 1) <= 0.05
                  return (
                    <tr key={o.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-2 py-1.5 text-zinc-100">{o.char}</td>
                      <td className="px-2 py-1.5">{o.slot}</td>
                      <td className="px-2 py-1.5 text-right border-l border-zinc-800/50">{o.atk}</td>
                      <td className="px-2 py-1.5 text-right">{o.chd}%</td>
                      <td className="px-2 py-1.5 text-right">{o.dmgInc}%</td>
                      <td className="px-2 py-1.5 text-right">{o.pen}%</td>
                      <td className="px-2 py-1.5 text-right border-l border-zinc-800/50">{o.def}</td>
                      <td className="px-2 py-1.5 text-right">{o.tCdmgRed}%</td>
                      <td className="px-2 py-1.5 text-right">{o.tDmgRed}%</td>
                      <td className="px-2 py-1.5 text-center border-l border-zinc-800/50">{o.crit ? '✓' : ''}</td>
                      <td className="px-2 py-1.5 text-center">{o.elem === 'adv' ? '+' : o.elem === 'disadv' ? '−' : '='}</td>
                      <td className="px-2 py-1.5 text-center">{o.isBoss ? '✓' : ''}</td>
                      <td className="px-2 py-1.5 text-center text-amber-400">{o.quirksDisabled ? '✓' : ''}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-zinc-100 border-l border-zinc-800/50">{o.obs}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{calc.toFixed(0)}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${good ? 'text-green-400' : medium ? 'text-amber-400' : 'text-red-400'}`}>
                        {ratio.toFixed(4)}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">{o.note ?? ''}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => deleteObservation(o.id)} className="text-zinc-600 hover:text-red-400">×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={NUMBER_INPUT}
      />
    </label>
  )
}

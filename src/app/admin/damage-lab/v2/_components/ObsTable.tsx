'use client'

import { useState } from 'react'
import type { ObservationV2 } from '@/app/api/admin/damage-lab/v2/observations/route'

/** Legacy shape kept exported for callers that build summary rows by hand. */
export interface ObsRow {
  id: string
  ts: string
  charName: string
  charId: string
  slot: ObservationV2['slot']
  monsterName: string
  monsterId: string
  obs: number
  calc: number
  crit: boolean
}

interface ObsTableProps {
  observations: ObservationV2[]
  /** Live recompute per obs id — keeps the table responsive to formula tweaks. */
  calcs: Map<string, number>
  onLoad: (id: string) => void
  onDelete: (id: string) => void
}

function ratioStatus(ratio: number): 'green' | 'amber' | 'red' {
  if (ratio >= 0.98 && ratio <= 1.02) return 'green'
  if (ratio >= 0.95 && ratio <= 1.05) return 'amber'
  return 'red'
}

const RATIO_CLASS: Record<'green' | 'amber' | 'red', string> = {
  green: 'text-green-400',
  amber: 'text-amber-400',
  red:   'text-red-400',
}

function formatInt(n: number): string {
  return n.toLocaleString('en-US').replace(/,/g, ' ')
}

function pct(n: number | undefined, digits = 1): string {
  if (n == null) return '—'
  return `${n.toFixed(digits)}%`
}

export function ObsTable({ observations, calcs, onLoad, onDelete }: ObsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Observations <span className="text-zinc-600">({observations.length})</span>
      </h2>

      {observations.length === 0 && (
        <div className="rounded bg-zinc-950 p-3 text-xs text-zinc-500">
          No observations yet. Save one from the Result panel.
        </div>
      )}

      {observations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-2 py-1 font-medium"></th>
                <th className="px-2 py-1 font-medium">#</th>
                <th className="px-2 py-1 font-medium">Caster</th>
                <th className="px-2 py-1 font-medium">Slot</th>
                <th className="px-2 py-1 font-medium">Crit</th>
                <th className="px-2 py-1 font-medium">Target</th>
                <th className="px-2 py-1 font-medium">Mode</th>
                <th className="px-2 py-1 text-right font-medium">DF</th>
                <th className="px-2 py-1 text-right font-medium">obs</th>
                <th className="px-2 py-1 text-right font-medium">calc</th>
                <th className="px-2 py-1 text-right font-medium">Δ</th>
                <th className="px-2 py-1 text-right font-medium">ratio</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o, i) => {
                const calc = calcs.get(o.id) ?? 0
                const delta = o.obs - calc
                const ratio = calc === 0 ? 0 : o.obs / calc
                const status = ratioStatus(ratio)
                const isOpen = expanded.has(o.id)
                const elemBadge = o.elem === 'adv' ? '↑' : o.elem === 'disadv' ? '↓' : ''
                return (
                  <Row
                    key={o.id}
                    obs={o}
                    calc={calc}
                    delta={delta}
                    ratio={ratio}
                    status={status}
                    index={i}
                    isOpen={isOpen}
                    elemBadge={elemBadge}
                    onToggle={() => toggle(o.id)}
                    onLoad={() => onLoad(o.id)}
                    onDelete={() => onDelete(o.id)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Row({
  obs, calc, delta, ratio, status, index, isOpen, elemBadge,
  onToggle, onLoad, onDelete,
}: {
  obs: ObservationV2
  calc: number
  delta: number
  ratio: number
  status: 'green' | 'amber' | 'red'
  index: number
  isOpen: boolean
  elemBadge: string
  onToggle: () => void
  onLoad: () => void
  onDelete: () => void
}) {
  return (
    <>
      <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
        <td className="px-1 py-1">
          <button
            type="button"
            onClick={onToggle}
            className="text-[10px] text-zinc-500 hover:text-zinc-200"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        </td>
        <td className="px-2 py-1 text-zinc-600">{index + 1}</td>
        <td className="px-2 py-1 text-zinc-200">{obs.charName}</td>
        <td className="px-2 py-1 text-zinc-400">{obs.slot}</td>
        <td className="px-2 py-1 text-zinc-500">{obs.crit ? '✓' : '·'}</td>
        <td className="px-2 py-1 text-zinc-400">
          {obs.monsterName ?? '—'}
          {elemBadge && <span className="ml-1 text-zinc-500">{elemBadge}</span>}
        </td>
        <td className="px-2 py-1 text-zinc-500" title={obs.modeLabel ?? obs.mode ?? ''}>
          {obs.modeLabel ?? obs.mode ?? '—'}
        </td>
        <td className="px-2 py-1 text-right tabular-nums text-zinc-500">{obs.df}</td>
        <td className="px-2 py-1 text-right tabular-nums text-zinc-300">{formatInt(obs.obs)}</td>
        <td className="px-2 py-1 text-right tabular-nums text-zinc-300">{formatInt(calc)}</td>
        <td className="px-2 py-1 text-right tabular-nums text-zinc-500">
          {delta > 0 ? '+' : ''}{formatInt(delta)}
        </td>
        <td className={`px-2 py-1 text-right tabular-nums font-semibold ${RATIO_CLASS[status]}`}>
          {ratio.toFixed(3)}
        </td>
        <td className="px-2 py-1 text-right">
          <button
            type="button"
            onClick={onLoad}
            className="mr-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
            title="Load into form"
          >
            load
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-900/50"
            title="Delete"
          >
            ×
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-zinc-800/50 bg-zinc-950/40">
          <td colSpan={13} className="px-3 py-2">
            <ObsDetails obs={obs} />
          </td>
        </tr>
      )}
    </>
  )
}

function ObsDetails({ obs }: { obs: ObservationV2 }) {
  // Active external buffs only — drop inactive rows.
  const activeBuffs = obs.externalBuffs
    ? Object.entries(obs.externalBuffs).filter(([, s]) => s.active)
    : []
  const activeMechanics = obs.bossMechanics
    ? Object.entries(obs.bossMechanics).filter(([, s]) => s.active)
    : []
  // Pool conditions actually used (non-default).
  const poolHints: string[] = []
  if (obs.ownerHpRate != null && obs.ownerHpRate !== 1) poolHints.push(`ownerHP ${(obs.ownerHpRate * 100).toFixed(0)}%`)
  if (obs.targetHpRate != null && obs.targetHpRate !== 1) poolHints.push(`targetHP ${(obs.targetHpRate * 100).toFixed(0)}%`)
  if (obs.casterHpRate != null && obs.casterHpRate !== 1) poolHints.push(`casterHP ${(obs.casterHpRate * 100).toFixed(0)}%`)
  if (obs.ownerBuffCount)         poolHints.push(`ownerBuffs ${obs.ownerBuffCount}`)
  if (obs.targetBuffCount)        poolHints.push(`tgtBuffs ${obs.targetBuffCount}`)
  if (obs.ownerDebuffCount)       poolHints.push(`ownerDebuffs ${obs.ownerDebuffCount}`)
  if (obs.targetDebuffCount)      poolHints.push(`tgtDebuffs ${obs.targetDebuffCount}`)
  if (obs.targetBroken)           poolHints.push('broken')
  if (obs.killCountStack)         poolHints.push(`kills ${obs.killCountStack}`)
  if (obs.teamBuffCount)          poolHints.push(`teamBuffs ${obs.teamBuffCount}`)
  if (obs.teamDecreaseCount)      poolHints.push(`teamDead ${obs.teamDecreaseCount}`)
  if (obs.enemyTeamDecreaseCount) poolHints.push(`enemyDead ${obs.enemyTeamDecreaseCount}`)
  if (obs.inMonadGate)            poolHints.push('monadGate')
  if (obs.inTower)                poolHints.push('tower')
  if (obs.inPvp)                  poolHints.push('pvp')

  return (
    <div className="grid gap-3 text-[11px] sm:grid-cols-3">
      <Section title="Caster">
        <KV label="ID"     value={obs.charId} />
        <KV label="Skill"  value={`L${obs.skillLevel} · DF ${obs.df}`} />
        <KV label="ATK"    value={formatInt(obs.atk)} />
        <KV label="CHD"    value={pct(obs.chd)} />
        <KV label="PEN"    value={pct(obs.pen)} />
        <KV label="DMG↑"   value={pct(obs.dmgInc, 2)} />
        {obs.additionalAttackEnabled && (
          <KV label="Add atk" value={obs.additionalAttackRatio?.toFixed(0) ?? '—'} />
        )}
        <KV label="Quirks" value={obs.applyQuirks ? 'on' : 'off'} />
        {obs.atkScaling && (
          <KV
            label="Scaling"
            value={`base ${obs.atkScaling.baseMax} · flat ${obs.atkScaling.flat} · pct ${obs.atkScaling.pctBonus.toFixed(1)}%`}
          />
        )}
      </Section>

      <Section title="Target">
        <KV label="ID"     value={obs.monsterId ?? '—'} />
        <KV label="Lv"     value={obs.monsterLvl?.toString() ?? '—'} />
        <KV label="DEF"    value={formatInt(obs.targetDef)} />
        <KV label="DR"     value={pct(obs.targetDmgRed, 2)} />
        <KV label="CDR"    value={pct(obs.targetCdmgRed, 2)} />
        {obs.targetHp != null && <KV label="HP" value={formatInt(obs.targetHp)} />}
        <KV label="Boss"   value={obs.isBoss ? 'yes' : 'no'} />
        <KV label="Elem"   value={obs.elem} />
        {obs.stageName && <KV label="Stage" value={obs.stageName} />}
      </Section>

      <Section title="Modifiers">
        {activeBuffs.length > 0 && (
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase text-zinc-500">External</div>
            <ul className="space-y-0.5 text-zinc-400">
              {activeBuffs.map(([id, s]) => (
                <li key={id} className="font-mono text-[10px]">
                  {id} {s.value > 0 ? '+' : ''}{s.value}%
                </li>
              ))}
            </ul>
          </div>
        )}
        {activeMechanics.length > 0 && (
          <div className="mt-1">
            <div className="mb-0.5 text-[10px] font-semibold uppercase text-zinc-500">Boss mech</div>
            <ul className="space-y-0.5 text-zinc-400">
              {activeMechanics.map(([id]) => (
                <li key={id} className="font-mono text-[10px]">{id}</li>
              ))}
            </ul>
          </div>
        )}
        {poolHints.length > 0 && (
          <div className="mt-1">
            <div className="mb-0.5 text-[10px] font-semibold uppercase text-zinc-500">Pool conds</div>
            <div className="text-zinc-400">{poolHints.join(' · ')}</div>
          </div>
        )}
        {obs.note && (
          <div className="mt-1">
            <div className="mb-0.5 text-[10px] font-semibold uppercase text-zinc-500">Note</div>
            <div className="italic text-zinc-300">{obs.note}</div>
          </div>
        )}
        {activeBuffs.length === 0 && activeMechanics.length === 0 && poolHints.length === 0 && !obs.note && (
          <div className="text-zinc-600">No modifiers.</div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  )
}

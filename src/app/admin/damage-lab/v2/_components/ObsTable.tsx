'use client'

import type { CallerSlot } from '@/lib/damage/v2/buffs'

export interface ObsRow {
  id: string
  ts: string
  charName: string
  charId: string
  slot: CallerSlot
  monsterName: string
  monsterId: string
  obs: number
  /** Pre-computed by the page (recompute on each render). */
  calc: number
  crit: boolean
}

interface ObsTableProps {
  rows: ObsRow[]
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

export function ObsTable({ rows, onLoad, onDelete }: ObsTableProps) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Observations <span className="text-zinc-600">({rows.length})</span>
      </h2>

      {rows.length === 0 && (
        <div className="rounded bg-zinc-950 p-3 text-xs text-zinc-500">
          No observations yet. Save one from the Result panel.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-2 py-1 font-medium">#</th>
                <th className="px-2 py-1 font-medium">Caster</th>
                <th className="px-2 py-1 font-medium">Slot</th>
                <th className="px-2 py-1 font-medium">Crit</th>
                <th className="px-2 py-1 font-medium">Target</th>
                <th className="px-2 py-1 text-right font-medium">obs</th>
                <th className="px-2 py-1 text-right font-medium">calc</th>
                <th className="px-2 py-1 text-right font-medium">Δ</th>
                <th className="px-2 py-1 text-right font-medium">ratio</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const delta = r.obs - r.calc
                const ratio = r.calc === 0 ? 0 : r.obs / r.calc
                const status = ratioStatus(ratio)
                return (
                  <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-2 py-1 text-zinc-600">{i + 1}</td>
                    <td className="px-2 py-1 text-zinc-200">{r.charName}</td>
                    <td className="px-2 py-1 text-zinc-400">{r.slot}</td>
                    <td className="px-2 py-1 text-zinc-500">{r.crit ? '✓' : '·'}</td>
                    <td className="px-2 py-1 text-zinc-400">{r.monsterName}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-zinc-300">{formatInt(r.obs)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-zinc-300">{formatInt(r.calc)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-zinc-500">
                      {delta > 0 ? '+' : ''}{formatInt(delta)}
                    </td>
                    <td className={`px-2 py-1 text-right tabular-nums font-semibold ${RATIO_CLASS[status]}`}>
                      {ratio.toFixed(3)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => onLoad(r.id)}
                        className="mr-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                        title="Load into form"
                      >
                        load
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-900/50"
                        title="Delete"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
